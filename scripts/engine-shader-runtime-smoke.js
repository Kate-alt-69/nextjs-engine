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

async function testHotReloadStartupAndManifestReuse(runtime) {
	runtime.clearEngineShaderCache();
	const previousFetch = global.fetch;
	const previousWindow = global.window;
	const previousDocument = global.document;
	const previousSetInterval = global.setInterval;
	const previousClearInterval = global.clearInterval;
	const previousNodeEnv = process.env.NODE_ENV;
	const previousConsoleError = console.error;
	const manifestRequests = [];
	const baselineManifest = createManifest("baseline-hash", "baseline.shed.dat");
	const changedManifest = createManifest("changed-hash", "changed.shed.dat");
	let pollCallback = null;
	let reloadPromise = null;
	let notifications = 0;
	let failingNotifications = 0;
	let reportedListenerErrors = 0;

	try {
		process.env.NODE_ENV = "development";
		global.window = {};
		global.document = { hidden: false };
		global.setInterval = (callback) => {
			pollCallback = callback;
			return 700;
		};
		global.clearInterval = () => {
			pollCallback = null;
		};
		console.error = () => {
			reportedListenerErrors += 1;
		};
		global.fetch = (url) => {
			const requestURL = String(url);
			if (requestURL.includes("manifest.json")) {
				const deferred = createDeferred();
				manifestRequests.push(deferred);
				return deferred.promise;
			}
			if (requestURL.endsWith("baseline.shed.dat")) return Promise.resolve(artifactResponse("baseline"));
			if (requestURL.endsWith("changed.shed.dat")) return Promise.resolve(artifactResponse("changed"));
			throw new Error(`unexpected shader request: ${requestURL}`);
		};

		const initialLoad = runtime.loadEngineShader("demo");
		assert.equal(manifestRequests.length, 1, "initial shader load should start one manifest request");
		const unsubscribeFailing = runtime.subscribeEngineShaderHotReload("demo", () => {
			failingNotifications += 1;
			throw new Error("intentional hot listener failure");
		});
		const unsubscribe = runtime.subscribeEngineShaderHotReload("demo", () => {
			notifications += 1;
			reloadPromise = runtime.loadEngineShader("demo");
		});
		assert.equal(typeof pollCallback, "function", "hot reload subscription should start the dev poll timer");

		pollCallback();
		await flushMicrotasks();
		assert.equal(
			manifestRequests.length,
			1,
			"hot reload polling must not force a competing manifest request while initial load is pending",
		);

		manifestRequests[0].resolve(jsonResponse(baselineManifest));
		const baseline = await initialLoad;
		assert.equal(baseline.entry.hash, "baseline-hash");

		pollCallback();
		pollCallback();
		await flushMicrotasks();
		assert.equal(
			manifestRequests.length,
			2,
			"slow hot reload polling must keep at most one forced manifest request in flight",
		);
		manifestRequests[1].resolve(jsonResponse(changedManifest));
		await flushMicrotasks();
		assert.equal(failingNotifications, 1, "failing hot listener should receive the changed-shader notification");
		assert.equal(reportedListenerErrors, 1, "failing hot listener should be reported without aborting fan-out");
		assert.equal(notifications, 1, "healthy hot listener should still run after a sibling listener throws");
		assert.ok(reloadPromise, "hot reload listener should request the updated shader plan");
		const reloaded = await reloadPromise;
		assert.equal(reloaded.entry.hash, "changed-hash");
		assert.equal(reloaded.plan.name, "changed");
		assert.equal(
			manifestRequests.length,
			2,
			"listener reload should reuse the manifest already fetched by the poller instead of forcing a third request",
		);

		pollCallback();
		await flushMicrotasks();
		assert.equal(manifestRequests.length, 3, "a completed hot poll should allow the next interval to refresh normally");
		manifestRequests[2].resolve(jsonResponse(changedManifest));
		await flushMicrotasks();
		assert.equal(notifications, 1, "unchanged manifest revision should not notify healthy listeners again");
		assert.equal(failingNotifications, 1, "unchanged manifest revision should not notify failing listeners again");

		unsubscribeFailing();
		unsubscribe();
		assert.equal(pollCallback, null, "removing the final hot reload listener should stop the dev poll timer");
	} finally {
		global.fetch = previousFetch;
		if (previousWindow === undefined) delete global.window;
		else global.window = previousWindow;
		if (previousDocument === undefined) delete global.document;
		else global.document = previousDocument;
		global.setInterval = previousSetInterval;
		global.clearInterval = previousClearInterval;
		console.error = previousConsoleError;
		if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = previousNodeEnv;
		runtime.clearEngineShaderCache();
	}
}

