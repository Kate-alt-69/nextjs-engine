"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

function feedClock(clock, interval, count) {
	let now = 0;
	let timing = clock.step(now);
	for (let index = 0; index < count; index += 1) {
		now += interval;
		timing = clock.step(now);
	}
	return timing;
}

function main() {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-canvas-262-"));
	try {
		const sourcePath = path.join(process.cwd(), "src", "engine", "core", "enginecanvas", "ECFrameClock.ts");
		const outputPath = path.join(tempRoot, "ECFrameClock.js");
		transpile(sourcePath, outputPath);
		const {
			ECFrameClock,
			getAdaptiveFrameThresholds,
			resolveAdaptiveTargetFps,
		} = require(outputPath);

		const sixty = feedClock(new ECFrameClock(), 1000 / 60, 30);
		assert.ok(Math.abs(sixty.refreshRate - 60) <= 1, `expected ~60 Hz, got ${sixty.refreshRate}`);
		assert.ok(Math.abs(sixty.averageFps - 60) <= 1, `expected ~60 fps, got ${sixty.averageFps}`);

		const oneTwenty = feedClock(new ECFrameClock(), 1000 / 120, 48);
		assert.ok(Math.abs(oneTwenty.refreshRate - 120) <= 1, `expected ~120 Hz, got ${oneTwenty.refreshRate}`);
		assert.ok(Math.abs(oneTwenty.averageFps - 120) <= 2, `expected ~120 fps, got ${oneTwenty.averageFps}`);

		const oneFortyFour = feedClock(new ECFrameClock(), 1000 / 144, 48);
		assert.ok(Math.abs(oneFortyFour.refreshRate - 144) <= 1, `expected ~144 Hz, got ${oneFortyFour.refreshRate}`);

		const dropped = new ECFrameClock();
		let now = 0;
		dropped.step(now);
		for (let index = 0; index < 48; index += 1) {
			now += index % 3 === 0 ? 1000 / 60 : 1000 / 120;
			dropped.step(now);
		}
		const droppedTiming = dropped.step(now + 1000 / 120);
		assert.equal(droppedTiming.refreshRate, 120, "occasional dropped frames must not make a 120 Hz cadence look like 60 Hz");

		const thresholds120 = getAdaptiveFrameThresholds(120);
		assert.ok(60 < thresholds120.degradeBelow, "60 fps must count as degraded on a 120 Hz target");
		const thresholds60 = getAdaptiveFrameThresholds(60);
		assert.ok(60 > thresholds60.recoverAbove, "60 fps must count as healthy on a 60 Hz target");
		assert.equal(resolveAdaptiveTargetFps("display", 120), 120);
		assert.equal(resolveAdaptiveTargetFps(500, 60), 240, "explicit adaptive target must be clamped");

		const resumeClock = new ECFrameClock();
		resumeClock.step(100);
		const beforePause = resumeClock.step(108.333);
		resumeClock.discontinuity();
		const resumed = resumeClock.step(5000);
		assert.equal(resumed.delta, 0, "resume must not inject a giant hidden/offscreen delta");
		assert.equal(resumed.elapsed, beforePause.elapsed, "paused time must not advance active animation time");

		const coreSource = fs.readFileSync(path.join(process.cwd(), "src", "engine", "core", "enginecanvas", "EngineCanvas.tsx"), "utf8");
		assert.match(coreSource, /adaptiveTargetFps = "display"/, "EngineCanvas must target detected display cadence by default");
		assert.match(coreSource, /desynchronized = false/, "2D presentation must prefer synchronized rendering by default");
		assert.match(coreSource, /frameClock\.step\(now\)/, "EngineCanvas must use the refresh-aware frame clock");
		assert.doesNotMatch(coreSource, /lastFrameTime === 0 \? 16/, "EngineCanvas must not inject a fake 60 Hz first-frame delta");
		assert.match(coreSource, /draw\(context, canvas, delta, frame\+\+, timing\)/, "callback mode must expose stable elapsed timing metadata");

		console.log("EngineCanvas v2.6.2 high-refresh smoke tests passed");
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
