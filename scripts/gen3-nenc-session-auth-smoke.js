"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-session-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/nenc/NENCDispatcher.ts",
		"src/engine/core/nenc/NENCSessionAuth.ts",
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

function encodeProof(keyId) {
	const proof = {
		version: 1,
		keyId,
		algorithm: "ECDSA-P256-SHA256",
		method: "POST",
		target: "/_static/command",
		origin: "https://app.example.com",
		bodyHash: "A".repeat(43),
		timestamp: 2_000_000_000_000,
		nonce: "session_auth_nonce_0001",
		signature: "A".repeat(64),
	};
	return Buffer.from(JSON.stringify(proof)).toString("base64url");
}

async function run() {
	compileRuntime();
	const { registerEngineCommand } = require(path.join(outDir, "core", "nenc", "EngineCommand.js"));
	const { createNENCDispatcher } = require(path.join(outDir, "core", "nenc", "NENCDispatcher.js"));
	const {
		createNENCAccountSessionPolicy,
		hashNENCSessionToken,
	} = require(path.join(outDir, "core", "nenc", "NENCSessionAuth.js"));

	registerEngineCommand("account.read", {
		run: "server",
		auth: "account",
		permissions: ["account:read"],
		input: { query: "string" },
		execute({ input, principal }) {
			return { input, principal };
		},
	});
	registerEngineCommand("account.admin", {
		run: "server",
		auth: "account",
		permissions: ["account:admin"],
		execute() {
			return { admin: true };
		},
	});

	const now = 2_000_000_000_000;
	const token = "session_token_abcdefghijklmnopqrstuvwxyz_123456";
	const tokenHash = await hashNENCSessionToken(token);
	let resolvedTokenHash;
	let lookupContext;
	let currentSession;
	const policy = createNENCAccountSessionPolicy({
		now: () => now,
		async resolveSession(candidateHash, context) {
			resolvedTokenHash = candidateHash;
			lookupContext = context;
			return currentSession;
		},
	});
	const manifest = {
		version: 1,
		endpoint: "/_static/command",
		buildId: "session-smoke",
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
				permissions: ["account:read"],
				argsByName: { query: "q" },
				argsById: { q: "query" },
			},
			admin: {
				id: "admin",
				name: "account.admin",
				run: "server",
				auth: "account",
				permissions: ["account:admin"],
				argsByName: {},
				argsById: {},
			},
		},
	};
	const replay = { async verify() { return { allowed: true, reason: "ok" }; } };

	function handler(extra = {}) {
		return createNENCDispatcher({
			manifest,
			api: {},
			replay,
			authenticate: policy.authenticate,
			authorize: policy.authorize,
			...extra,
		});
	}

	function request(selector = "read", cookie = `${"__Host-engine-session"}=${token}`, signature) {
		const headers = new Headers({
			"Content-Type": "application/json",
			"x-engine-selector": selector,
			"x-engine-nonce": "session_auth_nonce_0001",
			"x-engine-timestamp": String(now),
		});
		if (cookie !== null) headers.set("Cookie", cookie);
		if (signature) headers.set("x-engine-signature", signature);
		return new Request("https://app.example.com/_static/command", {
			method: "POST",
			headers,
			body: selector === "read" ? JSON.stringify({ q: "profile" }) : "{}",
		});
	}

	currentSession = {
		id: "session-1",
		subject: "account-7",
		permissions: ["account:read"],
		commands: ["account.read"],
		origins: ["https://app.example.com"],
		expiresAt: now + 60_000,
		claims: { plan: "pro" },
	};
	let response = await handler()(request());
	assert.equal(response.status, 200);
	const result = await response.json();
	assert.deepEqual(result.input, { query: "profile" });
	assert.equal(result.principal.subject, "account-7", "principal must reach command execution");
	assert.equal(result.principal.claims.plan, "pro");
	assert.equal(Object.prototype.hasOwnProperty.call(result.principal, "token"), false);
	assert.equal(resolvedTokenHash, tokenHash, "resolver must receive the one-way token hash");
	assert.notEqual(resolvedTokenHash, token, "resolver must not receive the raw cookie token");
	assert.equal(Object.prototype.hasOwnProperty.call(lookupContext, "request"), false);
	assert.equal(Object.prototype.hasOwnProperty.call(lookupContext, "cookie"), false);

	response = await handler()(request("read", null));
	assert.equal(response.status, 401, "missing session cookie must fail closed");
	response = await handler()(request("read", `__Host-engine-session=${token}; __Host-engine-session=${token}`));
	assert.equal(response.status, 401, "duplicate session cookies must fail closed");

	currentSession = { id: "expired", subject: "account-7", expiresAt: now };
	response = await handler()(request());
	assert.equal(response.status, 401, "expired sessions must fail closed");
	currentSession = { id: "malformed", subject: "account-7", permissions: [""], expiresAt: now + 60_000 };
	response = await handler()(request());
	assert.equal(response.status, 401, "malformed session records must fail closed");
	currentSession = { id: "bad-origin", subject: "account-7", origins: ["not-an-origin"], expiresAt: now + 60_000 };
	response = await handler()(request());
	assert.equal(response.status, 401, "malformed session origin restrictions must fail closed");
	currentSession = { id: "restricted", subject: "account-7", commands: ["account.read"], expiresAt: now + 60_000 };
	response = await handler()(request("admin"));
	assert.equal(response.status, 401, "session command restrictions must be enforced during authentication");
	currentSession = { id: "no-admin", subject: "account-7", permissions: ["account:read"], expiresAt: now + 60_000 };
	response = await handler()(request("admin"));
	assert.equal(response.status, 403, "missing command permissions must fail authorization");

	const deviceKeyId = "device_key_0000000001";
	const proof = encodeProof(deviceKeyId);
	currentSession = {
		id: "device-bound",
		subject: "account-7",
		permissions: ["account:read"],
		expiresAt: now + 60_000,
		deviceKeyId,
	};
	response = await handler({ verifySignature: async () => true })(request("read", undefined, proof));
	assert.equal(response.status, 200, "a verified matching device key must authenticate");
	currentSession = { ...currentSession, deviceKeyId: "other_device_key_0001" };
	response = await handler({ verifySignature: async () => true })(request("read", undefined, proof));
	assert.equal(response.status, 401, "a different device key must fail authentication");

	assert.throws(
		() => createNENCAccountSessionPolicy({ cookieName: "bad cookie", resolveSession() {} }),
		/Invalid session cookie name/,
	);
	console.log("Generation 3 NENC account session auth smoke: ok");
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
