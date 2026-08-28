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

function createDeferred() {
	let resolve;
	let reject;
	const promise = new Promise((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});
	return { promise, resolve, reject };
}

function createManifest(hash, file) {
	return {
		version: 1,
		revision: hash,
		shaders: {
			demo: {
				hash,
				file,
				execution: "static",
				dependencies: [],
			},
		},
	};
}

function createRenderPlan(label) {
	return {
		version: 1,
		name: label,
		logicalName: "demo",
		execution: "static",
		dependencies: [],
		variables: [],
		constants: {},
		render: { resolution: 1, filter: "linear" },
		fallback: "transparent",
		vertex: "void main(){gl_Position=vec4(0.0);}",
		fragment: "void main(){gl_FragColor=vec4(1.0);}",
		flows: [],
	};
}

function encodeArtifact(plan) {
	const payload = Buffer.from(JSON.stringify(plan), "utf8");
	const artifact = Buffer.allocUnsafe(payload.length + 8);
	artifact.write("ESH1", 0, 4, "ascii");
	artifact.writeUInt32LE(payload.length, 4);
	payload.copy(artifact, 8);
	return artifact.buffer.slice(
		artifact.byteOffset,
		artifact.byteOffset + artifact.byteLength,
	);
}

function jsonResponse(value) {
	return {
		ok: true,
		status: 200,
		json: async () => value,
	};
}

function artifactResponse(label) {
	return {
		ok: true,
		status: 200,
		arrayBuffer: async () => encodeArtifact(createRenderPlan(label)),
	};
}

async function flushMicrotasks() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

function testSchedulerIsolation(EngineShaderScheduler) {
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
}

async function testForcedManifestRace(runtime) {
	runtime.clearEngineShaderCache();
	const previousFetch = global.fetch;
	const manifestRequests = [];
	const staleManifest = createManifest("stale-hash", "stale.shed.dat");
	const freshManifest = createManifest("fresh-hash", "fresh.shed.dat");

	try {
		global.fetch = (url) => {
			const requestURL = String(url);
			if (requestURL.includes("manifest.json")) {
				const deferred = createDeferred();
				manifestRequests.push(deferred);
				return deferred.promise;
			}
			if (requestURL.endsWith("fresh.shed.dat")) return Promise.resolve(artifactResponse("fresh"));
			if (requestURL.endsWith("stale.shed.dat")) return Promise.resolve(artifactResponse("stale"));
			throw new Error(`unexpected shader request: ${requestURL}`);
		};

		const staleLoad = runtime.loadEngineShader("demo");
		assert.equal(manifestRequests.length, 1, "initial shader load should start one manifest request");
		const freshLoad = runtime.loadEngineShader("demo", { forceManifest: true });
		assert.equal(manifestRequests.length, 2, "forced refresh should start a newer manifest request");

		manifestRequests[1].resolve(jsonResponse(freshManifest));
		const freshResult = await freshLoad;
		assert.equal(freshResult.entry.hash, "fresh-hash");

		manifestRequests[0].resolve(jsonResponse(staleManifest));
		await staleLoad;
		const cachedResult = await runtime.loadEngineShader("demo");
		assert.equal(
			cachedResult.entry.hash,
			"fresh-hash",
			"a slower pre-refresh manifest must not overwrite a newer forced refresh",
		);
		assert.equal(manifestRequests.length, 2, "fresh manifest should remain cached after the stale request finishes");
	} finally {
		global.fetch = previousFetch;
		runtime.clearEngineShaderCache();
	}
}

