"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { analyzeProjectModules, SCHEMA_ENGINE_SYMBOLS } = require("./gen3ModuleCompiler");
const nencLogger = require("./nencTerminalLogger");

const BUILTIN_NODE_TYPES = new Set([
	"box", "stack", "grid", "text", "heading", "markdown", "image", "video",
	"section", "hero", "card", "button", "link", "nav", "manim", "manim3d",
	"spacer", "divider", "slot", "canvas", "scroll", "custom-select", "suspense",
	"option", "optgroup", "dialog", "drawer", "popover", "form", "input",
	"textarea", "checkbox", "label", "EngineLink", "EngineNav", "EngineManim",
	"EngineManim3D", "EngineDialog", "EngineDrawer", "EnginePopover",
]);
const SCAN_ROOTS = ["app", "pages", "src/app", "src/pages", "components", "src/components", "src/example"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

function displayPath(root, target) {
	return path.relative(root, target).split(path.sep).join("/") || ".";
}
function isWithin(root, target) {
	const rel = path.relative(root, target);
	return rel === "" || (rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel));
}
function listSourceFiles(projectRoot) {
	const files = [];
	const visited = new Set();
	function visit(directory) {
		const resolved = path.resolve(directory);
		if (visited.has(resolved) || !isWithin(projectRoot, resolved) || !fs.existsSync(resolved)) return;
		visited.add(resolved);
		const stat = fs.statSync(resolved);
		if (stat.isFile()) {
			if (SOURCE_EXTENSIONS.has(path.extname(resolved))) files.push(resolved);
			return;
		}
		if (!stat.isDirectory()) return;
		for (const entry of fs.readdirSync(resolved, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (["node_modules", ".next", "dist", ".git", ".nextjs-engine"].includes(entry.name) || entry.name.startsWith(".")) continue;
			if (entry.isDirectory()) visit(path.join(resolved, entry.name));
			else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(path.join(resolved, entry.name));
		}
	}
	for (const relative of SCAN_ROOTS) visit(path.join(projectRoot, relative));
	return [...new Set(files)].sort();
}
function propertyName(property) {
	const name = property && property.name;
	return name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) ? name.text : undefined;
}
function callName(node) {
	if (!node || !ts.isCallExpression(node)) return undefined;
	if (ts.isIdentifier(node.expression)) return node.expression.text;
	if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
	return undefined;
}
function unwrap(node) {
	let current = node;
	while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)
		|| ts.isTypeAssertionExpression(current) || ts.isSatisfiesExpression(current)
		|| ts.isNonNullExpression(current))) current = current.expression;
	return current;
}
function collectVariables(sourceFile) {
	const vars = new Map();
	function visit(node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			vars.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return vars;
}
function staticValue(expression, vars, seen = new Set()) {
	const node = unwrap(expression);
	if (!node) return { ok: false, reason: "missing expression" };
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return { ok: true, value: node.text };
	if (ts.isNumericLiteral(node)) return { ok: true, value: Number(node.text) };
	if (node.kind === ts.SyntaxKind.TrueKeyword) return { ok: true, value: true };
	if (node.kind === ts.SyntaxKind.FalseKeyword) return { ok: true, value: false };
	if (node.kind === ts.SyntaxKind.NullKeyword) return { ok: true, value: null };
	if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
		return { ok: true, value: -Number(node.operand.text) };
	}
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
		return { ok: true, value: function engineBuildFunctionPlaceholder() {} };
	}
	if (ts.isArrayLiteralExpression(node)) {
		const output = [];
		for (const item of node.elements) {
			if (ts.isSpreadElement(item)) return { ok: false, reason: "array spreads are dynamic" };
			const result = staticValue(item, vars, seen);
			if (!result.ok) return result;
			output.push(result.value);
		}
		return { ok: true, value: output };
	}
	if (ts.isObjectLiteralExpression(node)) {
		const output = {};
		for (const property of node.properties) {
			if (ts.isSpreadAssignment(property)) return { ok: false, reason: "object spreads are dynamic" };
			if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
				return { ok: false, reason: "object methods/accessors are dynamic" };
			}
			const name = propertyName(property);
			if (name === undefined) return { ok: false, reason: "computed property names are dynamic" };
			let initializer;
			if (ts.isPropertyAssignment(property)) initializer = property.initializer;
			else if (ts.isShorthandPropertyAssignment(property)) initializer = property.name;
			else return { ok: false, reason: "unsupported property " + name };
			const result = staticValue(initializer, vars, seen);
			if (!result.ok) return { ok: false, reason: "property " + name + ": " + result.reason };
			output[name] = result.value;
		}
		return { ok: true, value: output };
	}
	if (ts.isIdentifier(node)) {
		if (node.text === "undefined") return { ok: true, value: undefined };
		if (node.text === "NaN") return { ok: true, value: Number.NaN };
		if (seen.has(node.text)) return { ok: false, reason: "cyclic value " + node.text };
		const initializer = vars.get(node.text);
		if (!initializer) return { ok: false, reason: "identifier " + node.text + " is not a local static value" };
		const next = new Set(seen);
		next.add(node.text);
		return staticValue(initializer, vars, next);
	}
	if (ts.isCallExpression(node)) {
		const name = callName(node);
		if (["defineSchema", "freezeSchema", "createSchema"].includes(name)
			|| (ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText() === "Object" && name === "freeze")) {
			return node.arguments.length ? staticValue(node.arguments[0], vars, seen) : { ok: false, reason: name + " has no argument" };
		}
		return { ok: false, reason: "call to " + (name || "expression") + " is dynamic" };
	}
	if (ts.isPropertyAccessExpression(node)) return { ok: false, reason: "property access " + node.getText() + " is dynamic" };
	return { ok: false, reason: "unsupported expression " + (ts.SyntaxKind[node.kind] || "unknown") };
}
function objectProperty(objectExpression, name) {
	const object = unwrap(objectExpression);
	if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
	for (const property of object.properties) {
		if (propertyName(property) !== name) continue;
		if (ts.isPropertyAssignment(property)) return property.initializer;
		if (ts.isShorthandPropertyAssignment(property)) return property.name;
	}
	return undefined;
}
function routePathForFile(root, file) {
	const rel = displayPath(root, file);
	const parts = rel.split("/");
	const rootIndex = parts.findIndex((part, index) =>
		(part === "app" || part === "pages") && (index === 0 || parts[index - 1] === "src"));
	if (rootIndex < 0) return "/" + rel.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
	const kind = parts[rootIndex];
	let route = parts.slice(rootIndex + 1);
	if (kind === "pages") {
		const last = route[route.length - 1] || "";
		if (/^index\./.test(last)) route = route.slice(0, -1);
		else route[route.length - 1] = last.replace(/\.(tsx?|jsx?|mts|cts)$/, "");
		if (route[route.length - 1] === "index") route = route.slice(0, -1);
	} else route = route.slice(0, -1);
	route = route.filter((part) => part && !/^\(.+\)$/.test(part) && !part.startsWith("@"));
	return ("/" + route.join("/")).replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}
