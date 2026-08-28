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
			"EngineScrollPointTracker.ts",
			"EngineScrollAnimation.ts",
			"EngineScrollMovement.ts",
			"EngineScrollHash.ts",
			"EngineScrollNavigator.ts",
			"EngineScrollRange.ts",
			"EngineScrollTimelineTrack.ts",
			"EngineScrollTimelineBinding.ts",
			"EngineScrollTimeline.ts",
			"EngineScrollDirector.ts",
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
		const { EngineScrollRange } = require(path.join(root, "EngineScrollRange.js"));
		const { EngineScrollTimeline } = require(path.join(root, "EngineScrollTimeline.js"));
		const { EngineScrollDirector } = require(path.join(root, "EngineScrollDirector.js"));
		const { EngineScrollTimelineTrack } = require(path.join(root, "EngineScrollTimelineTrack.js"));
		const { EngineScrollSnap } = require(path.join(root, "EngineScrollSnap.js"));
		const { EngineScrollPointManager } = require(path.join(root, "EngineScrollPointManager.js"));
		const { EngineScrollPointTracker } = require(path.join(root, "EngineScrollPointTracker.js"));
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

		const range = new EngineScrollRange({ start: 10, end: 40 });
		let rangeFrame = range.snapshot();
		assert.equal(rangeFrame.valid, true);
		assert.equal(rangeFrame.startPoint, 10);
		assert.equal(rangeFrame.endPoint, 40);
		assert.equal(rangeFrame.span, 30);
		assert.equal(rangeFrame.direction, 1);
		assert.equal(range.pointAt(0.5), 25);
		assert.equal(range.pointAt(2), 40);
		assert.equal(range.pointAt(2, false), 70);
		assert.equal(range.progressAt(25), 0.5);
		assert.equal(range.progressAt(55), 1);
		assert.equal(range.progressAt(55, false), 1.5);
		assert.equal(range.contains(25), true);
		assert.equal(range.contains(50), false);

		const reversedRange = new EngineScrollRange({ start: 80, end: 20 });
		rangeFrame = reversedRange.snapshot();
		assert.equal(rangeFrame.direction, -1);
		assert.equal(reversedRange.pointAt(0.25), 65);
		assert.equal(reversedRange.progressAt(50), 0.5);
		assert.equal(reversedRange.contains(50), true);

		const zeroRangeGeometry = new EngineScrollRange({ start: 50, end: 50 });
		assert.equal(zeroRangeGeometry.rawProgressAt(49), -1);
		assert.equal(zeroRangeGeometry.rawProgressAt(50), 1);
		assert.equal(zeroRangeGeometry.rawProgressAt(51), 2);

		const timeline = new EngineScrollTimeline({ start: 10, end: 40, source: "current" });
		let frame = timeline.snapshot();
		assert.equal(frame.rawProgress, 0.5);
		assert.equal(frame.progress, 0.5);
		assert.equal(frame.active, true);
		assert.equal(timeline.segment(0.25, 0.75), 0.5);
		assert.equal(timeline.pointAt(0.5), range.pointAt(0.5));
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

		const originalRuntimeSubscribe = runtime.subscribe;
		let directorRuntimeSubscriptions = 0;
		let directorRuntimeUnsubscriptions = 0;
		runtime.subscribe = function directorSubscribe(callback) {
			directorRuntimeSubscriptions += 1;
			const stop = originalRuntimeSubscribe.call(this, callback);
			return () => {
				directorRuntimeUnsubscriptions += 1;
				stop();
			};
		};

		state.viewport.current = 10;
		const director = new EngineScrollDirector({
			hero: { start: 0, end: 50, source: "current" },
			features: { start: 50, end: 100, source: "current" },
		});
		assert.equal(director.size, 2);
		assert.deepEqual(director.names(), ["hero", "features"]);
		assert.equal(director.has("hero"), true);
		assert.equal(director.has("missing"), false);
		assert.equal(director.pointAt("hero", 0.5), 25);

		const directorFrames = [];
		const heroFrames = [];
		const featureFrames = [];
		const directorCrossings = [];
		const directorActivity = [];
		const stopDirector = director.subscribe((directorFrame) => {
			directorFrames.push([...directorFrame.changed]);
		}, false);
		const stopHeroTrack = director.subscribeTrack("hero", (trackFrame) => {
			heroFrames.push(trackFrame.progress);
		}, false);
		const stopFeatureTrack = director.subscribeTrack("features", (trackFrame) => {
			featureFrames.push(trackFrame.progress);
		}, false);
		const stopDirectorCross = director.onCross("hero", 0.5, (event) => {
			directorCrossings.push([event.at, event.direction]);
		});
		const stopFeatureEnter = director.onEnter("features", (event) => {
			directorActivity.push([event.type, "features", event.boundary, event.direction]);
		});
		const stopHeroLeave = director.onLeave("hero", (event) => {
			directorActivity.push([event.type, "hero", event.boundary, event.direction]);
		});
		assert.equal(directorRuntimeSubscriptions, 1);

		state.viewport.current = 30;
		director.snapshot();
		runtime.notify();
		state.viewport.current = 75;
		runtime.notify();
		state.viewport.current = 80;
		runtime.notify();
		assert.deepEqual(directorFrames, [
			["hero"],
			["hero", "features"],
			["features"],
		]);
		assert.deepEqual(heroFrames, [0.6, 1]);
		assert.deepEqual(featureFrames, [0.5, 0.6]);
		assert.deepEqual(directorCrossings, [[0.5, 1]]);
		assert.deepEqual(directorActivity, [
			["enter", "features", "start", 1],
			["leave", "hero", "end", 1],
		]);

		const directorStyleCalls = [];
		const directorStyleElement = {
			style: {
				setProperty(property, value) { directorStyleCalls.push(["set", property, value]); },
				removeProperty(property) { directorStyleCalls.push(["remove", property]); },
			},
		};
		const stopDirectorBinding = director.bindStyles("features", directorStyleElement, {
			opacity: [0, 1],
		});
		assert.deepEqual(directorStyleCalls[0], ["set", "opacity", "0.6"]);
		assert.equal(directorRuntimeSubscriptions, 1);
		state.viewport.current = 90;
		runtime.notify();
		assert.deepEqual(directorStyleCalls.at(-1), ["set", "opacity", "0.8"]);

		stopDirector();
		stopHeroTrack();
		stopFeatureTrack();
		stopDirectorCross();
		stopFeatureEnter();
		stopHeroLeave();
		stopDirectorBinding();
		assert.equal(directorRuntimeUnsubscriptions, 1);
		director.dispose();
		runtime.subscribe = originalRuntimeSubscribe;

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
		EngineScrollPointManager.register("pricing", 70, elementAt(70), { group: "chapters" });
		assert.deepEqual(EngineScrollPointManager.groups(), ["chapters", "slides"]);
		assert.deepEqual(EngineScrollPointManager.names("slides"), ["intro", "demo"]);
		assert.equal(EngineScrollPointManager.nearest(42, "slides").name, "demo");
		assert.equal(EngineScrollPointManager.next(10, false, "chapters").name, "details");
		assert.equal(EngineScrollPointManager.previous(40, false, "slides").name, "intro");

		let location = EngineScrollPointManager.locate(5, "chapters");
		assert.equal(location.current, null);
		assert.equal(location.next.name, "intro");
		assert.equal(location.index, -1);
		assert.equal(location.count, 3);
		location = EngineScrollPointManager.locate(20, "chapters");
		assert.equal(location.current.name, "intro");
		assert.equal(location.next.name, "details");
		assert.equal(location.progress, 0.5);
		location = EngineScrollPointManager.locate(35, "chapters");
		assert.equal(location.current.name, "details");
		assert.equal(location.next.name, "pricing");
		assert.equal(location.progress, 0.125);

		const namedRange = new EngineScrollRange({ start: "#intro", end: "#pricing" });
		assert.equal(namedRange.pointAt(0.5), 40);
		assert.equal(namedRange.progressAt(25), 0.25);

		state.viewport.current = 20;
		const pointTracker = new EngineScrollPointTracker({ group: "chapters", source: "current" });
		assert.equal(pointTracker.snapshot().current.name, "intro");
		assert.equal(pointTracker.snapshot().progress, 0.5);
		let trackerFrames = 0;
		const pointChanges = [];
		const stopTracker = pointTracker.subscribe(() => { trackerFrames += 1; }, false);
		const stopPointChanges = pointTracker.onChange((trackerFrame, previousPoint) => {
			pointChanges.push([previousPoint?.name ?? null, trackerFrame.current?.name ?? null]);
		});
		state.viewport.current = 35;
		runtime.notify();
		runtime.notify();
		state.viewport.current = 75;
		pointTracker.snapshot();
		runtime.notify();
		assert.equal(trackerFrames, 2);
		assert.deepEqual(pointChanges, [["intro", "details"], ["details", "pricing"]]);
		stopTracker();
		stopPointChanges();
		pointTracker.dispose();

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

		let rangeMovedPoint = null;
		EngineScrollMovement.move = (point) => { rangeMovedPoint = point; };
		const movableRange = new EngineScrollRange({ start: 10, end: 30 });
		assert.equal(movableRange.moveTo(0.5, { duration: 0 }), true);
		assert.equal(rangeMovedPoint, 20);

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
