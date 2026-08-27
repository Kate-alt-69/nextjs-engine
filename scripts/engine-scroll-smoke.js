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
			"EngineScrollTimeline.ts",
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
