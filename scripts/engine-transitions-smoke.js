"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function transpile(sourcePath, destinationPath) {
	const source = fs.readFileSync(sourcePath, "utf8");
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		reportDiagnostics: true,
		compilerOptions: {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: true,
		},
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	if (errors.length > 0) {
		throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
	}
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-transitions-smoke-"));
	try {
		const sourceRoot = path.join(process.cwd(), "src", "engine", "core", "enginetransitions");
		transpile(path.join(sourceRoot, "TransitionTypes.ts"), path.join(root, "TransitionTypes.js"));
		transpile(path.join(sourceRoot, "TransitionPresets.ts"), path.join(root, "TransitionPresets.js"));

		const { ENGINE_TRANSITIONS } = require(path.join(root, "TransitionTypes.js"));
		const {
			isKnownEngineTransition,
			normalizeEngineTransitionType,
			resolveEngineTransition,
		} = require(path.join(root, "TransitionPresets.js"));

		const expected = [
			"fade", "slide", "zoom", "morph", "layout", "reveal", "wipe", "split", "curtain", "pixel",
			"dissolve", "liquid", "smear", "depth", "flip", "page-turn", "spring", "scatter", "rgb", "portal",
		];
		assert.deepEqual(ENGINE_TRANSITIONS, expected);
		assert.equal(new Set(ENGINE_TRANSITIONS).size, 20);

		const aliases = {
			"page-to-page": "fade",
			scale: "zoom",
			"shared-morph": "morph",
			"flip-layout": "layout",
			"reveal-mask": "reveal",
			"pixel-dissolve": "pixel",
			"noise-dissolve": "dissolve",
			"liquid-warp": "liquid",
			"motion-smear": "smear",
			"depth-push": "depth",
			"card-flip": "flip",
			"elastic-spring": "spring",
			"scatter-assemble": "scatter",
			"chromatic-shift": "rgb",
		};
		for (const [alias, target] of Object.entries(aliases)) {
			assert.equal(isKnownEngineTransition(alias), true);
			assert.equal(normalizeEngineTransitionType(alias), target);
		}

		assert.equal(normalizeEngineTransitionType("does-not-exist"), "fade");
		assert.equal(isKnownEngineTransition("does-not-exist"), false);
		assert.equal(resolveEngineTransition("instant").duration, 0);
		assert.equal(resolveEngineTransition({ type: "fade", duration: -50 }).duration, 0);
		assert.equal(resolveEngineTransition({ type: "fade", duration: 9000 }).duration, 5000);

		const portal = resolveEngineTransition({ type: "portal", origin: "pointer" }, { pointer: { x: 123.4, y: 456.6 } });
		assert.equal(portal.cssVariables["--e-vt-origin"], "123px 457px");

		const pixel = resolveEngineTransition({ type: "pixel", config: { pixelSize: 8 } });
		assert.equal(pixel.pixelated, true);
		assert.match(pixel.easing, /^steps\(/);

		const shared = resolveEngineTransition({ type: "morph", shared: ["hero", "hero", " card ", ""] });
		assert.deepEqual(shared.shared, ["hero", "card"]);

		const slideRight = resolveEngineTransition({ type: "slide", direction: "right", config: { distance: 100 } });
		assert.equal(slideRight.cssVariables["--e-vt-old-x"], "-100px");
		assert.equal(slideRight.cssVariables["--e-vt-new-x"], "100px");

		for (const transitionName of ENGINE_TRANSITIONS) {
			const resolved = resolveEngineTransition(transitionName);
			assert.equal(resolved.type, transitionName);
			assert.equal(typeof resolved.cssVariables["--e-vt-old-animation"], "string");
			assert.equal(typeof resolved.cssVariables["--e-vt-new-animation"], "string");
			assert.ok(resolved.duration >= 0 && resolved.duration <= 5000);
		}

		console.log("EngineTransitions preset smoke tests passed");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
