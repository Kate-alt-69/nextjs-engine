"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-nenc-traffic-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/nenc/NENCDispatcher.ts",
		"src/engine/core/nenc/NENCRateLimit.ts",
		"src/engine/core/nenc/NENCReplay.ts",
		"--outDir", outDir,
		"--rootDir", "src/engine",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--jsx", "react-jsx",
		"--esModuleInterop",
		"--skipLibCheck",
		"--incremental", "false",
	], {
		cwd: repoRoot,
		stdio: "inherit",
	});
}

function trafficManifest() {
	return {
		version: 1,
		endpoint: "/_static/command",
		buildId: "traffic-smoke",
		headers: {
			selector: "x-command",
			nonce: "x-nonce",
			timestamp: "x-timestamp",
			signature: "x-signature",
		},
		commandsById: {
			cTraffic: {
				id: "cTraffic",
				name: "traffic.policy.smoke",
				run: "server",
				auth: "anonymous",
				permissions: [],
				replay: { maxAgeMs: 1_000, maxFutureSkewMs: 100 },
				rateLimit: { limit: 2, windowMs: 1_000 },
				argsByName: {},
				argsById: {},
			},
		},
	};
}

function trafficRequest(manifest, nonce, timestamp = Date.now()) {
	return new Request("https://app.example.com/_static/command", {
		method: "POST",
		headers: {
			[manifest.headers.selector]: "cTraffic",
			[manifest.headers.nonce]: nonce,
			[manifest.headers.timestamp]: String(timestamp),
			"Content-Type": "application/json",
		},
		body: "{}",
	});
}

async function run() {
	compileRuntime();
	const { EngineAPIResolver } = require(path.join(outDir, "core", "EngineAPIResolver.js"));
	const {
		getEngineCommandBuildDescriptors,
		registerEngineCommand,
	} = require(path.join(outDir, "core", "nenc", "EngineCommand.js"));
	const { createNENCDispatcher } = require(path.join(outDir, "core", "nenc", "NENCDispatcher.js"));
	const { NENCRateLimiter } = require(path.join(outDir, "core", "nenc", "NENCRateLimit.js"));
	const { NENCReplayGuard } = require(path.join(outDir, "core", "nenc", "NENCReplay.js"));

	const now = 1_800_000_000_000;
	const replay = new NENCReplayGuard({ maxAgeMs: 60_000, maxFutureSkewMs: 5_000 });
	assert.equal((await replay.verify(String(now - 2_000), "traffic_replay_nonce_0001", now)).allowed, true);
	assert.equal((await replay.verify(
		String(now - 2_000),
		"traffic_replay_nonce_0002",
		now,
		{ maxAgeMs: 1_000 },
	)).reason, "expired-timestamp", "command replay policy must narrow the default age window");
	assert.equal((await replay.verify(
		String(now + 1_000),
		"traffic_replay_nonce_0003",
		now,
		{ maxFutureSkewMs: 100 },
	)).reason, "expired-timestamp", "command replay policy must narrow future clock skew");
	assert.equal((await replay.verify(
		String(now - 61_000),
		"traffic_replay_nonce_0005",
		now,
		{ maxAgeMs: 120_000 },
	)).reason, "expired-timestamp", "command replay policy must not widen the server ceiling");
	assert.equal((await replay.verify(String(now), "traffic_replay_nonce_0004", now)).allowed, true);
	assert.equal((await replay.verify(String(now), "traffic_replay_nonce_0004", now)).reason, "replayed-nonce");

	const manifest = trafficManifest();
	const rateContext = {
		request: trafficRequest(manifest, "traffic_rate_nonce_0001", now),
		origin: "https://app.example.com",
		command: manifest.commandsById.cTraffic,
		input: {},
		principal: undefined,
	};
	let rateNow = now;
	const rateLimit = new NENCRateLimiter({
		now: () => rateNow,
		resolveKey() {
			return "trusted-client-42";
		},
	});
	assert.equal((await rateLimit.check({ limit: 2, windowMs: 1_000 }, rateContext)).remaining, 1);
	assert.equal((await rateLimit.check({ limit: 2, windowMs: 1_000 }, rateContext)).remaining, 0);
	const denied = await rateLimit.check({ limit: 2, windowMs: 1_000 }, rateContext);
	assert.equal(denied.allowed, false);
	assert.equal(denied.reason, "limit-exceeded");
	assert.equal(denied.retryAfterMs, 1_000);
	rateNow += 1_001;
	assert.equal((await rateLimit.check({ limit: 2, windowMs: 1_000 }, rateContext)).allowed, true, "rate window must reset");

	let observedError = false;
	const brokenRateLimit = new NENCRateLimiter({
		resolveKey() {
			throw new Error("resolver unavailable");
		},
		onError() {
			observedError = true;
		},
	});
	assert.equal((await brokenRateLimit.check({ limit: 1, windowMs: 1_000 }, rateContext)).allowed, false);
	assert.equal(observedError, true, "rate key failures must remain observable while failing closed");

	registerEngineCommand("traffic.policy.smoke", {
		run: "server",
		replay: { maxAgeMs: 1_000, maxFutureSkewMs: 100 },
		rateLimit: { limit: 2, windowMs: 1_000 },
		execute() {
			return { ok: true };
		},
	});
	const descriptor = getEngineCommandBuildDescriptors().find((command) => command.name === "traffic.policy.smoke");
	assert.deepEqual(descriptor.replay, { maxAgeMs: 1_000, maxFutureSkewMs: 100 });
	assert.deepEqual(descriptor.rateLimit, { limit: 2, windowMs: 1_000 });
	assert.equal(Object.isFrozen(descriptor.replay), true);
	assert.equal(Object.isFrozen(descriptor.rateLimit), true);
	const liveRateLimit = new NENCRateLimiter({ resolveKey: () => "trusted-live-client" });
	const dispatcher = createNENCDispatcher({
		manifest,
		api: new EngineAPIResolver(),
		rateLimit: liveRateLimit,
	});
	assert.equal((await dispatcher(trafficRequest(manifest, "traffic_dispatch_nonce_0001"))).status, 200);
	assert.equal((await dispatcher(trafficRequest(manifest, "traffic_dispatch_nonce_0002"))).status, 200);
	const limitedResponse = await dispatcher(trafficRequest(manifest, "traffic_dispatch_nonce_0003"));
	assert.equal(limitedResponse.status, 429);
	assert.equal(limitedResponse.headers.get("Retry-After"), "1");
	assert.deepEqual(await limitedResponse.json(), { error: "invalid_request" });

	const staleResponse = await dispatcher(trafficRequest(
		manifest,
		"traffic_dispatch_nonce_0004",
		Date.now() - 2_000,
	));
	assert.equal(staleResponse.status, 409, "per-command replay age must be enforced before rate consumption");

	const missingLimiter = createNENCDispatcher({ manifest, api: new EngineAPIResolver() });
	const missingLimiterResponse = await missingLimiter(trafficRequest(manifest, "traffic_dispatch_nonce_0005"));
	assert.equal(missingLimiterResponse.status, 429, "declared rate policy must fail closed without a limiter");

	console.log("Generation 3 NENC traffic policy smoke: ok");
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
