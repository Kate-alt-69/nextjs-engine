"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-command-security-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/nenc/NENCCommandSecurity.ts",
		"src/engine/core/nenc/NENCDispatcher.ts",
		"--outDir", outDir,
		"--rootDir", "src/engine",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--jsx", "react-jsx",
		"--esModuleInterop",
		"--skipLibCheck",
		"--incremental", "false",
	], { cwd: repoRoot, stdio: "inherit" });
}

async function run() {
	compileRuntime();
	const { registerEngineCommand } = require(path.join(outDir, "core", "nenc", "EngineCommand.js"));
	const { createNENCDispatcher } = require(path.join(outDir, "core", "nenc", "NENCDispatcher.js"));
	const { NENCReplayGuard } = require(path.join(outDir, "core", "nenc", "NENCReplay.js"));
	const {
		NENCCommandSecurityPolicy,
		NENCMemoryRateLimitStore,
		NENCRateLimiter,
	} = require(path.join(outDir, "core", "nenc", "NENCCommandSecurity.js"));

	registerEngineCommand("account.read", {
		run: "server",
		auth: "account",
		execute({ principal }) {
			return { subject: principal.subject };
		},
	});

	const replayKeys = [];
	const replay = new NENCReplayGuard({
		maxClockSkewMs: 2_000,
		store: {
			claim(key) {
				if (replayKeys.includes(key)) return false;
				replayKeys.push(key);
				return true;
			},
		},
	});
	const rate = new NENCRateLimiter({
		limit: 2,
		windowMs: 60_000,
		namespace: "account-read",
		store: new NENCMemoryRateLimitStore(),
	});
	const commandSecurity = new NENCCommandSecurityPolicy({
		rules: {
			"account.read": {
				replay,
				rate: {
					limiter: rate,
					key(context) {
						return context.principal?.subject;
					},
				},
			},
		},
	});

	const manifest = {
		version: 1,
		endpoint: "/_static/command",
		buildId: "command-security-smoke",
		headers: {
			selector: "x-engine-selector",
			nonce: "x-engine-nonce",
			timestamp: "x-engine-timestamp",
			signature: "x-engine-signature",
		},
		commandsById: {
			read: {
				id: "read",
				name: "account.read",
				run: "server",
				auth: "account",
				permissions: [],
				argsByName: {},
				argsById: {},
			},
		},
	};
	const dispatcher = createNENCDispatcher({
		manifest,
		api: {},
		commandSecurity,
		replay: { async verify() { throw new Error("command replay override was not used"); } },
		authenticate(_auth, context) {
			const subject = context.request.headers.get("x-account");
			return { authenticated: true, principal: subject ? { subject } : {} };
		},
	});

	function request(subject, nonce, timestamp = Date.now()) {
		return new Request("https://app.example.com/_static/command", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-account": subject,
				"x-engine-selector": "read",
				"x-engine-nonce": nonce,
				"x-engine-timestamp": String(timestamp),
			},
			body: "{}",
		});
	}

	let response = await dispatcher(request("account-1", "command_rate_nonce_0001"));
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { subject: "account-1" });
	response = await dispatcher(request("account-1", "command_rate_nonce_0002"));
	assert.equal(response.status, 200, "requests inside the command budget must execute");
	response = await dispatcher(request("account-1", "command_rate_nonce_0003"));
	assert.equal(response.status, 429, "the third request for one principal must be rate limited");
	assert.ok(Number(response.headers.get("Retry-After")) >= 1);
	response = await dispatcher(request("account-2", "command_rate_nonce_0004"));
	assert.equal(response.status, 200, "rate keys must isolate principals");
	assert.ok(replayKeys.every((key) => key.startsWith("account.read:")), "command replay claims must be namespaced");

	response = await dispatcher(request("account-3", "command_replay_nonce_01"));
	assert.equal(response.status, 200);
	response = await dispatcher(request("account-3", "command_replay_nonce_01"));
	assert.equal(response.status, 409, "duplicate command nonces must be rejected before rate accounting");
	response = await dispatcher(request("account-4", "command_stale_nonce_01", Date.now() - 10_000));
	assert.equal(response.status, 409, "command-specific replay windows must reject stale requests");
	response = await dispatcher(request("", "command_keyless_nonce_01"));
	assert.equal(response.status, 429, "configured rate policies must fail closed without a key");

	const failedStore = new NENCRateLimiter({
		limit: 1,
		windowMs: 1_000,
		store: { consume() { throw new Error("offline"); } },
	});
	assert.equal((await failedStore.verify("account-1")).reason, "store-failure");
	assert.throws(
		() => new NENCCommandSecurityPolicy({ rules: { "bad command": {} } }),
		/Invalid command policy name/,
	);
	console.log("Generation 3 NENC command replay/rate security smoke: ok");
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
