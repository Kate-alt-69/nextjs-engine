"use strict";

const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const EXCLUDED_DIRECTORY_NAMES = new Set([
	"node_modules", ".git", ".next", ".nextjs-engine", ".turbo", "dist", "build", "coverage",
]);
const SCHEMA_ENGINE_SYMBOLS = Object.freeze({
	box: "EngineBox",
	EngineBox: "EngineBox",
	stack: "EngineStack",
	EngineStack: "EngineStack",
	grid: "EngineGrid",
	EngineGrid: "EngineGrid",
	text: "EngineText",
	EngineText: "EngineText",
	heading: "EngineHeading",
	EngineHeading: "EngineHeading",
	markdown: "EngineMarkdown",
	EngineMarkdown: "EngineMarkdown",
	image: "EngineImage",
	EngineImage: "EngineImage",
	video: "EngineVideo",
	EngineVideo: "EngineVideo",
	section: "EngineSection",
	EngineSection: "EngineSection",
	hero: "EngineHero",
	EngineHero: "EngineHero",
	card: "EngineCard",
	EngineCard: "EngineCard",
	button: "EngineButton",
	EngineButton: "EngineButton",
	link: "EngineLink",
	EngineLink: "EngineLink",
	nav: "EngineNav",
	EngineNav: "EngineNav",
	spacer: "EngineSpacer",
	EngineSpacer: "EngineSpacer",
	divider: "EngineDivider",
	EngineDivider: "EngineDivider",
	slot: "EngineSlot",
	EngineSlot: "EngineSlot",
	canvas: "EngineCanvas",
	EngineCanvas: "EngineCanvas",
	manim: "EngineManim",
	EngineManim: "EngineManim",
	manim3d: "EngineManim3D",
	EngineManim3D: "EngineManim3D",
	scroll: "EngineScroll",
	EngineScroll: "EngineScroll",
	"suspense": "EngineSuspense",
	EngineSuspense: "EngineSuspense",
	"custom-select": "CustomSelect",
	CustomSelect: "CustomSelect",
	option: "EngineOption",
	EngineOption: "EngineOption",
	optgroup: "EngineOptGroup",
	EngineOptGroup: "EngineOptGroup",
	form: "EngineForm",
	EngineForm: "EngineForm",
	input: "EngineInput",
	EngineInput: "EngineInput",
	textarea: "EngineTextarea",
	EngineTextarea: "EngineTextarea",
	checkbox: "EngineCheckbox",
	EngineCheckbox: "EngineCheckbox",
	label: "EngineLabel",
	EngineLabel: "EngineLabel",
	dialog: "EngineDialog",
	EngineDialog: "EngineDialog",
	drawer: "EngineDrawer",
	EngineDrawer: "EngineDrawer",
	popover: "EnginePopover",
	EnginePopover: "EnginePopover",
});

function displayPath(root, target) {
	return path.relative(root, target).split(path.sep).join("/");
}
function isWithin(root, target) {
	const rel = path.relative(root, target);
	return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}
