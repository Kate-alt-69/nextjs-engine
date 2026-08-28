"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".engine-shader-runtime-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/engineshader/EngineShaderRuntime.ts",
		"--outDir", outDir,
		"--rootDir", "src/engine",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--skipLibCheck",
		"--incremental", "false",
	], {
		cwd: repoRoot,
		stdio: "inherit",
	});
}

function takeNextFrame(frames) {
	const next = frames.entries().next().value;
	assert.ok(next, "shared shader scheduler should have a queued frame");
	const [frameId, callback] = next;
	frames.delete(frameId);
	return callback;
}

const previousDocument = global.document;
const previousRequestAnimationFrame = global.requestAnimationFrame;
const previousCancelAnimationFrame = global.cancelAnimationFrame;
const previousNodeEnv = process.env.NODE_ENV;

try {
	compileRuntime();

	const queuedFrames = new Map();
	let nextFrameId = 1;
	global.document = { hidden: false };
	global.requestAnimationFrame = (callback) => {
		const frameId = nextFrameId++;
		queuedFrames.set(frameId, callback);
		return frameId;
	};
	global.cancelAnimationFrame = (frameId) => {
		queuedFrames.delete(frameId);
	};
	process.env.NODE_ENV = "production";

	const { EngineShaderScheduler } = require(path.join(
		outDir,
		"core",
		"engineshader",
		"EngineShaderRuntime.js",
	));

	let failedFrames = 0;
	let healthyFrames = 0;
	const stopFailing = EngineShaderScheduler.add(() => {
		failedFrames += 1;
		throw new Error("intentional scheduler isolation failure");
	});
	const stopHealthy = EngineShaderScheduler.add(() => {
		healthyFrames += 1;
	});

	assert.equal(queuedFrames.size, 1, "multiple shader callbacks should share one RAF");
	takeNextFrame(queuedFrames)(16);
	assert.equal(failedFrames, 1, "failing shader callback should run once");
	assert.equal(healthyFrames, 1, "healthy shader callback should survive a sibling failure");
	assert.equal(queuedFrames.size, 1, "shared scheduler should continue after isolating a callback failure");

	takeNextFrame(queuedFrames)(32);
	assert.equal(failedFrames, 1, "failing shader callback should be removed after throwing");
	assert.equal(healthyFrames, 2, "healthy shader callback should continue on later frames");
	assert.equal(queuedFrames.size, 1, "healthy shader callback should keep the shared RAF alive");

	stopFailing();
	stopHealthy();
	assert.equal(queuedFrames.size, 0, "shared shader scheduler should cancel RAF when the final callback leaves");

	console.log("engine shader runtime smoke: ok");
} finally {
	if (previousDocument === undefined) delete global.document;
	else global.document = previousDocument;
	if (previousRequestAnimationFrame === undefined) delete global.requestAnimationFrame;
	else global.requestAnimationFrame = previousRequestAnimationFrame;
	if (previousCancelAnimationFrame === undefined) delete global.cancelAnimationFrame;
	else global.cancelAnimationFrame = previousCancelAnimationFrame;
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
	fs.rmSync(outDir, { recursive: true, force: true });
}
