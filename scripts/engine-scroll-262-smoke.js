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
	fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function elementAt(top, height = 20) {
	return {
		isConnected: true,
		getBoundingClientRect() {
			return { top, bottom: top + height, height };
		},
	};
}

function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-scroll-262-smoke-"));
	const sourceRoot = path.join(process.cwd(), "src", "engine", "core", "enginescroll");
	const previousGlobals = {
		window: global.window,
		document: global.document,
		history: global.history,
		ResizeObserver: global.ResizeObserver,
		requestAnimationFrame: global.requestAnimationFrame,
		cancelAnimationFrame: global.cancelAnimationFrame,
	};

	try {
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
			"EngineScrollSnap.ts",
			"EngineScrollPhysics.ts",
			"EngineScrollBrowser.ts",
			"EngineScrollURL.ts",
		];
		for (const filename of files) {
			transpile(
				path.join(sourceRoot, filename),
				path.join(root, filename.replace(/\.ts$/, ".js")),
			);
		}
		for (const filename of ["BrowserScheduler.ts", "BrowserEvents.ts"]) {
			transpile(
				path.join(sourceRoot, "browser", filename),
				path.join(root, "browser", filename.replace(/\.ts$/, ".js")),
			);
		}
		for (const filename of ["ViewportMath.ts", "ViewportPoints.ts"]) {
			transpile(
				path.join(sourceRoot, "viewport", filename),
				path.join(root, "viewport", filename.replace(/\.ts$/, ".js")),
			);
		}

		const elements = new Map();
		const location = {
			hash: "",
			pathname: "/docs",
			search: "?tab=scroll",
		};
		let cleanedUrl = null;
		let lastScrollTop = null;

		global.ResizeObserver = class ResizeObserver {
			observe() {}
			unobserve() {}
		};
		global.window = {
			scrollX: 0,
			scrollY: 0,
			innerWidth: 1200,
			innerHeight: 100,
			devicePixelRatio: 1,
			location,
			addEventListener() {},
			removeEventListener() {},
			scrollTo(options) {
				lastScrollTop = typeof options === "number" ? options : options.top;
			},
		};
		global.document = {
			hidden: false,
			documentElement: {
				scrollWidth: 1200,
				scrollHeight: 1000,
			},
			addEventListener() {},
			removeEventListener() {},
			getElementById(id) {
				return elements.get(id) || null;
			},
		};
		global.history = {
			replaceState(_state, _title, url) {
				cleanedUrl = url;
			},
		};
		global.requestAnimationFrame = () => 1;
		global.cancelAnimationFrame = () => {};

		const { EngineScrollRuntime } = require(path.join(root, "EngineScrollRuntime.js"));
		const { EngineScrollPointManager } = require(path.join(root, "EngineScrollPointManager.js"));
		const {
			EngineScrollTargetResolver,
		} = require(path.join(root, "EngineScrollNavigator.js"));
		const { EngineScrollRange } = require(path.join(root, "EngineScrollRange.js"));
		const { EngineScrollHash } = require(path.join(root, "EngineScrollHash.js"));
		const { EngineScrollURL } = require(path.join(root, "EngineScrollURL.js"));
		const { EngineScrollSnap } = require(path.join(root, "EngineScrollSnap.js"));
		const { EngineScrollMovement } = require(path.join(root, "EngineScrollMovement.js"));
		const { EngineScrollPhysics } = require(path.join(root, "EngineScrollPhysics.js"));
		const { EngineScrollBrowser } = require(path.join(root, "EngineScrollBrowser.js"));
		const { BrowserEvents } = require(path.join(root, "browser", "BrowserEvents.js"));
		const { BrowserScheduler } = require(path.join(root, "browser", "BrowserScheduler.js"));
		const { ViewportPoints } = require(path.join(root, "viewport", "ViewportPoints.js"));

		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const cache = runtime.getCache();
		state.page.pointSpacing = 1;
		state.page.totalPoints = 900;
		state.viewport.top = 0;
		state.viewport.current = 0;
		cache.documentHeight = 1000;
		cache.viewportHeight = 100;
		cache.documentWidth = 1200;
		cache.viewportWidth = 1200;

		// A failing runtime subscriber must not starve later subscribers.
		let survivorCalls = 0;
		const oldConsoleError = console.error;
		console.error = () => {};
		const stopBad = runtime.subscribe(() => { throw new Error("expected test failure"); });
		const stopGood = runtime.subscribe(() => { survivorCalls += 1; });
		runtime.notify();
		console.error = oldConsoleError;
		assert.equal(survivorCalls, 1);
		stopBad();
		stopGood();

		// Shared target semantics: registered points win, then normal DOM ids.
		const domHero = elementAt(10);
		const registeredHero = elementAt(30);
		elements.set("hero", domHero);
		EngineScrollPointManager.register("hero", 30, registeredHero);
		assert.equal(EngineScrollTargetResolver.resolve("#hero"), 30);
		EngineScrollPointManager.unregister("hero");
		assert.equal(EngineScrollTargetResolver.resolve("#hero"), 10);

		// Plain DOM ids work in ranges and are measured live instead of caching a miss.
		let startTop = 20;
		let endTop = 80;
		elements.set("plain-start", {
			isConnected: true,
			getBoundingClientRect: () => ({ top: startTop, bottom: startTop + 10, height: 10 }),
		});
		elements.set("plain-end", {
			isConnected: true,
			getBoundingClientRect: () => ({ top: endTop, bottom: endTop + 10, height: 10 }),
		});
		const domRange = new EngineScrollRange({ start: "#plain-start", end: "#plain-end" });
		assert.equal(domRange.snapshot().startPoint, 20);
		assert.equal(domRange.snapshot().endPoint, 80);
		startTop = 35;
		endTop = 95;
		assert.equal(domRange.snapshot().startPoint, 35);
		assert.equal(domRange.snapshot().endPoint, 95);

		const lateRange = new EngineScrollRange({ start: "#late-a", end: "#late-b" });
		assert.equal(lateRange.snapshot().valid, false);
		elements.set("late-a", elementAt(40));
		elements.set("late-b", elementAt(70));
		assert.equal(lateRange.snapshot().valid, true);
		assert.equal(lateRange.snapshot().startPoint, 40);
		assert.equal(lateRange.snapshot().endPoint, 70);

		// Progressive viewport focus follows exact document progress.
		ViewportPoints.setFocus("progressive");
		assert.equal(ViewportPoints.resolveFocus(0, 1000, 100), 0);
		assert.equal(ViewportPoints.resolveFocus(225, 1000, 100), 0.25);
		assert.equal(ViewportPoints.resolveFocus(450, 1000, 100), 0.5);
		assert.equal(ViewportPoints.resolveFocus(675, 1000, 100), 0.75);
		assert.equal(ViewportPoints.resolveFocus(900, 1000, 100), 1);
		assert.equal(ViewportPoints.resolveFocus(0, 80, 100), 0);
		ViewportPoints.setFocus("top");
		assert.equal(ViewportPoints.resolveFocus(450, 1000, 100), 0);
		ViewportPoints.setFocus("center");
		assert.equal(ViewportPoints.resolveFocus(450, 1000, 100), 0.5);
		ViewportPoints.setFocus("bottom");
		assert.equal(ViewportPoints.resolveFocus(450, 1000, 100), 1);
		ViewportPoints.setFocus(-2);
		assert.equal(ViewportPoints.getFocusMode(), 0);
		ViewportPoints.setFocus(8);
		assert.equal(ViewportPoints.getFocusMode(), 1);
		ViewportPoints.setFocus("progressive");

		// Velocity/direction remain physical even when logical current moves independently.
		EngineScrollPhysics.reset();
		state.viewport.top = 10;
		state.viewport.current = 40;
		EngineScrollPhysics.update(16);
		state.viewport.current = 80;
		EngineScrollPhysics.update(16);
		assert.equal(cache.scrollVelocity, 0);
		assert.equal(cache.scrollDirection, 0);
		state.viewport.top = 26;
		EngineScrollPhysics.update(16);
		assert.equal(cache.scrollVelocity, 1);
		assert.equal(cache.scrollDirection, 1);

		// Resize events must preserve old measurements until Browser.update compares them.
		const revisionBeforeResize = EngineScrollPointManager.revision();
		cache.viewportHeight = 100;
		cache.documentHeight = 1000;
		global.window.innerHeight = 120;
		global.document.documentElement.scrollHeight = 1100;
		BrowserEvents.onResize(() => {});
		assert.equal(cache.viewportHeight, 100);
		assert.equal(cache.documentHeight, 1000);
		EngineScrollBrowser.update();
		assert.equal(cache.viewportHeight, 120);
		assert.equal(cache.documentHeight, 1100);
		assert.ok(EngineScrollPointManager.revision() > revisionBeforeResize);
		BrowserScheduler.cancel();

		// The URL protocol must not capture normal ids beginning with "-es".
		location.hash = "#-essay";
		assert.equal(EngineScrollURL.has(), false);

		// Failed protocol targets keep the URL so a later/lazy mount can retry.
		location.hash = "#-es?move=%23missing&duration=0";
		cleanedUrl = null;
		assert.equal(EngineScrollURL.execute(), false);
		assert.equal(cleanedUrl, null);

		location.hash = "#-es?move=10&duration=0";
		cleanedUrl = null;
		assert.equal(EngineScrollURL.execute(), true);
		assert.equal(cleanedUrl, "/docs?tab=scroll");
		assert.equal(lastScrollTop, 10);

		// Hash navigation should fail safely when invoked during SSR.
		const savedWindow = global.window;
		const savedDocument = global.document;
		delete global.window;
		delete global.document;
		assert.equal(EngineScrollHash.moveToHash("#hero"), false);
		global.window = savedWindow;
		global.document = savedDocument;

		// A stale enableSnap disposer must not disable a newer snap session.
		const stopSnapA = EngineScrollSnap.enable({ group: "a" });
		const stopSnapB = EngineScrollSnap.enable({ group: "b" });
		stopSnapA();
		assert.equal(EngineScrollSnap.isEnabled(), true);
		stopSnapB();
		assert.equal(EngineScrollSnap.isEnabled(), false);

		// One-shot directional snap uses current runtime direction even when auto-snap is off.
		const originalNext = EngineScrollPointManager.next;
		const originalNearest = EngineScrollPointManager.nearest;
		const originalResolve = EngineScrollPointManager.resolve;
		const originalMove = EngineScrollMovement.move;
		let usedNext = false;
		let usedNearest = false;
		let movedPoint = null;
		EngineScrollPointManager.next = () => {
			usedNext = true;
			return { name: "next", point: 25 };
		};
		EngineScrollPointManager.nearest = () => {
			usedNearest = true;
			return { name: "nearest", point: 20 };
		};
		EngineScrollPointManager.resolve = (name) => ({
			name,
			point: name === "next" ? 25 : 20,
			element: {},
			align: "start",
			offset: 0,
			groups: [],
		});
		EngineScrollMovement.move = (point) => { movedPoint = point; };
		state.viewport.top = 20;
		cache.scrollDirection = 1;
		assert.equal(EngineScrollSnap.now({ mode: "directional", threshold: 10 }), true);
		assert.equal(usedNext, true);
		assert.equal(usedNearest, false);
		assert.equal(movedPoint, 25);
		EngineScrollPointManager.next = originalNext;
		EngineScrollPointManager.nearest = originalNearest;
		EngineScrollPointManager.resolve = originalResolve;
		EngineScrollMovement.move = originalMove;

		EngineScrollPointManager.clear();
		console.log("EngineScroll v2.6.2 regression tests passed");
	} finally {
		for (const [key, value] of Object.entries(previousGlobals)) {
			if (value === undefined) delete global[key];
			else global[key] = value;
		}
		fs.rmSync(root, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
