"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-server-first-parity-smoke");

function read(relativePath) {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function compileStyleRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/compiler/EngineStyleCompiler.ts",
		"--outDir", outDir,
		"--rootDir", "src/engine",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--jsx", "react-jsx",
		"--esModuleInterop",
		"--skipLibCheck",
		"--incremental", "false",
	], {
		cwd: repoRoot,
		stdio: "inherit",
	});
}

function loadCompilerRuntime() {
	const previousTsLoader = require.extensions[".ts"];
	require.extensions[".ts"] = (module, filename) => {
		const source = fs.readFileSync(filename, "utf8");
		const output = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
				esModuleInterop: true,
			},
			fileName: filename,
		}).outputText;
		module._compile(output, filename);
	};
	try {
		return require("../src/engine/compiler/EngineCompiler.ts");
	} finally {
		if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
		else delete require.extensions[".ts"];
	}
}

try {
	compileStyleRuntime();

	const { StyleCollector } = require(path.join(outDir, "core", "StyleCollector.js"));
	const {
		compileCpropClass,
		compileEngineStyles,
		compilePrimitiveStyles,
		compileStaticStyleClass,
	} = require(path.join(outDir, "compiler", "EngineStyleCompiler.js"));

	const collector = new StyleCollector();
	const resolved = compileEngineStyles({
		sides: [1, 3],
		sideDistance: 16,
		sideType: "padding",
		animation: "engine-fade 1s linear",
		gridColumn: "1 / span 2",
		mixBlendMode: "screen",
		scrollSnapAlign: "center",
		transform: { xs: "scale(1)", md: "scale(1.1)" },
	}, collector, {
		color: "red",
		"@media(min-width: 800px)": { color: "blue" },
		"@keyframes engine-fade": {
			from: { opacity: 0 },
			to: { opacity: 1 },
		},
	});

	assert.equal(resolved.paddingTop, "1rem", "server compiler should honor sides padding");
	assert.equal(resolved.paddingRight, "1rem", "server compiler should honor the right-side selector");
	assert.equal(resolved.animation, "engine-fade 1s linear", "server compiler should preserve animation props");
	assert.equal(resolved.gridColumn, "1 / span 2", "server compiler should preserve grid placement");
	assert.equal(resolved.mixBlendMode, "screen", "server compiler should preserve blend modes");
	assert.equal(resolved.scrollSnapAlign, "center", "server compiler should preserve scroll-snap props");
	assert.match(String(resolved.transform), /^var\(/, "responsive passthrough props should compile to CSS variables");
	assert.match(String(resolved.color), /^var\(/, "explicit at-rule styles should keep an inline CSS-variable binding");

	const collectedCss = collector.collect();
	assert.match(collectedCss, /@media\(min-width:\s*800px\)\{:root\{--e-at-/, "style media rules should survive server compilation regardless of harmless whitespace");
	assert.match(collectedCss, /@keyframes engine-fade\{from\{opacity:0\}to\{opacity:1\}\}/, "keyframes should retain frame selectors");

	const precedenceCollector = new StyleCollector();
	const primitive = compilePrimitiveStyles(
		{ background: "blue", color: "white" },
		precedenceCollector,
		{
			defaults: { background: "red", color: "black" },
			derived: { background: "green" },
			style: { background: "purple" },
			runtime: { opacity: 0.5 },
		},
	);
	assert.equal(primitive.background, "purple", "explicit style must beat defaults, derived state, and schema props");
	assert.equal(primitive.color, "white", "schema props must beat component defaults");
	assert.equal(primitive.opacity, 0.5, "required runtime state must remain the final style layer");

	const focusCollector = new StyleCollector();
	const focusClass = compileCpropClass({ onFocus: { color: "red" } }, focusCollector);
	assert.ok(focusClass, "focus cprop should produce a class");
	assert.match(
		focusCollector.collect(),
		new RegExp(`\\.${focusClass}:focus,\\.${focusClass}:focus-visible\\{color:red\\}`),
		"server/client focus cprop must support both focus and focus-visible",
	);

	const nestedCollector = new StyleCollector();
	const nestedClass = compileStaticStyleClass({
		color: "black",
		"@media(min-width: 700px)": {
			color: "blue",
			"@supports(display:grid)": { display: "grid" },
		},
	}, nestedCollector);
	assert.match(
		nestedCollector.collect(),
		new RegExp(`@media\\(min-width: 700px\\)\\{\\.${nestedClass}\\{color:blue\\}@supports\\(display:grid\\)\\{\\.${nestedClass}\\{display:grid\\}\\}\\}`),
		"nested at-rules must keep the generated selector",
	);

	const { compilePage, findCompiledNode } = loadCompilerRuntime();
	const slotPlan = compilePage({
		meta: { title: "slot fallback parity" },
		root: {
			type: "slot",
			name: "shell-slot",
			props: {
				name: "content",
				fallback: {
					type: "canvas",
					name: "fallback-canvas",
					props: { mode: "webgl2" },
				},
			},
		},
	}, { security: "off" });
	const fallbackCanvas = findCompiledNode(slotPlan, "fallback-canvas");
	assert.ok(fallbackCanvas, "slot fallback schema must be compiled into the Gen 3 graph");
	assert.equal(fallbackCanvas.path, "root.fallback", "slot fallback should have a stable compiler path");
	assert.equal(fallbackCanvas.runtime, "client", "fallback runtime classification must be preserved");
	assert.ok(slotPlan.capabilities.includes("webgl2"), "fallback capabilities must reach the page feature manifest");
	assert.ok(slotPlan.assets.some((asset) => asset.ownerNodeId === fallbackCanvas.id), "fallback assets must reach the page asset graph");

	const serverRenderer = read("src/engine/compiler/EngineServerRenderer.tsx");
	assert.match(serverRenderer, /compilePrimitiveStyles/, "server renderer should use primitive style precedence");
	assert.match(serverRenderer, /normalizeStackDirection/, "server renderer should preserve responsive stack direction");
	assert.match(serverRenderer, /compiled\.children\[0\]/, "server slot rendering should use the compiled fallback branch");
	assert.doesNotMatch(serverRenderer, /fallback\.children as ReactNode/, "server slots must never render raw schema children as React nodes");
	assert.match(serverRenderer, /<button key=\{compiled\.id\}/, "non-interactive buttons should remain server-rendered");
	assert.match(serverRenderer, /suppressHydrationWarning/, "server generated styles should opt out of text reconciliation");
	assert.doesNotMatch(serverRenderer, /precedence="engine"/, "server generated styles must not become React managed stylesheet resources");

	const hookSource = read("src/engine/hooks/usePropStyles.ts");
	assert.match(hookSource, /EngineStyleCompiler/, "client style hooks should use the shared deterministic compiler");
	assert.doesNotMatch(hookSource, /CSS_PASSTHROUGH/, "client hooks must not carry a second copy of the style compiler");

	const providerSource = read("src/engine/providers/EngineProvider.tsx");
	assert.match(providerSource, /suppressHydrationWarning/, "client collected styles should keep hydration reconciliation safe");
	assert.doesNotMatch(providerSource, /precedence="engine"/, "client collected styles must not become React managed stylesheet resources");

	const collectorSource = read("src/engine/core/StyleCollector.ts");
	assert.match(collectorSource, /suppressHydrationWarning/, "global generated styles should keep hydration reconciliation safe");
	assert.doesNotMatch(collectorSource, /precedence:\s*"engine-global"/, "global generated styles must not become React managed stylesheet resources");

	console.log("Generation 3 server-first parity smoke: ok");
} finally {
	fs.rmSync(outDir, { recursive: true, force: true });
}
