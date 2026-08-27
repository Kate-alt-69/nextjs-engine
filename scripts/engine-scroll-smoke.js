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
	const errors = (result.diagnostics || []).filter(
		(diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
	);
	if (errors.length > 0) {
		throw new Error(errors.map(
			(diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
		).join("\n"));
	}
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-scroll-smoke-"));
	try {
		const sourceRoot = path.join(process.cwd(), "src", "engine", "core", "enginescroll");
		const files = [
			"EngineScrollTypes.ts",
			"EngineScrollState.ts",
			"EngineScrollRuntime.ts",
			"EngineScrollEasing.ts",
			"EngineScrollPointManager.ts",
			"EngineScrollAnimation.ts",
			"EngineScrollMovement.ts",
			"EngineScrollHash.ts",
			"EngineScrollNavigator.ts",
			"EngineScrollTimelineTrack.ts",
			"EngineScrollTimelineBinding.ts",
			"EngineScrollTimeline.ts",
			"EngineScrollSnap.ts",
			"EngineScrollPhysics.ts",
		];
		for (const filename of files) {
			transpile(
				path.join(sourceRoot, filename),
				path.join(root, filename.replace(/\.ts$/, ".js")),
			);
		}
		fs.mkdirSync(path.join(root, "browser"), { recursive: true });
		transpile(
			path.join(sourceRoot, "browser", "BrowserScheduler.ts"),
			path.join(root, "browser", "BrowserScheduler.js"),
		);

		const { EngineScrollRuntime } = require(path.join(root, "EngineScrollRuntime.js"));
		const { EngineScrollTimeline } = require(path.join(root, "EngineScrollTimeline.js"));
		const { EngineScrollTimelineTrack } = require(path.join(root, "EngineScrollTimelineTrack.js"));
		const { EngineScrollSnap } = require(path.join(root, "EngineScrollSnap.js"));
		const { EngineScrollPointManager } = require(path.join(root, "EngineScrollPointManager.js"));
		const { EngineScrollMovement } = require(path.join(root, "EngineScrollMovement.js"));
		const { EngineScrollPhysics } = require(path.join(root, "EngineScrollPhysics.js"));
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const cache = runtime.getCache();
		state.page.totalPoints = 100;
		state.viewport.top = 20;
		state.viewport.current = 25;
		state.viewport.bottom = 30;
		cache.scrollDirection = 1;
		cache.scrollVelocity = 0.25;

		const timeline = new EngineScrollTimeline({
			start: 10,
			end: 40,
			source: "current",
		});
		let frame = timeline.snapshot();
		assert.equal(frame.rawProgress, 0.5);
		assert.equal(frame.progress, 0.5);
		assert.equal(frame.active, true);
		assert.equal(frame.direction, 1);
		assert.equal(frame.velocity, 0.25);
		assert.equal(timeline.value(0, 200), 100);
		assert.equal(timeline.pointAt(0), 10);
		assert.equal(timeline.pointAt(0.5), 25);
		assert.equal(timeline.pointAt(1), 40);
		assert.equal(timeline.segment(0.25, 0.75), 0.5);

		const track = timeline.track([
			{ at: 0, value: 0, easing: "linear" },
			{ at: 0.5, value: 100, easing: "linear" },
			{ at: 1, value: 0 },
		]);
		assert.equal(track.value(), 100);
		assert.equal(track.sample(0.75), 50);

		const standaloneTrack = new EngineScrollTimelineTrack([
			{ at: 1, value: 100 },
			{ at: 0, value: 0 },
			{ at: 0.5, value: 40 },
			{ at: 0.5, value: 50 },
		]);
		assert.equal(standaloneTrack.sample(0.5), 50);
		assert.equal(standaloneTrack.sample(-1), 0);
		assert.equal(standaloneTrack.sample(2), 100);
		assert.throws(
			() => new EngineScrollTimelineTrack([]),
			/at least one keyframe/,
		);

		let emissions = 0;
		const unsubscribe = timeline.subscribe(() => {
			emissions += 1;
		}, false);
		state.viewport.current = 40;
		runtime.notify();
		frame = timeline.snapshot();
		assert.equal(frame.progress, 1);
		assert.equal(frame.after, false);
		assert.equal(emissions, 1);
		runtime.notify();
		assert.equal(emissions, 1);
		unsubscribe();

		const eased = new EngineScrollTimeline({
			start: 0,
			end: 100,
			source: "top",
			easing: "easeInQuad",
		});
		state.viewport.top = 50;
		assert.equal(eased.snapshot().progress, 0.25);
		state.viewport.top = 120;
		assert.equal(eased.snapshot().progress, 1);
		assert.equal(eased.snapshot().after, true);

		const zeroRange = new EngineScrollTimeline({
			start: 50,
			end: 50,
			source: "top",
		});
		state.viewport.top = 49;
		assert.equal(zeroRange.snapshot().before, true);
		state.viewport.top = 50;
		assert.equal(zeroRange.snapshot().progress, 1);
		assert.equal(zeroRange.snapshot().active, true);
		state.viewport.top = 51;
		assert.equal(zeroRange.snapshot().after, true);

		state.viewport.current = 25;
		const styleCalls = [];
		const styleElement = {
			style: {
				setProperty(property, value) {
					styleCalls.push(["set", property, value]);
				},
				removeProperty(property) {
					styleCalls.push(["remove", property]);
				},
			},
		};
		const stopBinding = timeline.bindStyles(styleElement, {
			opacity: [0, 1],
			"--hero-y": {
				from: 80,
				to: 0,
				unit: "px",
			},
			"--hero-scale": {
				keyframes: [
					{ at: 0, value: 0.9 },
					{ at: 1, value: 1 },
				],
				precision: 3,
			},
		});
		assert.deepEqual(styleCalls.slice(0, 3), [
			["set", "opacity", "0.5"],
			["set", "--hero-y", "40px"],
			["set", "--hero-scale", "0.95"],
		]);
		const callCount = styleCalls.length;
		runtime.notify();
		assert.equal(styleCalls.length, callCount);
		stopBinding();

		const originalNearest = EngineScrollPointManager.nearest;
		const originalResolve = EngineScrollPointManager.resolve;
		const originalMove = EngineScrollMovement.move;
		let snappedPoint = null;
		EngineScrollPointManager.nearest = () => ({ name: "snap", point: 22 });
		EngineScrollPointManager.resolve = () => ({
			name: "snap",
			point: 22,
			element: {},
			align: "start",
			offset: 0,
		});
		EngineScrollMovement.move = (point) => {
			snappedPoint = point;
		};
		state.viewport.top = 20;
		assert.equal(EngineScrollSnap.now({ threshold: 3 }), true);
		assert.equal(snappedPoint, 22);
		assert.equal(EngineScrollSnap.now({ threshold: 1 }), false);
		EngineScrollPointManager.nearest = originalNearest;
		EngineScrollPointManager.resolve = originalResolve;
		EngineScrollMovement.move = originalMove;

		state.viewport.current = 75;
		cache.scrollVelocity = 99;
		cache.scrollDirection = 1;
		EngineScrollPhysics.update(16);
		assert.equal(cache.scrollVelocity, 0);
		assert.equal(cache.scrollDirection, 0);

		console.log("EngineScroll core smoke tests passed");
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