async function testClearInvalidatesManifestRace(runtime) {
	runtime.clearEngineShaderCache();
	const previousFetch = global.fetch;
	const manifestRequests = [];
	const staleManifest = createManifest("pre-clear-hash", "pre-clear.shed.dat");
	const freshManifest = createManifest("post-clear-hash", "post-clear.shed.dat");

	try {
		global.fetch = (url) => {
			const requestURL = String(url);
			if (requestURL.includes("manifest.json")) {
				const deferred = createDeferred();
				manifestRequests.push(deferred);
				return deferred.promise;
			}
			if (requestURL.endsWith("pre-clear.shed.dat")) return Promise.resolve(artifactResponse("pre-clear"));
			if (requestURL.endsWith("post-clear.shed.dat")) return Promise.resolve(artifactResponse("post-clear"));
			throw new Error(`unexpected shader request: ${requestURL}`);
		};

		const staleLoad = runtime.loadEngineShader("demo");
		assert.equal(manifestRequests.length, 1);
		runtime.clearEngineShaderCache();
		const freshLoad = runtime.loadEngineShader("demo");
		assert.equal(manifestRequests.length, 2, "cache clear should allow a replacement manifest request");

		manifestRequests[1].resolve(jsonResponse(freshManifest));
		const freshResult = await freshLoad;
		assert.equal(freshResult.entry.hash, "post-clear-hash");

		manifestRequests[0].resolve(jsonResponse(staleManifest));
		await staleLoad;
		const cachedResult = await runtime.loadEngineShader("demo");
		assert.equal(
			cachedResult.entry.hash,
			"post-clear-hash",
			"a request started before clearEngineShaderCache must not repopulate the cleared manifest cache",
		);
	} finally {
		global.fetch = previousFetch;
		runtime.clearEngineShaderCache();
	}
}

async function testArtifactRejectionCannotDeleteReplacement(runtime) {
	runtime.clearEngineShaderCache();
	const previousFetch = global.fetch;
	const manifest = createManifest("shared-hash", "shared.shed.dat");
	const artifactRequests = [];

	try {
		global.fetch = (url) => {
			const requestURL = String(url);
			if (requestURL.includes("manifest.json")) return Promise.resolve(jsonResponse(manifest));
			if (requestURL.endsWith("shared.shed.dat")) {
				const deferred = createDeferred();
				artifactRequests.push(deferred);
				return deferred.promise;
			}
			throw new Error(`unexpected shader request: ${requestURL}`);
		};

		const staleLoad = runtime.loadEngineShader("demo");
		await flushMicrotasks();
		assert.equal(artifactRequests.length, 1, "initial load should own the first artifact promise");

		runtime.clearEngineShaderCache();
		const freshLoad = runtime.loadEngineShader("demo");
		await flushMicrotasks();
		assert.equal(artifactRequests.length, 2, "cache clear should allow a replacement artifact request");

		const staleRejected = assert.rejects(staleLoad, /stale artifact failure/);
		artifactRequests[0].reject(new Error("stale artifact failure"));
		await staleRejected;
		await flushMicrotasks();

		const followerLoad = runtime.loadEngineShader("demo");
		await flushMicrotasks();
		assert.equal(
			artifactRequests.length,
			2,
			"an old rejected artifact promise must not delete a newer promise with the same cache key",
		);

		artifactRequests[1].resolve(artifactResponse("replacement"));
		const [freshResult, followerResult] = await Promise.all([freshLoad, followerLoad]);
		assert.equal(freshResult.plan.name, "replacement");
		assert.equal(followerResult.plan.name, "replacement");
	} finally {
		global.fetch = previousFetch;
		runtime.clearEngineShaderCache();
	}
}

const previousDocument = global.document;
const previousRequestAnimationFrame = global.requestAnimationFrame;
const previousCancelAnimationFrame = global.cancelAnimationFrame;
const previousNodeEnv = process.env.NODE_ENV;

async function main() {
	try {
		compileRuntime();
		process.env.NODE_ENV = "production";
		const runtime = require(path.join(
			outDir,
			"core",
			"engineshader",
			"EngineShaderRuntime.js",
		));

		testSchedulerIsolation(runtime.EngineShaderScheduler);
		await testForcedManifestRace(runtime);
		await testClearInvalidatesManifestRace(runtime);
		await testArtifactRejectionCannotDeleteReplacement(runtime);

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
}

main().catch((reason) => {
	console.error(reason);
	process.exitCode = 1;
});
