"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

const ETR_FORMAT = "nextjs-engine-theme";
const ETR_FORMAT_VERSION = 1;
const GENERATED_BY = "NENC";
const MAX_THEME_DEPTH = 32;
const MAX_THEME_NODES = 10000;
const MAX_THEME_LENGTH = 512 * 1024;
const ID_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isWithin(root, target) {
	const relative = path.relative(root, target);
	return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

function unwrap(node) {
	let current = node;
	while (current && (ts.isParenthesizedExpression(current)
		|| ts.isAsExpression(current)
		|| ts.isTypeAssertionExpression(current)
		|| (typeof ts.isSatisfiesExpression === "function" && ts.isSatisfiesExpression(current))
		|| ts.isNonNullExpression(current))) current = current.expression;
	return current;
}

function propertyName(property) {
	const name = property && property.name;
	return name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
		? name.text
		: undefined;
}

function collectVariables(sourceFile) {
	const variables = new Map();
	function visit(node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			variables.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return variables;
}

function staticJsonValue(expression, variables, seen, state, depth) {
	const node = unwrap(expression);
	if (!node) throw new Error("missing expression");
	state.nodes += 1;
	if (state.nodes > MAX_THEME_NODES) throw new Error("theme exceeds the maximum value count");
	if (depth > MAX_THEME_DEPTH) throw new Error("theme exceeds the maximum nesting depth");

	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isNumericLiteral(node)) {
		const value = Number(node.text);
		if (!Number.isFinite(value)) throw new Error("non-finite numbers are not valid JSON theme values");
		return value;
	}
	if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
	if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (node.kind === ts.SyntaxKind.NullKeyword) return null;
	if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken
		&& ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);

	if (ts.isIdentifier(node)) {
		if (node.text === "undefined" || node.text === "NaN" || node.text === "Infinity") {
			throw new Error(node.text + " is not a JSON theme value");
		}
		if (seen.has(node.text)) throw new Error("cyclic identifier reference " + node.text);
		const initializer = variables.get(node.text);
		if (!initializer) throw new Error("identifier " + node.text + " is not a local static value");
		const nextSeen = new Set(seen);
		nextSeen.add(node.text);
		return staticJsonValue(initializer, variables, nextSeen, state, depth + 1);
	}

	if (ts.isArrayLiteralExpression(node)) {
		const output = [];
		for (const element of node.elements) {
			if (ts.isSpreadElement(element)) throw new Error("array spreads are not statically supported in .etr themes");
			output.push(staticJsonValue(element, variables, seen, state, depth + 1));
		}
		return output;
	}

	if (ts.isObjectLiteralExpression(node)) {
		const output = Object.create(null);
		for (const property of node.properties) {
			if (ts.isSpreadAssignment(property)) throw new Error("object spreads are not statically supported in .etr themes");
			if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
				throw new Error("functions and accessors are not allowed in serializable .etr theme content");
			}
			const key = propertyName(property);
			if (key === undefined) throw new Error("computed property names are not statically supported in .etr themes");
			if (DANGEROUS_KEYS.has(key)) throw new Error("reserved object key " + key + " is not allowed in themes");
			let valueExpression;
			if (ts.isPropertyAssignment(property)) valueExpression = property.initializer;
			else if (ts.isShorthandPropertyAssignment(property)) valueExpression = property.name;
			else throw new Error("unsupported property form for " + key);
			output[key] = staticJsonValue(valueExpression, variables, seen, state, depth + 1);
		}
		return output;
	}

	if (ts.isCallExpression(node)) {
		const expression = unwrap(node.expression);
		if (ts.isPropertyAccessExpression(expression)
			&& ts.isIdentifier(expression.expression)
			&& expression.expression.text === "Object"
			&& expression.name.text === "freeze"
			&& node.arguments.length === 1) {
			return staticJsonValue(node.arguments[0], variables, seen, state, depth + 1);
		}
		throw new Error("function calls are not allowed in static .etr theme content");
	}
	throw new Error("unsupported dynamic theme expression: " + (ts.SyntaxKind[node.kind] || "unknown"));
}

