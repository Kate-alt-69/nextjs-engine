"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".react-compat-smoke");

function transpile(sourcePath, destinationPath) {
	const source = fs.readFileSync(sourcePath, "utf8");
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		reportDiagnostics: true,
		compilerOptions: {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: true,
			jsx: ts.JsxEmit.ReactJSX,
		},
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	if (errors.length > 0) {
		throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
	}
	fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function main() {
	fs.rmSync(outDir, { recursive: true, force: true });
	try {
		const collectorOutput = path.join(outDir, "StyleCollector.js");
		transpile(path.join(repoRoot, "src", "engine", "core", "StyleCollector.ts"), collectorOutput);
		const { StyleCollector } = require(collectorOutput);

		const left = new StyleCollector();
		left.add(".z{color:red}");
		left.add(":root{--a:1}");
		left.add(".a{color:blue}");
		const right = new StyleCollector();
		right.add(".a{color:blue}");
		right.add(".z{color:red}");
		right.add(":root{--a:1}");
		assert.equal(
			left.collect(),
			right.collect(),
			"StyleCollector output must not depend on React traversal/insertion order",
		);
		assert.ok(left.collect().startsWith(":root{--a:1}"), "root variables should retain the low precedence group");

		const providerSource = fs.readFileSync(path.join(repoRoot, "src", "engine", "providers", "EngineProvider.tsx"), "utf8");
		assert.match(providerSource, /existing\?\.textContent/, "client hydration should adopt the server style snapshot");
		assert.match(providerSource, /styleCollector\.subscribe/, "dynamic client styles should flush after hydration");

		const navSource = fs.readFileSync(path.join(repoRoot, "src", "engine", "components", "EngineNav.tsx"), "utf8");
		assert.match(navSource, /currentPath\.startsWith\(`\$\{targetPath\}\/`\)/, "nav matching must require a route-segment boundary");
		assert.match(navSource, /useEffect\(\(\) => setPathname\(routerPathname\)/, "pathname-dependent nav styling must wait until hydration completes");

		const overlaySource = fs.readFileSync(path.join(repoRoot, "src", "engine", "components", "EngineOverlay", "OverlayShared.tsx"), "utf8");
		assert.match(overlaySource, /usePortalTarget/, "overlay portals should resolve after mount");
		assert.match(overlaySource, /\[options\.lockScroll, options\.open\]/, "live scroll-lock changes need an independent lifecycle");

		console.log("React/Next compatibility smoke tests passed");
	} finally {
		fs.rmSync(outDir, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
