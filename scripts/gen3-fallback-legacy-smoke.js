"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToReadableStream } = require("react-dom/server");
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
	compileEngineFallbackPlan,
	compilePage,
	resolveEngineFallbackPlan,
} = require("../src/engine/compiler/index.ts");
const { EngineServerRenderer } = require("../src/engine/compiler/EngineServerRenderer.tsx");

function restoreTypeScriptLoaders() {
	if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
	else delete require.extensions[".ts"];
	if (previousTsxLoader) require.extensions[".tsx"] = previousTsxLoader;
	else delete require.extensions[".tsx"];
}

const schema = {
	meta: { title: "Phase D fallback compiler" },
	root: {
		type: "grid",
		name: "legacy-page",
		props: { columns: 2 },
		children: [
			{
				type: "text",
				name: "intro",
				props: { content: "Fallback proof" },
			},
			{
				type: "image",
				name: "preview",
				props: { src: "/preview.png", alt: "Preview" },
			},
			{
				type: "link",
				name: "animated-link",
				props: { href: "/next", transition: "fade" },
			},
			{
				type: "form",
				name: "search-form",
				children: [{ type: "input", props: { name: "query" } }],
			},
			{
				type: "canvas",
				name: "advanced-canvas",
				props: { mode: "webgl2", onDraw: "drawFallback" },
			},
		],
	},
};

const plan = compilePage(schema, { pageId: "/fallbacks" });
const fallbackFor = (feature) => plan.fallbackPlan.features.find((entry) => entry.feature === feature);

assert.deepEqual(
	fallbackFor("view-transitions").strategies.map(({ id }) => id),
	["native", "web-animations", "instant-navigation"],
	"animated navigation must compile native, WAAPI, and normal-navigation choices in priority order",
);
assert.deepEqual(
	fallbackFor("intersection-observer").strategies.map(({ id }) => id),
	["native", "eager-render"],
	"visibility scheduling must retain eager legacy rendering",
);
assert.deepEqual(
	fallbackFor("css-grid").strategies.map(({ id }) => id),
	["native", "normal-flow"],
	"CSS Grid must preserve structural content when grid layout is unavailable",
);
assert.deepEqual(
	fallbackFor("webgl2").strategies.map(({ id }) => id),
	["native"],
	"advanced APIs without a real fallback must not receive a fictional one",
);
assert.deepEqual(plan.fallbackPlan.legacy.preserves, [
	"html",
	"css",
	"text",
	"images",
	"links",
	"basic-form-structure",
]);
assert.deepEqual(
	plan.fallbackPlan.legacy.clientEnhancements.map(({ path }) => path),
	["root.2", "root.3", "root.3.0", "root.4"],
	"the legacy artifact must identify client-only enhancement boundaries without discarding their server content",
);

async function assertLegacyServerMarkup() {
	const stream = await renderToReadableStream(React.createElement(EngineServerRenderer, { schema, plan }));
	await stream.allReady;
	const serverMarkup = await new Response(stream).text();
	assert.match(serverMarkup, /Fallback proof/, "static text must survive server rendering");
	assert.match(serverMarkup, /href="\/next"/, "links must survive server rendering");
	assert.match(serverMarkup, /<form/, "basic form structure must survive a client-island boundary");
	assert.match(serverMarkup, /name="query"/, "nested form fields must remain in the server response");
}

const support = new Set(["dom", "request-animation-frame", "web-animations"]);
const resolved = resolveEngineFallbackPlan(plan.fallbackPlan, (feature) => support.has(feature));
const resolvedFor = (feature) => resolved.features.find((entry) => entry.feature === feature);
assert.equal(resolvedFor("view-transitions").status, "fallback");
assert.equal(resolvedFor("view-transitions").strategy.id, "web-animations");
assert.equal(resolvedFor("intersection-observer").strategy.id, "eager-render");
assert.equal(resolvedFor("css-grid").strategy.id, "normal-flow");
assert.equal(resolvedFor("webgl2").status, "unavailable");
assert.equal(resolvedFor("webgl2").strategy, null);

const instant = resolveEngineFallbackPlan(plan.fallbackPlan, (feature) => (
	feature === "dom" || feature === "request-animation-frame"
));
assert.equal(
	instant.features.find(({ feature }) => feature === "view-transitions").strategy.id,
	"instant-navigation",
	"normal navigation must remain usable without View Transitions and WAAPI",
);

const customWebGlPlan = compileEngineFallbackPlan(plan.featureManifest, plan.root, [{
	feature: "webgl2",
	fallbacks: [{
		id: "static-poster",
		kind: "rendering",
		requires: [],
		fidelity: "structural",
	}],
}]);
const customWebGl = resolveEngineFallbackPlan(customWebGlPlan, () => false)
	.features.find(({ feature }) => feature === "webgl2");
assert.equal(customWebGl.status, "fallback");
assert.equal(customWebGl.strategy.id, "static-poster");

const containerQueryPlan = compileEngineFallbackPlan({
	version: 1,
	pageId: plan.id,
	uses: [{
		feature: "container-queries",
		requiredBy: fallbackFor("css-grid").requiredBy,
	}],
}, plan.root);
assert.deepEqual(
	containerQueryPlan.features[0].strategies.map(({ id }) => id),
	["native", "media-query-layout", "normal-flow"],
	"container-query users must compile media-query compatibility output before structural normal flow",
);
assert.equal(
	resolveEngineFallbackPlan(containerQueryPlan, (feature) => feature === "media-queries").features[0].strategy.id,
	"media-query-layout",
);
assert.equal(
	resolveEngineFallbackPlan(containerQueryPlan, () => false).features[0].strategy.id,
	"normal-flow",
);
assert.equal(Object.isFrozen(plan.fallbackPlan), true);
assert.equal(Object.isFrozen(plan.fallbackPlan.features), true);
assert.equal(Object.isFrozen(fallbackFor("view-transitions").strategies), true);
assert.deepEqual(
	compilePage(schema, { pageId: "/fallbacks" }).fallbackPlan,
	plan.fallbackPlan,
	"unchanged pages must emit identical fallback and legacy artifacts",
);

const transitionsSource = fs.readFileSync(require.resolve("../src/engine/core/enginetransitions/EngineTransitions.ts"), "utf8");
const schedulerSource = fs.readFileSync(require.resolve("../src/engine/core/enginescheduler/EngineScheduler.ts"), "utf8");
const viewportSource = fs.readFileSync(require.resolve("../src/engine/core/EngineViewport.ts"), "utf8");
assert.match(transitionsSource, /runLegacyTransition/);
assert.match(transitionsSource, /typeof root\.animate !== "function"/);
assert.match(schedulerSource, /!\("IntersectionObserver" in window\)/);
assert.match(viewportSource, /visual\?\.width \?\? layoutWidth/);

assertLegacyServerMarkup()
	.then(() => console.log("Generation 3 fallback compiler and legacy rendering smoke: ok"))
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(restoreTypeScriptLoaders);
