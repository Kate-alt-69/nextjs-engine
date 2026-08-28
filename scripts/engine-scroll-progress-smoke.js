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

function createStyleElement(calls) {
	return {
		style: {
			setProperty(property, value) {
				calls.push(["set", property, value]);
			},
			removeProperty(property) {
				calls.push(["remove", property]);
			},
		},
	};
}

function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-scroll-progress-smoke-"));
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
			"EngineScrollRange.ts",
			"EngineScrollTimelineTrack.ts",
			"EngineScrollTimelineBinding.ts",
			"EngineScrollTimeline.ts",
			"EngineScrollDirector.ts",
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
		const { EngineScrollEasing } = require(path.join(root, "EngineScrollEasing.js"));
		const { EngineScrollTimeline } = require(path.join(root, "EngineScrollTimeline.js"));
		const { EngineScrollDirector } = require(path.join(root, "EngineScrollDirector.js"));
		const { bindEngineScrollTimelineStyles } = require(path.join(root, "EngineScrollTimelineBinding.js"));
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const cache = runtime.getCache();
		state.page.totalPoints = 150;
		state.viewport.top = 0;
		state.viewport.current = 10;
		state.viewport.bottom = 20;
		cache.scrollDirection = 1;
		cache.scrollVelocity = 0.25;

		const originalResolve = EngineScrollEasing.resolve;
		let easingResolveCalls = 0;
		EngineScrollEasing.resolve = function countedResolve(name) {
			easingResolveCalls += 1;
			return originalResolve.call(this, name);
		};

		const originalSubscribe = runtime.subscribe;
		let runtimeSubscriptions = 0;
		let runtimeUnsubscriptions = 0;
		runtime.subscribe = function countedSubscribe(callback) {
			runtimeSubscriptions += 1;
			const stop = originalSubscribe.call(this, callback);
			return () => {
				runtimeUnsubscriptions += 1;
				stop();
			};
		};

		const timeline = new EngineScrollTimeline({
			start: 50,
			end: 100,
			source: "current",
			easing: "easeOutCubic",
		});
		assert.equal(easingResolveCalls, 1);

		let fullFrames = 0;
		let progressFrames = 0;
		const stopFull = timeline.subscribe(() => {
			fullFrames += 1;
		}, false);
		const stopProgress = timeline.subscribeProgress(() => {
			progressFrames += 1;
		}, false);
		assert.equal(runtimeSubscriptions, 1);

		state.viewport.current = 20;
		runtime.notify();
		assert.equal(fullFrames, 1);
		assert.equal(progressFrames, 0);

		cache.scrollVelocity = 1;
		runtime.notify();
		assert.equal(fullFrames, 2);
		assert.equal(progressFrames, 0);

		state.viewport.current = 60;
		runtime.notify();
		assert.equal(fullFrames, 3);
		assert.equal(progressFrames, 1);

		state.viewport.current = 70;
		runtime.notify();
		assert.equal(fullFrames, 4);
		assert.equal(progressFrames, 2);

		state.viewport.current = 110;
		runtime.notify();
		assert.equal(fullFrames, 5);
		assert.equal(progressFrames, 3);

		state.viewport.current = 120;
		runtime.notify();
		assert.equal(fullFrames, 6);
		assert.equal(progressFrames, 3);
		assert.equal(easingResolveCalls, 1);

		stopFull();
		assert.equal(runtimeUnsubscriptions, 0);
		stopProgress();
		assert.equal(runtimeUnsubscriptions, 1);
		timeline.dispose();
		runtime.subscribe = originalSubscribe;
		EngineScrollEasing.resolve = originalResolve;

		const baseFrame = {
			point: 50,
			startPoint: 0,
			endPoint: 100,
			rawProgress: 0.5,
			progress: 0.5,
			before: false,
			active: true,
			after: false,
			direction: 1,
			velocity: 1,
		};
		let fullBindingSubscriptions = 0;
		let progressBindingSubscriptions = 0;
		const declarativeCalls = [];
		const declarativeSource = {
			subscribe() {
				fullBindingSubscriptions += 1;
				return () => {};
			},
			subscribeProgress(callback) {
				progressBindingSubscriptions += 1;
				callback(baseFrame);
				callback({ ...baseFrame, point: 60, rawProgress: 0.6, velocity: 2 });
				return () => {};
			},
		};
		bindEngineScrollTimelineStyles(
			declarativeSource,
			createStyleElement(declarativeCalls),
			{ opacity: [0, 1] },
		);
		assert.equal(fullBindingSubscriptions, 0);
		assert.equal(progressBindingSubscriptions, 1);
		assert.deepEqual(declarativeCalls, [["set", "opacity", "0.5"]]);

		fullBindingSubscriptions = 0;
		progressBindingSubscriptions = 0;
		const functionCalls = [];
		const functionSource = {
			subscribe(callback) {
				fullBindingSubscriptions += 1;
				callback(baseFrame);
				callback({ ...baseFrame, rawProgress: 0.6, velocity: 2 });
				return () => {};
			},
			subscribeProgress() {
				progressBindingSubscriptions += 1;
				return () => {};
			},
		};
		bindEngineScrollTimelineStyles(
			functionSource,
			createStyleElement(functionCalls),
			{
				"--raw": (frame) => frame.rawProgress,
			},
		);
		assert.equal(fullBindingSubscriptions, 1);
		assert.equal(progressBindingSubscriptions, 0);
		assert.deepEqual(functionCalls, [
			["set", "--raw", "0.5"],
			["set", "--raw", "0.6"],
		]);

		runtimeSubscriptions = 0;
		runtimeUnsubscriptions = 0;
		runtime.subscribe = function countedDirectorSubscribe(callback) {
			runtimeSubscriptions += 1;
			const stop = originalSubscribe.call(this, callback);
			return () => {
				runtimeUnsubscriptions += 1;
				stop();
			};
		};
		state.viewport.current = 60;
		cache.scrollVelocity = 0.5;

		const director = new EngineScrollDirector({
			visual: { start: 50, end: 100, source: "current" },
			settled: { start: 0, end: 25, source: "current" },
		});
		let directorFullFrames = 0;
		let directorProgressFrames = 0;
		const stopDirectorFull = director.subscribeTrack("visual", () => {
			directorFullFrames += 1;
		}, false);
		const stopDirectorProgress = director.subscribeProgressTrack("visual", () => {
			directorProgressFrames += 1;
		}, false);
		const directorDeclarativeCalls = [];
		const stopDirectorDeclarative = director.bindStyles(
			"visual",
			createStyleElement(directorDeclarativeCalls),
			{ opacity: [0, 1] },
		);
		const directorFunctionCalls = [];
		const stopDirectorFunction = director.bindStyles(
			"visual",
			createStyleElement(directorFunctionCalls),
			{ "--velocity": (frame) => frame.velocity },
		);
		assert.equal(runtimeSubscriptions, 1);
		assert.deepEqual(directorDeclarativeCalls, [["set", "opacity", "0.2"]]);
		assert.deepEqual(directorFunctionCalls, [["set", "--velocity", "0.5"]]);

		cache.scrollVelocity = 1.25;
		runtime.notify();
		assert.equal(directorFullFrames, 1);
		assert.equal(directorProgressFrames, 0);
		assert.equal(directorDeclarativeCalls.length, 1);
		assert.deepEqual(directorFunctionCalls.at(-1), ["set", "--velocity", "1.25"]);

		state.viewport.current = 70;
		runtime.notify();
		assert.equal(directorFullFrames, 2);
		assert.equal(directorProgressFrames, 1);
		assert.deepEqual(directorDeclarativeCalls.at(-1), ["set", "opacity", "0.4"]);

		state.viewport.current = 110;
		runtime.notify();
		assert.equal(directorFullFrames, 3);
		assert.equal(directorProgressFrames, 2);
		assert.deepEqual(directorDeclarativeCalls.at(-1), ["set", "opacity", "1"]);

		state.viewport.current = 120;
		runtime.notify();
		assert.equal(directorFullFrames, 3);
		assert.equal(directorProgressFrames, 2);
		assert.equal(directorDeclarativeCalls.length, 3);

		stopDirectorFull();
		stopDirectorProgress();
		stopDirectorDeclarative();
		stopDirectorFunction();
		assert.equal(runtimeUnsubscriptions, 1);
		director.dispose();
		runtime.subscribe = originalSubscribe;

		console.log("EngineScroll progress-channel smoke tests passed");
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