function schemaCandidates(sourceFile, vars) {
	const candidates = [];
	function visit(node) {
		if (ts.isCallExpression(node) && callName(node) === "createPage" && node.arguments.length) {
			const options = unwrap(node.arguments[0]);
			if (ts.isObjectLiteralExpression(options)) {
				const expr = objectProperty(options, "schema");
				if (expr) candidates.push({ result: staticValue(expr, vars) });
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(sourceFile);
	return candidates.filter(({ result }) => result.ok && result.value && typeof result.value === "object"
		&& result.value.root && typeof result.value.root.type === "string");
}
function registeredCustomTypes(sourceFiles, sourceByPath = new Map()) {
	const types = new Set();
	for (const file of sourceFiles) {
		const source = sourceByPath.get(path.resolve(file))
			|| ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
		function visit(node) {
			if (ts.isCallExpression(node) && callName(node) === "registerComponent" && node.arguments.length) {
				const first = unwrap(node.arguments[0]);
				if ((ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) && !BUILTIN_NODE_TYPES.has(first.text)) types.add(first.text);
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	return [...types].sort();
}
function walkNodes(node, visit) {
	if (!node || typeof node !== "object") return;
	if (typeof node.type === "string") visit(node);
	if (Array.isArray(node.children)) for (const child of node.children) walkNodes(child, visit);
}
function dispatchTerminalLog(message) {
	nencLogger.dispatchCompilerLine(message);
}
function logEvent(event, logger = dispatchTerminalLog) {
	if (event.phase === "node" && event.customComponent) {
		logger("COMPILING CUSTOM COMPONENT : " + event.nodeType + " (" + (event.sourcePath || event.pageId)
			+ ":" + (event.nodePath || "root") + ")");
	} else if (event.phase === "page-cache-hit") {
		logger("DONE REUSING CACHED ENGINE SCHEMA : " + (event.sourcePath || event.pageId));
	} else if (event.phase === "page-complete" && event.summary) {
		const s = event.summary;
		logger("DONE COMPILED ENGINE SCHEMA : " + (event.sourcePath || event.pageId) + " — " + s.totalNodes
			+ " nodes, " + s.clientIslands + " client islands, " + s.assetCount + " assets");
	}
}
function readBannerAsset(fileName) {
	const assetPath = path.join(__dirname, "banner", fileName);
	let sourceText;
	try {
		sourceText = fs.readFileSync(assetPath, "utf8");
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error("Could not load Generation 3 banner asset "
			+ path.relative(__dirname, assetPath).split(path.sep).join("/") + ": " + reason);
	}
	sourceText = sourceText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
	if (sourceText.endsWith("\n")) sourceText = sourceText.slice(0, -1);
	return sourceText ? sourceText.split("\n") : [];
}

// Keep the established exports while treating the text files as the source of truth.
const ASCII_WORDMARK = Object.freeze(readBannerAsset("wordmark.txt"));
const BOTTOM_TEXT = Object.freeze(readBannerAsset("bottom-text.txt"));

function bannerMarkerPath(projectRoot) {
	const resolvedRoot = path.resolve(projectRoot);
	const key = require("node:crypto").createHash("sha256").update(resolvedRoot).digest("hex").slice(0, 24);
	return path.join(require("node:os").tmpdir(), "nextjs-engine-gen3-banner-" + key + ".lock");
}

function renderBannerLines(wordmark = ASCII_WORDMARK, bottomText = BOTTOM_TEXT) {
	const sourceLines = [
		...wordmark,
		...(wordmark.length > 0 && bottomText.length > 0 ? [""] : []),
		...bottomText,
	];
	const contentWidth = sourceLines.reduce((width, line) => Math.max(width, line.length), 0);
	const center = (line) => {
		const left = Math.floor((contentWidth - line.length) / 2);
		return " ".repeat(left) + line + " ".repeat(contentWidth - left - line.length);
	};
	const innerWidth = contentWidth + 4;
	return [
		"╭" + "─".repeat(innerWidth) + "╮",
		...sourceLines.map((line) => "│  " + center(line) + "  │"),
		"╰" + "─".repeat(innerWidth) + "╯",
	];
}

function printBanner(logger = console.log) {
	for (const line of renderBannerLines()) logger(line);
}

function printBannerOnce(projectRoot, logger = console.log) {
	const marker = bannerMarkerPath(projectRoot);
	for (let attempt = 0; attempt < 2; attempt++) {
		let descriptor;
		try {
			descriptor = fs.openSync(marker, "wx");
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
			let stale = false;
			try { stale = Date.now() - fs.statSync(marker).mtimeMs > 60 * 60 * 1000; }
			catch (statError) { if (statError.code === "ENOENT") continue; throw statError; }
			if (!stale) return false;
			try { fs.unlinkSync(marker); }
			catch (unlinkError) { if (unlinkError.code === "ENOENT") continue; return false; }
			continue;
		}
		try { fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), "utf8"); }
		catch (error) {
			try { fs.closeSync(descriptor); } catch { /* Preserve the original error. */ }
			try { fs.rmSync(marker, { force: true }); } catch { /* Preserve the original error. */ }
			throw error;
		}
		fs.closeSync(descriptor);
		try { printBanner(logger); }
		catch (error) { releaseBanner(projectRoot); throw error; }
		return true;
	}
	return false;
}

function releaseBanner(projectRoot) {
	try { fs.rmSync(bannerMarkerPath(projectRoot), { force: true }); }
	catch { /* Cleanup must not hide the build outcome. */ }
}

function installTypeScriptRequireHook() {
	if (require.extensions[".ts"] && require.extensions[".ts"].__engineBuildHook) return;
	const handler = function engineTypeScriptBuildHook(module, filename) {
		const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
			fileName: filename,
		}).outputText;
		module._compile(output, filename);
	};
	handler.__engineBuildHook = true;
	require.extensions[".ts"] = handler;
}
function readVersion(root) {
	try { return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version || "unknown"; }
	catch { return "unknown"; }
}
function compileProject(projectRoot, options = {}) {
	const passStartedAt = Date.now();
	const log = typeof options.log === "function" ? options.log : dispatchTerminalLog;
	const resolvedRoot = path.resolve(projectRoot);
	log("SCANNING PROJECT SOURCES : " + displayPath(resolvedRoot, resolvedRoot));
	const files = listSourceFiles(resolvedRoot);
	const sourceByPath = new Map();
	const candidatesByFile = new Map();
	const schemaSymbolsByFile = new Map();
	const schemaCandidateCountsByFile = new Map();

	function collectSchemaModules(node, symbols) {
		if (!node || typeof node !== "object") return;
		if (typeof node.type === "string" && SCHEMA_ENGINE_SYMBOLS[node.type]) {
			symbols.add(SCHEMA_ENGINE_SYMBOLS[node.type]);
		}
		if (Array.isArray(node.children)) for (const child of node.children) collectSchemaModules(child, symbols);
		if (node.type === "slot" && node.props && node.props.fallback && typeof node.props.fallback === "object") {
			collectSchemaModules(node.props.fallback, symbols);
		}
	}

	for (const file of files) {
		const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
			(file.endsWith(".tsx") || file.endsWith(".jsx")) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
		sourceByPath.set(file, source);
		const candidates = schemaCandidates(source, collectVariables(source));
		candidatesByFile.set(file, candidates);
		if (candidates.length > 0) {
			const symbols = new Set();
			for (const candidate of candidates) collectSchemaModules(candidate.result.value.root, symbols);
			schemaSymbolsByFile.set(file, symbols);
			schemaCandidateCountsByFile.set(file, candidates.length);
		}
	}

	const moduleAnalysis = analyzeProjectModules(resolvedRoot, {
		files,
		sourceByPath,
		log,
		schemaSymbolsByFile,
		schemaCandidateCountsByFile,
	});
	const registered = registeredCustomTypes(files, sourceByPath);
	installTypeScriptRequireHook();
	const compilePage = require(path.join(__dirname, "../compiler/EngineCompiler.ts")).compilePage;
	const pages = [];
	const skipped = [];
	let candidateCount = 0;

	for (const file of files) {
		const relative = displayPath(projectRoot, file);
		const source = sourceByPath.get(file);
		const candidates = candidatesByFile.get(file) || [];
		if (candidates.length === 0) {
			if (/(^|\/)(page|index)\.(tsx?|jsx?)$/.test(relative) && source.text.includes("createPage")) {
				skipped.push({
					sourcePath: relative,
					pageId: routePathForFile(projectRoot, file),
					reason: "No statically resolvable Engine schema was found. Next.js retains normal runtime rendering for this route.",
				});
				log("SKIPPING STATIC SCHEMA PLAN : " + relative
					+ " — Next.js still compiles and renders the route normally");
			}
			continue;
		}

		const routeId = routePathForFile(projectRoot, file);
		for (let index = 0; index < candidates.length; index++) {
			candidateCount += 1;
			const pageId = candidates.length === 1 ? routeId : routeId + "#schema-" + (index + 1);
			const plan = compilePage(candidates[index].result.value, {
				pageId,
				sourcePath: relative,
				customComponentTypes: registered,
				onProgress: (event) => logEvent(event, log),
			});
			const custom = new Set();
			const compiledNodes = [];
			walkNodes(plan.root, (node) => {
				if (node.customComponent || !BUILTIN_NODE_TYPES.has(String(node.type))) custom.add(String(node.type));
				compiledNodes.push({
					id: node.id,
					path: node.path,
					type: String(node.type),
					...(node.name ? { name: node.name } : {}),
					depth: node.depth,
					runtime: node.runtime,
					runtimeReason: node.runtimeReason,
					workClass: node.workClass,
					workReason: node.workReason,
					capabilities: [...node.capabilities],
					heavy: node.heavy,
					interactive: node.interactive,
					customComponent: Boolean(node.customComponent),
					children: node.children.map((child) => child.id),
					assets: node.assets.map(({ kind, workClass, priority }) => ({ kind, workClass, priority })),
				});
			});
			pages.push({
				id: plan.id,
				sourcePath: relative,
				summary: plan.summary,
				compiledNodes,
				customComponents: [...custom].sort(),
				assets: plan.assets.map(({ kind, workClass, priority }) => ({ kind, workClass, priority })),
				capabilities: [...plan.capabilities].sort(),
				fallbackFeatures: plan.fallbackPlan.features.map(({ feature, importance, strategies }) => ({
					feature, importance, strategies: strategies.map(({ id, kind, fidelity }) => ({ id, kind, fidelity })),
				})),
				diagnostics: plan.diagnostics.map(({ level, code, message, path: nodePath }) => ({
					level, code, message, ...(nodePath ? { path: nodePath } : {}),
				})),
			});
		}
	}

	const summary = {
		scannedSourceFileCount: files.length,
		routeEntryCount: moduleAnalysis.summary.routeEntryCount,
		analyzedRouteCount: moduleAnalysis.summary.analyzedRouteCount,
		engineModuleCount: moduleAnalysis.summary.engineModuleCount,
		localEngineModuleCount: moduleAnalysis.summary.localEngineModuleCount,
		externalEngineModuleCount: moduleAnalysis.summary.externalEngineModuleCount,
		schemaSourceEntryCount: moduleAnalysis.summary.schemaSourceEntryCount,
		modulePassTimeMs: moduleAnalysis.summary.modulePassTimeMs,
		schemaCandidateCount: candidateCount,
		compiledPageCount: pages.length,
		compiledSchemaPageCount: pages.length,
		skippedPageCount: skipped.length,
		customComponentTypeCount: new Set(registered.concat(...pages.map((page) => page.customComponents))).size,
		compilerPassTimeMs: Date.now() - passStartedAt,
	};
	log("DONE COMPILER PASS — " + summary.analyzedRouteCount + " route entries analyzed, "
		+ summary.compiledSchemaPageCount + " Engine schema plans, " + summary.engineModuleCount + " Engine modules in "
		+ summary.compilerPassTimeMs + "ms");

	return {
		schemaVersion: 2,
		generation: 3,
		compiler: "nextjs-engine",
		compilerVersion: readVersion(projectRoot),
		scannedSourceFiles: files.map((file) => displayPath(projectRoot, file)),
		routes: moduleAnalysis.routes,
		schemaSources: moduleAnalysis.schemaSources,
		modules: moduleAnalysis.modules,
		registeredCustomComponents: registered,
		pages,
		skipped,
		summary,
	};
}
function atomicWriteJson(target, value) {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	const temp = path.join(path.dirname(target), ".compiler-manifest-" + process.pid + "-" + Date.now() + ".tmp");
	try {
		fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
		fs.renameSync(temp, target);
	} catch (error) {
		try { fs.rmSync(temp, { force: true }); } catch { /* Keep original error. */ }
		throw error;
	}
}
function resolveDistDir(projectRoot) {
	if (process.env.NEXTJS_ENGINE_BUILD_DIR) return process.env.NEXTJS_ENGINE_BUILD_DIR;
	const file = path.join(projectRoot, "next.config.js");
	if (fs.existsSync(file)) {
		const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		let value;
		function visit(node) {
			if (ts.isPropertyAssignment(node) && propertyName(node) === "distDir"
				&& (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) value = node.initializer.text;
			ts.forEachChild(node, visit);
		}
		visit(source);
		if (value) return value;
	}
	return ".next";
}
function summarizeNextOutputs(context = {}) {
	const outputs = context && context.outputs && typeof context.outputs === "object" ? context.outputs : null;
	if (!outputs) return undefined;
	const outputKinds = [
		"appPages",
		"appRoutes",
		"pages",
		"pagesApi",
		"prerenders",
		"staticFiles",
	];
	const counts = {};
	const paths = {};
	const routePathnames = new Set();
	for (const kind of outputKinds) {
		const entries = outputs[kind];
		if (!Array.isArray(entries)) continue;
		counts[kind] = entries.length;
		if (kind === "staticFiles") continue;
		const pathnames = entries
			.map((entry) => entry && typeof entry.pathname === "string" ? entry.pathname : undefined)
			.filter(Boolean)
			.sort();
		paths[kind] = pathnames;
		if (["appPages", "appRoutes", "pages", "pagesApi"].includes(kind)) {
			for (const pathname of pathnames) routePathnames.add(pathname.replace(/\.rsc$/, ""));
		}
	}
	const normalizedRoutePaths = [...routePathnames].sort();
	return {
		nextVersion: typeof context.nextVersion === "string" ? context.nextVersion : null,
		buildId: typeof context.buildId === "string" ? context.buildId : null,
		counts,
		paths,
		routeOutputCount: normalizedRoutePaths.length,
		routePaths: normalizedRoutePaths,
	};
}
function emitArtifacts(projectRoot, inputPath, distDir, buildContext = {}) {
	const root = path.resolve(projectRoot);
	const manifest = JSON.parse(fs.readFileSync(inputPath, "utf8"));
	const nextBuild = summarizeNextOutputs(buildContext);
	if (nextBuild) {
		manifest.nextBuild = nextBuild;
		manifest.summary = manifest.summary || {};
		manifest.summary.nextOutputCounts = nextBuild.counts;
	}
	const outputRoot = path.resolve(root, distDir || resolveDistDir(root));
	if (!isWithin(root, outputRoot) || outputRoot === root) throw new Error("Refusing to emit compiler artifacts outside the project build directory.");
	const outputDir = path.join(outputRoot, "nextjs-engine");
	if (!isWithin(outputRoot, outputDir)) throw new Error("Unsafe Next.js Engine output directory.");
	const outputFile = path.join(outputDir, "compiler-manifest.json");
	atomicWriteJson(outputFile, manifest);
	nencLogger.done("EMITTED " + displayPath(root, outputFile) + " after Next.js build succeeded");
	if (nextBuild) {
		const labels = [
			["appPages", "App pages"],
			["appRoutes", "App route handlers / metadata"],
			["pages", "Pages Router pages"],
			["pagesApi", "Pages API routes"],
			["prerenders", "prerenders"],
			["staticFiles", "static files"],
		];
		const parts = labels
			.filter(([key]) => Number.isInteger(nextBuild.counts[key]))
			.map(([key, label]) => nextBuild.counts[key] + " " + label);
		if (parts.length) nencLogger.done("INDEXED NEXT.JS BUILD OUTPUTS — "
			+ nextBuild.routeOutputCount + " unique route paths; " + parts.join(", "));
	}
	return outputFile;
}
function parseArgs(argv) {
	const args = { mode: "scan", adapterWorker: false };
	for (let i = 0; i < argv.length; i++) {
		const item = argv[i];
		if (item === "--scan") args.mode = "scan";
		else if (item === "--emit") args.mode = "emit";
		else if (item === "--adapter-worker") args.adapterWorker = true;
		else if (item === "--output") args.output = argv[++i];
		else if (item === "--input") args.input = argv[++i];
		else if (item === "--project-root") args.projectRoot = argv[++i];
		else if (item === "--dist-dir") args.distDir = argv[++i];
		else throw new Error("Unknown argument: " + item);
	}
	return args;
}
function runCLI(argv = process.argv.slice(2)) {
	let bannerOwner = false;
	let bannerRoot;
	try {
		const args = parseArgs(argv);
		const root = path.resolve(args.projectRoot || process.cwd());
		bannerRoot = root;
		if (args.mode === "scan") {
			if (!args.output) throw new Error("--scan requires --output <temporary-json-path>");
			if (!args.adapterWorker) {
				bannerOwner = printBannerOnce(root);
				if (bannerOwner) nencLogger.setStatus("STARTING GENERATION 3 COMPILER PASS ALONGSIDE NEXT.JS");
			}
			const manifest = compileProject(root);
			nencLogger.setStatus("WRITING COMPILER MANIFEST");
			atomicWriteJson(path.resolve(args.output), manifest);
			nencLogger.done("COMPILER MANIFEST WRITTEN — " + manifest.summary.compiledPageCount
				+ " pages, " + manifest.summary.customComponentTypeCount + " custom component types");
		} else {
			if (!args.input) throw new Error("--emit requires --input <compiler-manifest>");
			emitArtifacts(root, path.resolve(args.input), args.distDir);
		}
		return 0;
	} catch (error) {
		nencLogger.failed(error instanceof Error ? error.message : String(error));
		return 1;
	} finally {
		nencLogger.clearStatus();
		if (bannerOwner && bannerRoot) releaseBanner(bannerRoot);
	}
}
if (require.main === module) process.exitCode = runCLI();
module.exports = {
	BUILTIN_NODE_TYPES,
	compileProject,
	emitArtifacts,
	logEvent,
	ASCII_WORDMARK,
	BOTTOM_TEXT,
	summarizeNextOutputs,
	bannerMarkerPath,
	printBanner,
	printBannerOnce,
	releaseBanner,
	renderBannerLines,
	resolveDistDir,
	routePathForFile,
	runCLI,
};