function themeCreatorNames(sourceFile) {
	const names = new Set(["createTheme"]);
	function visit(node) {
		if (ts.isImportDeclaration(node) && node.importClause && node.importClause.namedBindings
			&& ts.isNamedImports(node.importClause.namedBindings)) {
			for (const element of node.importClause.namedBindings.elements) {
				const imported = element.propertyName ? element.propertyName.text : element.name.text;
				if (imported === "createTheme") names.add(element.name.text);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return names;
}

function callIdentifier(node) {
	if (ts.isIdentifier(node)) return node.text;
	if (ts.isPropertyAccessExpression(node)) return node.name.text;
	return undefined;
}

function validateTheme(theme) {
	if (!theme || typeof theme !== "object" || Array.isArray(theme)) throw new Error("createTheme() must receive an object literal");
	if (typeof theme.id !== "string" || !ID_SEGMENT.test(theme.id) || RESERVED_IDS.has(theme.id)) {
		throw new Error("theme id must be one plain group segment without dots, slashes, or whitespace");
	}
	if (theme.scope === undefined) theme.scope = "local";
	if (theme.scope !== "local" && theme.scope !== "global" && theme.scope !== "remote") {
		throw new Error("theme scope must be local, global, or remote");
	}

	let nodes = 0;
	const active = new Set();
	function walk(value, pathName, depth) {
		nodes += 1;
		if (nodes > MAX_THEME_NODES) throw new Error("theme exceeds the maximum value count");
		if (depth > MAX_THEME_DEPTH) throw new Error("theme exceeds the maximum nesting depth");
		if (value === null || typeof value === "string" || typeof value === "boolean") return;
		if (typeof value === "number") {
			if (!Number.isFinite(value)) throw new Error("non-finite number at " + pathName);
			return;
		}
		if (typeof value !== "object") throw new Error("theme must contain JSON data only; invalid value at " + pathName);
		if (active.has(value)) throw new Error("cyclic reference at " + pathName);
		if (Array.isArray(value)) {
			active.add(value);
			for (let index = 0; index < value.length; index += 1) {
				if (!(index in value)) throw new Error("array hole at " + pathName);
				walk(value[index], pathName + "[" + index + "]", depth + 1);
			}
			active.delete(value);
			return;
		}
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) throw new Error("non-plain object at " + pathName);
		active.add(value);
		for (const key of Object.keys(value)) {
			if (DANGEROUS_KEYS.has(key)) throw new Error("reserved key at " + pathName + "." + key);
			walk(value[key], pathName + "." + key, depth + 1);
		}
		active.delete(value);
	}
	walk(theme, "theme", 0);
	const serialized = JSON.stringify(theme);
	if (serialized.length > MAX_THEME_LENGTH) throw new Error("theme exceeds the " + MAX_THEME_LENGTH + "-character limit");
	return theme;
}

function canonicalJson(value) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new TypeError("Cannot canonicalize a non-finite number.");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
	if (!value || typeof value !== "object") throw new TypeError("Cannot canonicalize non-JSON data.");
	const keys = Object.keys(value).sort();
	return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
}

function sortJson(value) {
	if (Array.isArray(value)) return value.map(sortJson);
	if (!value || typeof value !== "object") return value;
	const output = {};
	for (const key of Object.keys(value).sort()) output[key] = sortJson(value[key]);
	return output;
}

function sha256(value) {
	return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeResolve(root, relative, label) {
	const resolved = path.resolve(root, relative);
	if (!isWithin(root, resolved) || resolved === path.resolve(root)) {
		throw new Error("[EngineTheme] " + label + " must remain inside the project root.");
	}
	return resolved;
}

function assertNoSymlinkPath(root, target, targetIsDirectory = false) {
	const resolvedRoot = fs.realpathSync(root);
	const resolvedTarget = path.resolve(resolvedRoot, path.relative(path.resolve(root), path.resolve(target)));
	if (!isWithin(resolvedRoot, resolvedTarget) || resolvedTarget === resolvedRoot) {
		throw new Error("[EngineTheme] Output path must remain inside the project root.");
	}
	const relative = path.relative(resolvedRoot, resolvedTarget);
	let current = resolvedRoot;
	const segments = relative.split(path.sep).filter(Boolean);
	for (let index = 0; index < segments.length; index += 1) {
		current = path.join(current, segments[index]);
		let stat;
		try { stat = fs.lstatSync(current); } catch (error) {
			if (error && error.code === "ENOENT") continue;
			throw error;
		}
		if (stat.isSymbolicLink()) {
			throw new Error("[EngineTheme] Refusing to read/write through a symbolic link: "
				+ path.relative(resolvedRoot, current).split(path.sep).join("/"));
		}
		const isFinal = index === segments.length - 1;
		if ((!isFinal || targetIsDirectory) && !stat.isDirectory()) {
			throw new Error("[EngineTheme] Expected a directory at "
				+ path.relative(resolvedRoot, current).split(path.sep).join("/") + ".");
		}
	}
}

function ensureDirectoryTree(root, target) {
	assertNoSymlinkPath(root, target, true);
	const relative = path.relative(root, target);
	let current = root;
	for (const segment of relative.split(path.sep).filter(Boolean)) {
		current = path.join(current, segment);
		try { fs.mkdirSync(current); } catch (error) {
			if (!error || error.code !== "EEXIST") throw error;
		}
		const stat = fs.lstatSync(current);
		if (stat.isSymbolicLink() || !stat.isDirectory()) {
			throw new Error("[EngineTheme] Refusing unsafe output directory: "
				+ path.relative(root, current).split(path.sep).join("/"));
		}
	}
}

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

function readVersion(root, packageName, fallbackRoot) {
	const packageParts = packageName.split("/");
	const candidates = [
		path.join(root, "node_modules", ...packageParts, "package.json"),
		path.join(fallbackRoot, "node_modules", ...packageParts, "package.json"),
	];
	for (const candidate of candidates) {
		const parsed = readJson(candidate);
		if (parsed && typeof parsed.version === "string") return parsed.version;
	}
	if (packageName === "nextjs-engine") {
		const local = readJson(path.join(fallbackRoot, "package.json"));
		if (local && typeof local.version === "string") return local.version;
	}
	const project = readJson(path.join(root, "package.json"));
	const dependencyRange = project && project.dependencies && project.dependencies[packageName];
	return typeof dependencyRange === "string" ? dependencyRange : "unresolved";
}

function atomicWrite(target, content) {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const temporary = target + ".tmp-" + process.pid + "-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
	try {
		fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" });
		fs.renameSync(temporary, target);
	} catch (error) {
		try { fs.rmSync(temporary, { force: true }); } catch { /* Preserve the original error. */ }
		throw error;
	}
}

function compileEngineThemeArtifacts(projectRoot, sourceFiles, options = {}) {
	const root = fs.realpathSync(path.resolve(projectRoot));
	const themeRoot = safeResolve(root, path.join(".nextjs-engine", "gen3", "theme"), "theme output");
	const cacheRoot = safeResolve(root, path.join(".nextjs-engine", ".cache", "gen3"), "theme cache");
	const manifestPath = path.join(cacheRoot, "theme-artifacts.json");
	assertNoSymlinkPath(root, themeRoot, true);
	assertNoSymlinkPath(root, cacheRoot, true);
	assertNoSymlinkPath(root, manifestPath, false);
	const fallbackRoot = path.resolve(__dirname, "../../..");
	const nextVersion = options.nextjsVersion || readVersion(root, "next", fallbackRoot);
	const engineVersion = options.engineVersion || readVersion(root, "nextjs-engine", fallbackRoot);
	const themesById = new Map();

	for (const entry of sourceFiles || []) {
		const sourceFile = entry && entry.sourceFile;
		if (!sourceFile) continue;
		const fileName = entry.filePath || sourceFile.fileName || "<unknown source>";
		const variables = collectVariables(sourceFile);
		const names = themeCreatorNames(sourceFile);

		function visit(node) {
			if (ts.isCallExpression(node) && names.has(callIdentifier(node.expression))) {
				if (node.arguments.length !== 1) {
					throw new Error("[EngineTheme] " + fileName + ": createTheme() needs exactly one static object argument.");
				}
				const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
				let theme;
				try {
					theme = staticJsonValue(node.arguments[0], variables, new Set(), { nodes: 0 }, 0);
					theme = validateTheme(theme);
				} catch (error) {
					throw new Error("[EngineTheme] " + fileName + ":" + line + ": "
						+ (error instanceof Error ? error.message : String(error)));
				}
				const serializedDefinition = canonicalJson(theme);
				const previous = themesById.get(theme.id);
				if (previous && previous.serialized !== serializedDefinition) {
					throw new Error("[EngineTheme] Duplicate theme group ID " + theme.id + " in "
						+ previous.fileName + " and " + fileName + ".");
				}
				if (!previous) themesById.set(theme.id, { theme, serialized: serializedDefinition, fileName });
			}
			ts.forEachChild(node, visit);
		}
		visit(sourceFile);
	}

	const definitions = [...themesById.values()].sort((left, right) => left.theme.id.localeCompare(right.theme.id));
	const artifacts = [];
	for (const item of definitions) {
		const payload = {
			format: ETR_FORMAT,
			formatVersion: ETR_FORMAT_VERSION,
			generatedBy: GENERATED_BY,
			id: item.theme.id,
			createdWith: { nextjs: nextVersion, nextjsEngine: engineVersion },
			content: item.theme,
		};
		const digest = sha256(canonicalJson(payload));
		const artifact = { ...payload, sha256: digest };
		const content = JSON.stringify(sortJson(artifact), null, 2) + "\n";
		if (content.length > MAX_THEME_LENGTH * 2) {
			throw new Error("[EngineTheme] Compiled .etr artifact is too large for group " + item.theme.id + ".");
		}
		artifacts.push({
			id: item.theme.id,
			fileName: item.theme.id + ".etr",
			path: path.join(themeRoot, item.theme.id + ".etr"),
			sha256: digest,
			content,
		});
	}

	const oldManifest = readJson(manifestPath);
	const oldFiles = oldManifest && oldManifest.generatedBy === GENERATED_BY && Array.isArray(oldManifest.files)
		? oldManifest.files.filter((file) => typeof file === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]*\.etr$/.test(file))
		: [];
	const nextNames = new Set(artifacts.map((artifact) => artifact.fileName));
	const result = { artifacts: [], createdCount: 0, updatedCount: 0, unchangedCount: 0, removedCount: 0 };
	if (artifacts.length === 0 && oldFiles.length === 0 && !oldManifest) return result;

	if (artifacts.length > 0 || oldFiles.length > 0 || oldManifest) {
		ensureDirectoryTree(root, themeRoot);
		ensureDirectoryTree(root, cacheRoot);
	}

	// Validate existing targets before writing any output; never overwrite a
	// user-owned file or symlink placed in the generated theme directory.
	for (const artifact of artifacts) {
		assertNoSymlinkPath(root, artifact.path, false);
		if (!fs.existsSync(artifact.path)) continue;
		const existing = readJson(artifact.path);
		if (!existing || existing.format !== ETR_FORMAT || existing.generatedBy !== GENERATED_BY || existing.id !== artifact.id) {
			throw new Error("[EngineTheme] Refusing to overwrite non-generated theme artifact: "
				+ path.relative(root, artifact.path).split(path.sep).join("/"));
		}
	}

	for (const artifact of artifacts) {
		let status;
		if (fs.existsSync(artifact.path) && fs.readFileSync(artifact.path, "utf8") === artifact.content) {
			result.unchangedCount += 1;
			status = "unchanged";
		} else {
			const existed = fs.existsSync(artifact.path);
			atomicWrite(artifact.path, artifact.content);
			if (existed) result.updatedCount += 1;
			else result.createdCount += 1;
			status = existed ? "updated" : "created";
		}
		result.artifacts.push({ id: artifact.id, fileName: artifact.fileName, sha256: artifact.sha256, status });
	}

	for (const oldFile of oldFiles) {
		if (nextNames.has(oldFile)) continue;
		const target = path.resolve(themeRoot, oldFile);
		if (!isWithin(themeRoot, target) || path.dirname(target) !== themeRoot) continue;
		assertNoSymlinkPath(root, target, false);
		const existing = readJson(target);
		if (existing && existing.format === ETR_FORMAT && existing.generatedBy === GENERATED_BY) {
			fs.rmSync(target, { force: true });
			result.removedCount += 1;
		}
	}

	const nextManifest = JSON.stringify({
		generatedBy: GENERATED_BY,
		formatVersion: 1,
		files: artifacts.map((artifact) => artifact.fileName).sort(),
	}, null, 2) + "\n";
	if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, "utf8") !== nextManifest) {
		atomicWrite(manifestPath, nextManifest);
	}
	return result;
}

module.exports = {
	canonicalJson,
	compileEngineThemeArtifacts,
	ETR_FORMAT,
	ETR_FORMAT_VERSION,
};
