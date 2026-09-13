"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

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

const {
	compileEngineUsedFeatureManifest,
	compilePage,
} = require("../src/engine/compiler/index.ts");

if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

const schema = {
	meta: { title: "Phase D compatibility manifest" },
	root: {
		type: "grid",
		name: "results-grid",
		props: { columns: 2 },
		children: [
			{
				type: "canvas",
				name: "primary-canvas",
				props: { mode: "webgl2" },
			},
			{
				type: "canvas",
				name: "secondary-canvas",
				props: { mode: "webgl2" },
			},
			{
				type: "link",
				name: "animated-link",
				props: { href: "/next", transition: "fade" },
			},
			{
				type: "link",
				name: "ordinary-link",
				props: { href: "/plain" },
			},
		],
	},
};

const plan = compilePage(schema, { pageId: "/products" });
const usedNames = plan.featureManifest.uses.map(({ feature }) => feature);
assert.deepEqual(usedNames, [
	"canvas",
	"css-grid",
	"dom",
	"intersection-observer",
	"request-animation-frame",
	"view-transitions",
	"webgl2",
], "the feature manifest must be stable and contain only actually used capabilities");
assert.deepEqual(plan.capabilities, usedNames, "the compatibility capability list must derive from the manifest");

for (const irrelevant of ["clipboard", "media", "speech", "visual-viewport", "webgpu"]) {
	assert.equal(usedNames.includes(irrelevant), false, `${irrelevant} must stay absent when the page does not use it`);
}

const grid = plan.featureManifest.uses.find(({ feature }) => feature === "css-grid");
assert.deepEqual(grid.requiredBy, [{
	nodeId: plan.root.id,
	path: "root",
	nodeType: "grid",
	runtime: "static",
}], "static CSS features must retain their exact compiler source");

const webgl = plan.featureManifest.uses.find(({ feature }) => feature === "webgl2");
assert.deepEqual(webgl.requiredBy.map(({ path }) => path), ["root.0", "root.1"]);
assert.equal(Object.isFrozen(plan.featureManifest), true);
assert.equal(Object.isFrozen(plan.featureManifest.uses), true);
assert.equal(Object.isFrozen(webgl.requiredBy), true);

const rebuilt = compilePage(schema, { pageId: "/products" });
assert.deepEqual(rebuilt.featureManifest, plan.featureManifest, "unchanged pages must emit identical feature manifests");
assert.deepEqual(
	compileEngineUsedFeatureManifest(plan.id, plan.root),
	plan.featureManifest,
	"the standalone compatibility compiler must reproduce the plan artifact",
);

console.log("Generation 3 used-feature manifest smoke: ok");
