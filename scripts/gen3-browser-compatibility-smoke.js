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

const { compilePage } = require("../src/engine/compiler/EngineCompiler.ts");
const {
	detectEngineBrowserFeature,
	engineFallbackPlanNeedsCompatibilityCheck,
	evaluateEngineBrowserCompatibility,
} = require("../src/engine/core/EngineBrowserCompatibility.ts");

if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

const fallbackPage = compilePage({
	meta: { title: "Reasonable compatibility fallbacks" },
	root: {
		type: "grid",
		children: [{
			type: "link",
			props: { href: "/next", transition: "fade", content: "Next" },
		}],
	},
}, { pageId: "/fallback" });
let checkedFeatures = 0;
const fallbackReport = evaluateEngineBrowserCompatibility(fallbackPage.fallbackPlan, () => {
	checkedFeatures += 1;
	return false;
});
assert.equal(fallbackReport.updateRecommended, false);
assert.deepEqual(fallbackReport.issues, []);
assert.equal(engineFallbackPlanNeedsCompatibilityCheck(fallbackPage.fallbackPlan), false);
assert.ok(checkedFeatures > 0, "used native capabilities and their fallback requirements must be evaluated");
assert.equal(
	fallbackReport.resolved.features.find(({ feature }) => feature === "view-transitions").strategy.id,
	"instant-navigation",
);

const advancedPage = compilePage({
	meta: { title: "Blocking compatibility feature" },
	root: {
		type: "canvas",
		props: { mode: "webgl2", onDraw: "compatibilityProof" },
	},
}, { pageId: "/advanced" });
const advancedReport = evaluateEngineBrowserCompatibility(
	advancedPage.fallbackPlan,
	(feature) => feature !== "webgl2",
);
assert.equal(engineFallbackPlanNeedsCompatibilityCheck(advancedPage.fallbackPlan), true);
assert.equal(advancedReport.updateRecommended, true);
assert.deepEqual(advancedReport.issues.map(({ feature }) => feature), ["webgl2"]);
assert.deepEqual(advancedReport.issues[0].requiredBy.map(({ path }) => path), ["root"]);
assert.equal(advancedReport.issues[0].reason, "unsupported-without-fallback");
assert.equal(Object.isFrozen(advancedReport), true);
assert.equal(Object.isFrozen(advancedReport.issues), true);
assert.equal(Object.isFrozen(advancedReport.issues[0]), true);

const legacyPlan = {
	...advancedPage.fallbackPlan,
	features: advancedPage.fallbackPlan.features.map(({ importance: _importance, ...feature }) => feature),
};
assert.equal(
	engineFallbackPlanNeedsCompatibilityCheck(legacyPlan),
	true,
	"plans without importance metadata must fail safe as required",
);
assert.equal(evaluateEngineBrowserCompatibility(legacyPlan, () => false).updateRecommended, true);

const optionalPage = compilePage({
	meta: { title: "Optional decorative capability" },
	root: {
		type: "canvas",
		compatibility: "optional",
		props: { mode: "webgl2", onDraw: "decorativeProof" },
	},
}, { pageId: "/optional" });
const optionalReport = evaluateEngineBrowserCompatibility(optionalPage.fallbackPlan, () => false);
assert.equal(optionalPage.fallbackPlan.features.every(({ importance }) => importance === "optional"), true);
assert.equal(engineFallbackPlanNeedsCompatibilityCheck(optionalPage.fallbackPlan), false);
assert.equal(optionalReport.updateRecommended, false, "optional decorative features must never trigger the dialog");

const mixedPage = compilePage({
	meta: { title: "Mixed capability importance" },
	root: {
		type: "box",
		children: [
			{
				type: "canvas",
				compatibility: "optional",
				props: { mode: "webgl2", onDraw: "decorativeProof" },
			},
			{
				type: "canvas",
				props: { mode: "webgl2", onDraw: "requiredProof" },
			},
		],
	},
}, { pageId: "/mixed" });
assert.equal(
	mixedPage.fallbackPlan.features.find(({ feature }) => feature === "webgl2").importance,
	"required",
	"one required source must keep a shared feature important",
);

const staticPage = compilePage({
	meta: { title: "No browser capabilities" },
	root: { type: "text", props: { content: "Static" } },
}, { pageId: "/static" });
let irrelevantChecks = 0;
const staticReport = evaluateEngineBrowserCompatibility(staticPage.fallbackPlan, () => {
	irrelevantChecks += 1;
	return false;
});
assert.equal(staticReport.updateRecommended, false);
assert.equal(irrelevantChecks, 0, "features absent from the page manifest must never be probed");

const fakeRuntime = {
	CSS: {
		supports: (property, value) => property === "display" && value === "grid",
	},
	Element: { prototype: { animate() {} } },
	IntersectionObserver: function IntersectionObserver() {},
	document: {
		createElement: () => ({
			getContext: (context) => context === "2d" ? {} : null,
		}),
		startViewTransition() {},
	},
	matchMedia() {},
	requestAnimationFrame() {},
};
assert.equal(detectEngineBrowserFeature("dom", fakeRuntime), true);
assert.equal(detectEngineBrowserFeature("canvas", fakeRuntime), true);
assert.equal(detectEngineBrowserFeature("webgl2", fakeRuntime), false);
assert.equal(detectEngineBrowserFeature("view-transitions", fakeRuntime), true);
assert.equal(detectEngineBrowserFeature("web-animations", fakeRuntime), true);
assert.equal(detectEngineBrowserFeature("css-grid", fakeRuntime), true);
assert.equal(detectEngineBrowserFeature("container-queries", fakeRuntime), false);
assert.equal(detectEngineBrowserFeature("unregistered-future-api", fakeRuntime), false);

const dialogSource = fs.readFileSync(require.resolve("../src/engine/components/EngineCompatibilityDialog.tsx"), "utf8");
const createPageSource = fs.readFileSync(require.resolve("../src/engine/createPage.tsx"), "utf8");
assert.match(dialogSource, /Browser update recommended/);
assert.match(dialogSource, /Some features used by this site are not fully supported/);
for (const action of ["Leave", "Continue", "Update"]) {
	assert.match(dialogSource, new RegExp(`>${action}<`));
}
assert.match(dialogSource, /sessionStorage/);
assert.match(dialogSource, /role="alertdialog"/);
assert.match(createPageSource, /engineFallbackPlanNeedsCompatibilityCheck/);
assert.match(createPageSource, /<EngineCompatibilityDialog plan=/);

console.log("Generation 3 browser compatibility dialog smoke: ok");
