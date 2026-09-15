"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const previousTsLoader = require.extensions[".ts"];
const previousTsxLoader = require.extensions[".tsx"];
const loadTypeScript = (module, filename) => {
	const source = fs.readFileSync(filename, "utf8");
	const output = ts.transpileModule(source, {
		compilerOptions: {
			jsx: ts.JsxEmit.ReactJSX,
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
			esModuleInterop: true,
		},
		fileName: filename,
	}).outputText;
	module._compile(output, filename);
};
require.extensions[".ts"] = loadTypeScript;
require.extensions[".tsx"] = loadTypeScript;

const {
	createEngineBrowserSupportResolver,
	resolveEngineBrowserCompatibility,
} = require("../src/engine/core/enginecompatibility/EngineBrowserCompatibility.ts");
const { EngineCompatibilityDialog } = require("../src/engine/core/enginecompatibility/EngineCompatibilityDialog.tsx");

function restoreTypeScriptLoaders() {
	if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
	else delete require.extensions[".ts"];
	if (previousTsxLoader) require.extensions[".tsx"] = previousTsxLoader;
	else delete require.extensions[".tsx"];
}

const source = {
	nodeId: "compat-source",
	path: "root",
	nodeType: "canvas",
	runtime: "client",
};
const plan = {
	version: 1,
	pageId: "/compatibility-dialog",
	features: [
		{
			feature: "view-transitions",
			requiredBy: [source],
			strategies: [
				{ id: "native", kind: "native", requires: ["view-transitions"], fidelity: "full" },
				{ id: "web-animations", kind: "runtime", requires: ["web-animations"], fidelity: "close" },
			],
		},
		{
			feature: "webgl2",
			requiredBy: [source],
			strategies: [{ id: "native", kind: "native", requires: ["webgl2"], fidelity: "full" }],
		},
	],
	legacy: {
		mode: "best-effort",
		preserves: ["html", "css", "text"],
		clientEnhancements: [source],
	},
};

try {
	const support = {
		"view-transitions": false,
		"web-animations": true,
		webgl2: false,
	};
	const resolved = resolveEngineBrowserCompatibility(plan, support);
	assert.equal(resolved.features[0].status, "fallback");
	assert.equal(resolved.features[0].strategy.id, "web-animations");
	assert.equal(resolved.features[1].status, "unavailable");
	assert.equal(resolved.features[1].strategy, null);

	const resolver = createEngineBrowserSupportResolver({ "custom-capability": true });
	assert.equal(resolver("custom-capability"), true, "applications must be able to define custom capability support");
	assert.equal(resolver("missing-custom-capability"), false, "unknown capabilities must never produce fictional support");

	assert.equal(
		renderToStaticMarkup(React.createElement(EngineCompatibilityDialog, { plan, support })),
		"",
		"the server render must remain empty until real browser support is evaluated after hydration",
	);

	const probeSource = fs.readFileSync(
		require.resolve("../src/engine/core/enginecompatibility/EngineBrowserCompatibility.ts"),
		"utf8",
	);
	assert.doesNotMatch(
		probeSource,
		/from ["'][^"']*EngineBrowser(?:Safe)?["']/,
		"the compatibility probe must not pull the full browser interaction runtime into the dialog bundle",
	);

	console.log("Generation 3 browser compatibility dialog smoke: ok");
} finally {
	restoreTypeScriptLoaders();
}