async function testHotReloadRecoversAfterInitialFailure(runtime) {
	runtime.clearEngineShaderCache();
	const previousFetch = global.fetch;
	const previousWindow = global.window;
	const previousDocument = global.document;
	const previousSetInterval = global.setInterval;
	const previousClearInterval = global.clearInterval;
	const previousNodeEnv = process.env.NODE_ENV;
	let manifestFetches = 0;
	let pollCallback = null;
	let recoveryRequest = null;
	let reloadPromise = null;
	let notifications = 0;
	const recoveryManifest = createManifest("recovery-hash", "recovery.shed.dat");

	try {
		process.env.NODE_ENV = "development";
		global.window = {};
		global.document = { hidden: false };
		global.setInterval = (callback) => {
			pollCallback = callback;
			return 701;
		};
		global.clearInterval = () => {
			pollCallback = null;
		};
		global.fetch = (url) => {
			const requestURL = String(url);
			if (requestURL.includes("manifest.json")) {
				manifestFetches += 1;
				if (manifestFetches === 1) {
					return Promise.resolve({ ok: false, status: 503 });
				}
				if (manifestFetches === 2) {
					recoveryRequest = createDeferred();
					return recoveryRequest.promise;
				}
				throw new Error(`unexpected extra manifest request: ${requestURL}`);
			}
			if (requestURL.endsWith("recovery.shed.dat")) return Promise.resolve(artifactResponse("recovery"));
			throw new Error(`unexpected shader request: ${requestURL}`);
		};

		const initialLoad = runtime.loadEngineShader("demo");
		const unsubscribe = runtime.subscribeEngineShaderHotReload("demo", () => {
			notifications += 1;
			reloadPromise = runtime.loadEngineShader("demo");
		});
		await assert.rejects(initialLoad, /Failed to load shader manifest \(503\)/);
		assert.equal(manifestFetches, 1, "failed initial load should complete before recovery polling");

		pollCallback();
		await flushMicrotasks();
		assert.equal(manifestFetches, 2, "polling should retry when no baseline or initial request remains");
		assert.ok(recoveryRequest, "recovery poll should own a manifest request");
		recoveryRequest.resolve(jsonResponse(recoveryManifest));
		await flushMicrotasks();
		assert.equal(notifications, 1, "newly established recovery baseline should wake subscribed shaders");
		assert.ok(reloadPromise, "recovery notification should reload the shader plan");
		const recovered = await reloadPromise;
		assert.equal(recovered.entry.hash, "recovery-hash");
		assert.equal(recovered.plan.name, "recovery");
		assert.equal(manifestFetches, 2, "recovery reload should reuse the manifest established by polling");

		unsubscribe();
		assert.equal(pollCallback, null, "recovery listener cleanup should stop the dev poll timer");
	} finally {
		global.fetch = previousFetch;
		if (previousWindow === undefined) delete global.window;
		else global.window = previousWindow;
		if (previousDocument === undefined) delete global.document;
		else global.document = previousDocument;
		global.setInterval = previousSetInterval;
		global.clearInterval = previousClearInterval;
		if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = previousNodeEnv;
		runtime.clearEngineShaderCache();
	}
}

function assertComponentHotReloadReusesManifest() {
	const source = fs.readFileSync(
		path.join(repoRoot, "src", "engine", "components", "EngineShader.tsx"),
		"utf8",
	);
	assert.match(
		source,
		/subscribeEngineShaderHotReload\(config\.src,\s*\(\)\s*=>\s*void load\(false\)\)/,
		"EngineShader hot reload callback should reuse the manifest already refreshed by the poller",
	);
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
		await testHotReloadStartupAndManifestReuse(runtime);
		await testHotReloadRecoversAfterInitialFailure(runtime);
		assertComponentHotReloadReusesManifest();

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