function hasExcludedSegment(root, target) {
	if (!isWithin(root, target)) return true;
	const relative = displayPath(root, target);
	return relative.split("/").some((part) => EXCLUDED_DIRECTORY_NAMES.has(part) || part.startsWith("."));
}
function isSourcePath(file) {
	return SOURCE_EXTENSIONS.has(path.extname(file)) && !file.endsWith(".d.ts");
}
function isEngineSourcePath(root, file) {
	if (!file || hasExcludedSegment(root, file) || !isSourcePath(file)) return false;
	const relative = displayPath(root, file);
	return relative.startsWith("src/engine/") || relative.startsWith("engine/");
}
function createResolver(projectRoot) {
	const configPath = path.join(projectRoot, "tsconfig.json");
	let options = {
		allowJs: true,
		jsx: ts.JsxEmit.ReactJSX,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
	};
	if (fs.existsSync(configPath)) {
		const config = ts.readConfigFile(configPath, ts.sys.readFile);
		if (!config.error) {
			const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
			options = { ...options, ...parsed.options };
		}
	}
	const cache = ts.createModuleResolutionCache(projectRoot, (fileName) => fileName.toLowerCase(), options);
	return {
		options,
		resolve(specifier, containingFile) {
			if (typeof specifier !== "string" || !specifier) return undefined;
			const result = ts.resolveModuleName(specifier, containingFile, options, ts.sys, cache).resolvedModule;
			return result ? path.resolve(result.resolvedFileName) : undefined;
		},
	};
}
function scriptKindFor(file) {
	const extension = path.extname(file).toLowerCase();
	if (extension === ".tsx") return ts.ScriptKind.TSX;
	if (extension === ".jsx") return ts.ScriptKind.JSX;
	if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return ts.ScriptKind.JS;
	if (extension === ".json") return ts.ScriptKind.JSON;
	return ts.ScriptKind.TS;
}
function createSourceCache(projectRoot, sourceByPath) {
	const cache = new Map(sourceByPath);
	return {
		get(file) {
			const resolved = path.resolve(file);
			if (cache.has(resolved)) return cache.get(resolved);
			if (hasExcludedSegment(projectRoot, resolved) || !isSourcePath(resolved) || !fs.existsSync(resolved)) return undefined;
			let stat;
			try { stat = fs.statSync(resolved); } catch { return undefined; }
			if (!stat.isFile()) return undefined;
			let sourceFile;
			try {
				sourceFile = ts.createSourceFile(
					resolved,
					fs.readFileSync(resolved, "utf8"),
					ts.ScriptTarget.Latest,
					true,
					scriptKindFor(resolved),
				);
			} catch {
				return undefined;
			}
			cache.set(resolved, sourceFile);
			return sourceFile;
		},
	};
}
function isTypeOnlyNamedImport(element) {
	return Boolean(element && element.isTypeOnly);
}
function runtimeImportNames(statement) {
	if (ts.isImportDeclaration(statement)) {
		const clause = statement.importClause;
		if (!clause || clause.isTypeOnly) return [];
		const names = [];
		if (clause.name) names.push("default");
		if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.push("*");
		if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
			for (const element of clause.namedBindings.elements) {
				if (!isTypeOnlyNamedImport(element)) names.push(element.propertyName?.text || element.name.text);
			}
		}
		return names;
	}
	if (ts.isExportDeclaration(statement)) {
		if (statement.isTypeOnly || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
		if (!statement.exportClause) return ["*"];
		if (ts.isNamespaceExport(statement.exportClause)) return ["*"];
		if (!ts.isNamedExports(statement.exportClause)) return [];
		return statement.exportClause.elements
			.filter((element) => !element.isTypeOnly)
			.map((element) => element.name.text);
	}
	return [];
}
function collectRuntimeImports(sourceFile) {
	const imports = [];
	function add(specifier, names, kind) {
		if (typeof specifier !== "string" || !specifier || names.length === 0) return;
		imports.push({ specifier, names: [...new Set(names)], kind });
	}
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
			add(statement.moduleSpecifier.text, runtimeImportNames(statement), "import");
		} else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
			add(statement.moduleSpecifier.text, runtimeImportNames(statement), "re-export");
		}
	}
	function visit(node) {
		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
			&& node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
			add(node.arguments[0].text, ["default"], "dynamic-import");
		} else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
			&& node.expression.text === "require" && node.arguments.length === 1
			&& ts.isStringLiteral(node.arguments[0])) {
			add(node.arguments[0].text, ["default"], "commonjs-require");
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return imports;
}
function declarationHasExport(statement) {
	const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
	return Boolean(modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}
function statementDeclaresName(statement, name) {
	if (name === "default" && declarationHasExport(statement)) {
		const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
		if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return true;
	}
	if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
		|| ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
		|| ts.isEnumDeclaration(statement) || ts.isModuleDeclaration(statement)) {
		return declarationHasExport(statement) && statement.name?.text === name;
	}
	if (ts.isVariableStatement(statement) && declarationHasExport(statement)) {
		return statement.declarationList.declarations.some((declaration) =>
			ts.isIdentifier(declaration.name) && declaration.name.text === name);
	}
	return false;
}
function importedLocalName(statement, importedName) {
	const clause = statement.importClause;
	if (!clause || clause.isTypeOnly) return undefined;
	if (importedName === "default" && clause.name) return "default";
	if (!clause.namedBindings) return undefined;
	if (ts.isNamespaceImport(clause.namedBindings)) return importedName === "*" ? "*" : undefined;
	if (!ts.isNamedImports(clause.namedBindings)) return undefined;
	const element = clause.namedBindings.elements.find((entry) =>
		entry.name.text === importedName && !entry.isTypeOnly);
	return element ? (element.propertyName?.text || element.name.text) : undefined;
}
function hasEngineSymbolName(name) {
	return typeof name === "string" && (
		/^Engine[A-Z0-9]/.test(name)
		|| /^useEngine[A-Z]/.test(name)
		|| /^EC[A-Z0-9]/.test(name)
		|| /^ec[A-Z]/.test(name)
	);
}
function engineImportAlias(name) {
	return "@engine/" + String(name || "Module");
}
function engineAbbreviation(name) {
	const value = String(name || "Module");
	if (value.startsWith("useEngine")) {
		const suffix = value.slice("use".length);
		const letters = suffix.match(/[A-Z0-9][a-z0-9]*/g) || [suffix];
		return "U" + letters.map((letter) => letter[0].toUpperCase()).join("");
	}
	if (value.startsWith("Engine")) {
		const suffix = value.slice("Engine".length);
		const letters = suffix.match(/[A-Z0-9][a-z0-9]*/g) || [suffix];
		return "E" + letters.map((letter) => letter[0].toUpperCase()).join("");
	}
	if (/^(?:EC|ec)[A-Z0-9]/.test(value)) return "EC" + (value.match(/[A-Z0-9]/g) || []).slice(1, 3).join("");
	const letters = value.match(/[A-Z0-9]/g);
	return letters && letters.length ? letters.slice(0, 3).join("") : value.slice(0, 3).toUpperCase();
}
function fallbackEngineName(specifier, name) {
	if (name && name !== "*" && name !== "default") return engineImportAlias(name);
	const cleaned = String(specifier || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
	const tail = cleaned.split("/").pop() || "Module";
	return tail.startsWith("@") ? tail : engineImportAlias(tail.replace(/\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/i, ""));
}
function normalizeModuleName(name, sourcePath) {
	if (name && name !== "*" && name !== "default") return String(name);
	const base = path.basename(sourcePath || "", path.extname(sourcePath || ""));
	if (/^Engine/.test(base) || /^useEngine/.test(base) || /^EC/.test(base)) return base;
	if (/^engine[a-z]/i.test(base)) return "Engine" + base.slice(6, 7).toUpperCase() + base.slice(7);
	return base || "Module";
}
function frameworkFilesForRoute(projectRoot, file, router) {
	const root = path.resolve(projectRoot);
	const relative = displayPath(root, file);
	const appMatch = relative.match(/^(src\/app|app)\//);
	const pagesMatch = relative.match(/^(src\/pages|pages)\//);
	const extensions = [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts"];
	const found = [];
	const addStem = (directory, stem) => {
		for (const extension of extensions) {
			const candidate = path.join(directory, stem + extension);
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				if (path.resolve(candidate) !== path.resolve(file)) found.push(path.resolve(candidate));
				return;
			}
		}
	};
	if (router === "app" && appMatch) {
		const appRoot = path.join(root, appMatch[1]);
		let directory = path.dirname(path.resolve(file));
		const shellStems = ["layout", "template", "loading", "error", "global-error", "not-found", "default"];
		while (isWithin(appRoot, directory)) {
			for (const stem of shellStems) addStem(directory, stem);
			if (path.resolve(directory) === path.resolve(appRoot)) break;
			const parent = path.dirname(directory);
			if (parent === directory) break;
			directory = parent;
		}
	} else if (router === "pages" && pagesMatch && !relative.startsWith((pagesMatch[1] + "/api/"))) {
		const pagesRoot = path.join(root, pagesMatch[1]);
		addStem(pagesRoot, "_app");
		addStem(pagesRoot, "_document");
	}
	return [...new Set(found)].sort();
}
function routePathForFile(projectRoot, file, router) {
	const relative = displayPath(projectRoot, file);
	const match = relative.match(/^(?:src\/)?(app|pages)\/(.*)$/);
	if (!match) return "/" + relative.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
	const routeKind = router || match[1];
	const parts = match[2].split("/");
	const filename = parts[parts.length - 1] || "";
	const base = filename.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
	let route;
	if (routeKind === "pages") {
		route = parts.slice();
		route[route.length - 1] = base;
		if (base === "index") route = route.slice(0, -1);
	} else if (base === "page" || base === "route") {
		route = parts.slice(0, -1);
	} else if (base === "not-found") {
		return "/_not-found";
	} else {
		route = parts.slice(0, -1).concat(base);
	}
	route = route.filter((part) => part && !/^\(.+\)$/.test(part) && !part.startsWith("@"));
	return ("/" + route.join("/")).replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}
function routeEntryFromFile(projectRoot, file) {
	const relative = displayPath(projectRoot, file);
	const match = relative.match(/^(?:src\/)?(app|pages)\/(.+)$/);
	if (!match) return null;
	const router = match[1];
	const segments = match[2].split("/");
	const filename = segments[segments.length - 1];
	const extension = path.extname(filename);
	if (!SOURCE_EXTENSIONS.has(extension)) return null;
	const base = filename.slice(0, -extension.length);
	let kind;
	let routePath;
	if (router === "app") {
		if (base === "page") kind = "app-page";
		else if (base === "route") kind = "app-route-handler";
		else if (base === "not-found") { kind = "app-not-found"; routePath = "/_not-found"; }
		else if (["opengraph-image", "twitter-image", "icon", "apple-icon", "sitemap", "robots", "manifest"].includes(base)) {
			kind = "app-metadata-route";
			const pathSegments = segments.slice(0, -1).concat(base);
			routePath = "/" + pathSegments.filter((part) => part && !/^\(.+\)$/.test(part) && !part.startsWith("@")).join("/");
		} else return null;
	} else {
		if (["_app", "_document", "_error", "_middleware"].includes(base)) return null;
		kind = segments[0] === "api" ? "pages-api-route" : "pages-route";
	}
	if (!routePath) {
		if (router === "app" && (kind === "app-page" || kind === "app-route-handler")) {
			routePath = routePathForFile(projectRoot, file, router);
		} else {
			routePath = routePathForFile(projectRoot, file);
		}
	}
	return {
		sourcePath: relative,
		routePath,
		kind,
		file: path.resolve(file),
		frameworkFiles: frameworkFilesForRoute(projectRoot, file, router),
	};
}
function isEngineLikeSpecifier(specifier) {
	const lower = String(specifier || "").toLowerCase();
	return lower.includes("engine") || lower.startsWith("@engine/");
}
function formatMilliseconds(value) {
	return (Math.max(0, value)).toFixed(value < 10 ? 1 : 0) + "ms";
}
function createModuleAnalyzer(projectRoot, options = {}) {
	const root = path.resolve(projectRoot);
	const resolver = createResolver(root);
	const sourceByPath = options.sourceByPath || new Map();
	const sourceCache = createSourceCache(root, sourceByPath);
	const log = typeof options.log === "function" ? options.log : (() => {});
	const moduleRecords = new Map();
	const routeRecords = [];
	const routeVisited = new Set();
	const fileImports = new Map();
	const recordById = new Map();
	let moduleOrder = 0;

	function importsFor(file) {
		const absolute = path.resolve(file);
		if (!fileImports.has(absolute)) {
			const sourceFile = sourceCache.get(absolute);
			fileImports.set(absolute, sourceFile ? collectRuntimeImports(sourceFile) : []);
		}
		return fileImports.get(absolute);
	}
	function resolveExportedSymbol(sourcePath, symbolName, seen = new Set()) {
		const absolute = path.resolve(sourcePath);
		const visitKey = absolute + "::" + symbolName;
		if (seen.has(visitKey)) return undefined;
		const nextSeen = new Set(seen);
		nextSeen.add(visitKey);
		const sourceFile = sourceCache.get(absolute);
		if (!sourceFile) return undefined;
		for (const statement of sourceFile.statements) {
			if (ts.isExportDeclaration(statement)) {
				if (statement.isTypeOnly) continue;
				const moduleSpecifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
					? statement.moduleSpecifier.text : undefined;
				if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
					const element = statement.exportClause.elements.find((entry) =>
						!entry.isTypeOnly && entry.name.text === symbolName);
					if (!element) continue;
					const targetName = element.propertyName?.text || element.name.text;
					if (moduleSpecifier) {
						const target = resolver.resolve(moduleSpecifier, absolute);
						if (!target || !isSourcePath(target) || hasExcludedSegment(root, target)) return undefined;
						return resolveExportedSymbol(target, targetName, nextSeen) || {
							sourcePath: target,
							name: targetName,
						};
					}
					for (const importStatement of sourceFile.statements) {
						if (!ts.isImportDeclaration(importStatement) || !ts.isStringLiteral(importStatement.moduleSpecifier)) continue;
						const localName = importedLocalName(importStatement, targetName);
						if (localName === undefined) continue;
						const target = resolver.resolve(importStatement.moduleSpecifier.text, absolute);
						if (!target || !isSourcePath(target) || hasExcludedSegment(root, target)) continue;
						return resolveExportedSymbol(target, localName, nextSeen) || { sourcePath: target, name: localName };
					}
				} else if (!statement.exportClause && moduleSpecifier) {
					const target = resolver.resolve(moduleSpecifier, absolute);
					if (!target || !isSourcePath(target) || hasExcludedSegment(root, target)) continue;
					const resolved = resolveExportedSymbol(target, symbolName, nextSeen);
					if (resolved) return resolved;
				}
			}
			if (statementDeclaresName(statement, symbolName)) return { sourcePath: absolute, name: symbolName };
		}
		return undefined;
	}
	function addUsage(record, routePath, visited = new Set()) {
		if (!routePath || !record || visited.has(record.id)) return;
		visited.add(record.id);
		if (!record.usedBy.includes(routePath)) record.usedBy.push(routePath);
		for (const dependencyId of record.dependencies) {
			const dependency = recordById.get(dependencyId);
			if (dependency) addUsage(dependency, routePath, visited);
		}
	}
	function recordFor(file, logicalName, specifier, routePath, resolution) {
		const actualPath = file && isEngineSourcePath(root, file) ? path.resolve(file) : undefined;
		const inferredName = normalizeModuleName(logicalName, actualPath);
		const canonicalImport = engineImportAlias(inferredName);
		const key = actualPath || "external::" + canonicalImport + "::" + String(specifier || "");
		let record = moduleRecords.get(key);
		if (!record) {
			const moduleStartedAt = Date.now();
			record = {
				id: "engine-module-" + (++moduleOrder),
				name: inferredName,
				abbreviation: engineAbbreviation(inferredName),
				importName: canonicalImport,
				sourcePath: actualPath ? displayPath(root, actualPath) : null,
				resolution: actualPath ? "local" : (resolution || "package-or-unresolved"),
				usedBy: [],
				dependencies: [],
			};
			moduleRecords.set(key, record);
			recordById.set(record.id, record);
			const display = record.sourcePath || fallbackEngineName(specifier, inferredName);
			log("COMPILING " + record.abbreviation + " : " + display);
			if (actualPath) processEngineFile(actualPath, record, routePath);
			const resolutionNote = actualPath ? "Engine dependency metadata prepared" : "package/import reference indexed; Next.js owns package emission";
			log("DONE COMPILED " + record.abbreviation + " : " + display
				+ " — " + resolutionNote + " in " + formatMilliseconds(Date.now() - moduleStartedAt));
		}
		addUsage(record, routePath);
		return record;
	}
	function addExternalSymbol(specifier, name, routePath) {
		if (!isEngineLikeSpecifier(specifier)) return undefined;
		let logicalName = name;
		if (name === "default" || name === "*") {
			logicalName = fallbackEngineName(specifier, name).replace(/^@engine\//, "");
		}
		if (!hasEngineSymbolName(logicalName)) return undefined;
		return recordFor(undefined, logicalName, specifier, routePath, "package");
	}
	function resolveSymbolTargets(targetPath, name) {
		if (!targetPath) return [];
		if (name === "*" || name === "default") return [{ sourcePath: targetPath, name: normalizeModuleName(name, targetPath) }];
		const found = resolveExportedSymbol(targetPath, name);
		if (found) return [found];
		if (isEngineSourcePath(root, targetPath)) return [{ sourcePath: targetPath, name }];
		return [];
	}
	function processEngineFile(filePath, currentRecord, routePath) {
		const sourceFile = sourceCache.get(filePath);
		if (!sourceFile) return;
		const imports = importsFor(filePath);
		for (const entry of imports) {
			const targetPath = resolver.resolve(entry.specifier, filePath);
			if (!targetPath || hasExcludedSegment(root, targetPath) || !isSourcePath(targetPath)) continue;
			if (isEngineSourcePath(root, targetPath)) {
				const names = entry.names.filter((name) => name !== "default" && name !== "*");
				if (names.length) {
					for (const importedName of names) {
						const targets = resolveSymbolTargets(targetPath, importedName);
						for (const target of targets) {
							const child = recordFor(target.sourcePath, target.name || importedName, entry.specifier, routePath, "local");
							if (!currentRecord.dependencies.includes(child.id)) currentRecord.dependencies.push(child.id);
						}
					}
				} else {
					const child = recordFor(targetPath, normalizeModuleName(undefined, targetPath), entry.specifier, routePath, "local");
					if (!currentRecord.dependencies.includes(child.id)) currentRecord.dependencies.push(child.id);
				}
			} else {
				scanProjectFile(targetPath, routePath);
			}
		}
	}
	function scanProjectFile(filePath, routePath) {
		const absolute = path.resolve(filePath);
		if (routeVisited.has(absolute) || hasExcludedSegment(root, absolute) || !isSourcePath(absolute)) return;
		routeVisited.add(absolute);
		for (const entry of importsFor(absolute)) {
			const targetPath = resolver.resolve(entry.specifier, absolute);
			if (targetPath && isEngineSourcePath(root, targetPath)) {
				const named = entry.names.filter((name) => name !== "default" && name !== "*");
				let included = false;
				for (const name of named) {
					if (!hasEngineSymbolName(name)) continue;
					const targets = resolveSymbolTargets(targetPath, name);
					for (const target of targets) {
						recordFor(target.sourcePath, target.name || name, entry.specifier, routePath, "local");
						included = true;
					}
				}
				if (!included && named.length === 0) {
					recordFor(targetPath, normalizeModuleName(undefined, targetPath), entry.specifier, routePath, "local");
				}
				continue;
			}
			if (targetPath && !hasExcludedSegment(root, targetPath) && isSourcePath(targetPath)) {
				scanProjectFile(targetPath, routePath);
			} else {
				for (const name of entry.names) addExternalSymbol(entry.specifier, name, routePath);
			}
		}
	}
	function schemaSymbols(schema, output = new Set()) {
		if (!schema || typeof schema !== "object") return output;
		if (typeof schema.type === "string" && SCHEMA_ENGINE_SYMBOLS[schema.type]) output.add(SCHEMA_ENGINE_SYMBOLS[schema.type]);
		if (Array.isArray(schema.children)) for (const child of schema.children) schemaSymbols(child, output);
		if (schema.type === "slot" && schema.props && schema.props.fallback && typeof schema.props.fallback === "object") {
			schemaSymbols(schema.props.fallback, output);
		}
		return output;
	}
	function analyze(routes, schemaSymbolsByFile = new Map(), schemaCandidateCountsByFile = new Map(), schemaSources = []) {
		const schemaSourceRecords = [];
		const totalRoutes = routes.length;
		for (let routeIndex = 0; routeIndex < totalRoutes; routeIndex++) {
			const route = routes[routeIndex];
			routeVisited.clear();
			const started = Date.now();
			const routeLabel = route.kind === "app-metadata-route" ? "METADATA"
				: route.kind === "app-route-handler" || route.kind === "pages-api-route" ? "ROUTE" : "PAGE";
			const completedBeforeRoute = routeIndex;
			const percentBeforeRoute = totalRoutes ? Math.round((completedBeforeRoute / totalRoutes) * 1000) / 10 : 100;
			log("COMPILING " + routeLabel + " : " + route.sourcePath + " — NENC ROUTES "
				+ completedBeforeRoute + "/" + totalRoutes + " complete (" + percentBeforeRoute + "%)");
			scanProjectFile(route.file, route.routePath);
			for (const frameworkFile of route.frameworkFiles || []) {
				scanProjectFile(frameworkFile, route.routePath);
			}
			for (const symbol of schemaSymbolsByFile.get(route.file) || []) {
				const barrel = path.join(root, "src", "engine", "index.ts");
				const packageBarrel = path.join(root, "engine", "index.ts");
				const entry = fs.existsSync(barrel) ? barrel : (fs.existsSync(packageBarrel) ? packageBarrel : undefined);
				if (entry) {
					const targets = resolveSymbolTargets(entry, symbol);
					if (targets.length) {
						for (const target of targets) recordFor(target.sourcePath, target.name || symbol, entry, route.routePath, "local");
						continue;
					}
				}
				recordFor(undefined, symbol, "@engine/" + symbol, route.routePath, "package");
			}
			const moduleNames = [...moduleRecords.values()]
				.filter((record) => record.usedBy.includes(route.routePath))
				.map((record) => record.importName)
				.sort();
			routeRecords.push({
				sourcePath: route.sourcePath,
				routePath: route.routePath,
				kind: route.kind,
				frameworkFiles: (route.frameworkFiles || []).map((file) => displayPath(root, file)),
				engineModules: moduleNames,
				engineModuleCount: moduleNames.length,
				schemaCandidateCount: Number(options.schemaCandidateCountsByFile?.get(route.file) || 0),
				analyzedInMilliseconds: Date.now() - started,
			});
			const completedRoutes = routeIndex + 1;
			const completedPercent = totalRoutes ? Math.round((completedRoutes / totalRoutes) * 1000) / 10 : 100;
			log("DONE COMPILED " + routeLabel + " : " + route.sourcePath
				+ " — route " + route.routePath + "; NENC ROUTES " + completedRoutes + "/" + totalRoutes
				+ " complete (" + completedPercent + "%), " + moduleNames.length + " Engine modules indexed in "
				+ formatMilliseconds(Date.now() - started) + "; Next.js retains JS/TSX emission");
		}
		for (const source of schemaSources) {
			routeVisited.clear();
			const usageKey = "schema-source:" + source.sourcePath;
			log("COMPILING ENGINE SCHEMA SOURCE : " + source.sourcePath);
			scanProjectFile(source.file, usageKey);
			for (const symbol of schemaSymbolsByFile.get(source.file) || []) {
				const barrel = path.join(root, "src", "engine", "index.ts");
				const packageBarrel = path.join(root, "engine", "index.ts");
				const entry = fs.existsSync(barrel) ? barrel : (fs.existsSync(packageBarrel) ? packageBarrel : undefined);
				if (entry) {
					const targets = resolveSymbolTargets(entry, symbol);
					if (targets.length) {
						for (const target of targets) recordFor(target.sourcePath, target.name || symbol, entry, usageKey, "local");
						continue;
					}
				}
				recordFor(undefined, symbol, "@engine/" + symbol, usageKey, "package");
			}
			const moduleNames = [...moduleRecords.values()]
				.filter((record) => record.usedBy.includes(usageKey))
				.map((record) => record.importName)
				.sort();
			schemaSourceRecords.push({
				sourcePath: source.sourcePath,
				engineModules: moduleNames,
				engineModuleCount: moduleNames.length,
				schemaCandidateCount: schemaCandidateCountsByFile.get(source.file) || 0,
			});
			log("DONE COMPILED ENGINE SCHEMA SOURCE : " + source.sourcePath
				+ " — " + moduleNames.length + " Engine modules indexed");
		}
		return {
			routes: routeRecords,
			schemaSources: schemaSourceRecords,
			modules: [...moduleRecords.values()].map((record) => ({
				...record,
				usedBy: record.usedBy.sort(),
				dependencies: [...record.dependencies],
			})),
		};
	}
	return { analyze };
}

function analyzeProjectModules(projectRoot, options = {}) {
	const startedAt = Date.now();
	const root = path.resolve(projectRoot);
	const files = options.files || [];
	const sourceByPath = options.sourceByPath || new Map();
	const log = typeof options.log === "function" ? options.log : (() => {});
	const routes = files.map((file) => routeEntryFromFile(root, file)).filter(Boolean)
		.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
	const schemaSymbolsByFile = options.schemaSymbolsByFile || new Map();
	const schemaCandidateCountsByFile = options.schemaCandidateCountsByFile || new Map();
	const routeFiles = new Set(routes.map((route) => route.file));
	const schemaSources = [...schemaCandidateCountsByFile.keys()]
		.filter((file) => !routeFiles.has(path.resolve(file)))
		.map((file) => ({
			file: path.resolve(file),
			sourcePath: displayPath(root, file),
		}));
	const analyzer = createModuleAnalyzer(root, {
		sourceByPath,
		log,
		schemaCandidateCountsByFile,
	});
	const result = analyzer.analyze(routes, schemaSymbolsByFile, schemaCandidateCountsByFile, schemaSources);
	return {
		...result,
		summary: {
			routeEntryCount: routes.length,
			analyzedRouteCount: routes.length,
			schemaSourceEntryCount: schemaSources.length,
			engineModuleCount: result.modules.length,
			localEngineModuleCount: result.modules.filter((module) => module.resolution === "local").length,
			externalEngineModuleCount: result.modules.filter((module) => module.resolution !== "local").length,
			modulePassTimeMs: Date.now() - startedAt,
		},
	};
}

module.exports = {
	SCHEMA_ENGINE_SYMBOLS,
	analyzeProjectModules,
	createResolver,
	engineAbbreviation,
	engineImportAlias,
	routeEntryFromFile,
};
