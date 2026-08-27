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

		const timeline = new EngineScrollTimeline({ start: 10, end: 40, source: "current" });
		let frame = timeline.snapshot();
		assert.equal(frame.rawProgress, 0.5);
		assert.equal(frame.progress, 0.5);
		assert.equal(frame.active, true);
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
			{ at: 0.5, value: 50 },
		]);
		assert.equal(standaloneTrack.sample(0.5), 50);

		let emissions = 0;
		const unsubscribe = timeline.subscribe(() => { emissions += 1; }, false);
		state.viewport.current = 40;
		runtime.notify();
		assert.equal(emissions, 1);
		runtime.notify();
		assert.equal(emissions, 1);
		unsubscribe();

		const crossingTimeline = new EngineScrollTimeline({ start: 0, end: 100, source: "current" });
		state.viewport.current = 25;
		const crossings = [];
		const activity = [];
		const stopCross = crossingTimeline.onCross(0.5, (event) => crossings.push([event.at, event.direction]));
		const stopEnter = crossingTimeline.onEnter((event) => activity.push([event.type, event.boundary, event.direction]));
		const stopLeave = crossingTimeline.onLeave((event) => activity.push([event.type, event.boundary, event.direction]));
		state.viewport.current = 60;
		runtime.notify();
		state.viewport.current = 120;
		runtime.notify();
		state.viewport.current = 40;
		runtime.notify();
		assert.deepEqual(crossings, [[0.5, 1], [0.5, -1]]);
		assert.deepEqual(activity, [["leave", "end", 1], ["enter", "end", -1]]);
		stopCross();
		stopEnter();
		stopLeave();

		state.viewport.current = 20;
		const snapshotSafe = new EngineScrollTimeline({ start: 0, end: 100, source: "current" });
		let snapshotCrossings = 0;
		const stopSnapshotCross = snapshotSafe.onCross(0.5, () => { snapshotCrossings += 1; });
		state.viewport.current = 60;
		snapshotSafe.snapshot();
		runtime.notify();
		assert.equal(snapshotCrossings, 1);
		stopSnapshotCross();

		state.viewport.current = 25;
		const styleCalls = [];
		const styleElement = {
			style: {
				setProperty(property, value) { styleCalls.push(["set", property, value]); },
				removeProperty(property) { styleCalls.push(["remove", property]); },
			},
		};
		const stopBinding = timeline.bindStyles(styleElement, {
			opacity: [0, 1],
			"--hero-y": { from: 80, to: 0, unit: "px" },
		});
		assert.deepEqual(styleCalls.slice(0, 2), [
			["set", "opacity", "0.5"],
			["set", "--hero-y", "40px"],
		]);
		const callCount = styleCalls.length;
		runtime.notify();
		assert.equal(styleCalls.length, callCount);
		stopBinding();

		const previousWindow = global.window;
		global.window = { scrollY: 0, innerHeight: 100 };
		state.page.pointSpacing = 1;
		state.page.totalPoints = 100;
		const elementAt = (top) => ({
			isConnected: true,
			getBoundingClientRect() { return { top, bottom: top + 10, height: 10 }; },
		});
		EngineScrollPointManager.clear();
		EngineScrollPointManager.register("intro", 10, elementAt(10), { group: ["slides", "chapters", "slides"] });
		EngineScrollPointManager.register("details", 30, elementAt(30), { group: "chapters" });
		EngineScrollPointManager.register("demo", 50, elementAt(50), { group: "slides" });
		assert.deepEqual(EngineScrollPointManager.groups(), ["chapters", "slides"]);
		assert.deepEqual(EngineScrollPointManager.names("slides"), ["intro", "demo"]);
		assert.equal(EngineScrollPointManager.nearest(42, "slides").name, "demo");
		assert.equal(EngineScrollPointManager.next(10, false, "chapters").name, "details");
		assert.equal(EngineScrollPointManager.previous(40, false, "slides").name, "intro");
		EngineScrollPointManager.clear();
		global.window = previousWindow;

		const originalNearest = EngineScrollPointManager.nearest;
		const originalResolve = EngineScrollPointManager.resolve;
		const originalMove = EngineScrollMovement.move;
		let snappedPoint = null;
		let snappedGroup = null;
		EngineScrollPointManager.nearest = (_reference, group) => {
			snappedGroup = group;
			return { name: "snap", point: 22 };
		};
		EngineScrollPointManager.resolve = () => ({
			name: "snap", point: 22, element: {}, align: "start", offset: 0, groups: ["slides"],
		});
		EngineScrollMovement.move = (point) => { snappedPoint = point; };
		state.viewport.top = 20;
		assert.equal(EngineScrollSnap.now({ threshold: 3, group: "slides" }), true);
		assert.equal(snappedGroup, "slides");
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
