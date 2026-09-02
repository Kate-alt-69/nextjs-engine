"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-account-policy-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/nenc/NENCAccountPolicy.ts",
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
	], {
		cwd: repoRoot,
		stdio: "inherit",
	});
}

function commandManifest() {
	return {
		version: 1,
		endpoint: "/_static/command",
		buildId: "account-policy-smoke",
		headers: {
			selector: "x-command",
			nonce: "x-nonce",
			timestamp: "x-timestamp",
			signature: "x-signature",
		},
		commandsById: {
			cProfile: {
				id: "cProfile",
				name: "account.profile.smoke",
				run: "server",
				auth: "account",
				permissions: ["profile.read"],
				argsByName: { value: "aValue" },
				argsById: { aValue: "value" },
			},
		},
	};
}

function authenticationContext(manifest, origin = "https://app.example.com") {
	return {
		request: new Request("https://app.example.com/_static/command", { method: "POST" }),
		origin,
		command: manifest.commandsById.cProfile,
		input: { value: "hello" },
	};
}

function commandRequest(manifest, cookie, nonce) {
	const headers = new Headers({
		[manifest.headers.selector]: "cProfile",
		[manifest.headers.nonce]: nonce,
		[manifest.headers.timestamp]: String(Date.now()),
		"Content-Type": "application/json",
	});
	if (cookie) headers.set("Cookie", `session=${cookie}`);
	return new Request("https://app.example.com/_static/command", {
		method: "POST",
		headers,
		body: JSON.stringify({ aValue: "hello" }),
	});
}

async function run() {
	compileRuntime();
	const { EngineAPIResolver } = require(path.join(outDir, "core", "EngineAPIResolver.js"));
	const {
		createNENCAccountPolicy,
		isNENCAccountPrincipal,
	} = require(path.join(outDir, "core", "nenc", "NENCAccountPolicy.js"));
	const { createNENCDispatcher } = require(path.join(outDir, "core", "nenc", "NENCDispatcher.js"));
	const { registerEngineCommand } = require(path.join(outDir, "core", "nenc", "EngineCommand.js"));

	const manifest = commandManifest();
	const now = Date.now();
	const sessions = {
		valid: {
			sessionId: "session-valid",
			accountId: "account-42",
			permissions: ["profile.read"],
			expiresAt: now + 60_000,
			origin: "https://app.example.com/path-is-normalized",
			attributes: { displayName: "Kate" },
		},
		limited: {
			sessionId: "session-limited",
			accountId: "account-43",
			permissions: ["profile.write"],
			expiresAt: now + 60_000,
		},
		expired: {
			sessionId: "session-expired",
			accountId: "account-44",
			permissions: ["profile.read"],
			expiresAt: now - 1,
		},
	};
	const rejections = [];
	const policy = createNENCAccountPolicy({
		now: () => now,
		resolveSession(context) {
			const token = /(?:^|;\s*)session=([^;]+)/.exec(context.request.headers.get("Cookie") ?? "")?.[1];
			return token ? sessions[token] ?? null : null;
		},
		onSessionRejected(reason) {
			rejections.push(reason);
		},
	});

	const authContext = authenticationContext(manifest);
	const authenticated = await policy.authenticate("account", {
		...authContext,
		request: commandRequest(manifest, "valid", "account_policy_direct_0001"),
	});
	assert.equal(authenticated.authenticated, true);
	assert.equal(isNENCAccountPrincipal(authenticated.principal), true);
	assert.equal(authenticated.principal.accountId, "account-42");
	assert.equal(Object.isFrozen(authenticated.principal), true);
	assert.equal(Object.isFrozen(authenticated.principal.permissions), true);
	assert.equal(await policy.authorize({
		...authContext,
		principal: authenticated.principal,
		permissions: ["profile.read"],
	}), true, "exact permissions must authorize");
	assert.equal(await policy.authorize({
		...authContext,
		principal: authenticated.principal,
		permissions: ["profile.read", "profile.write"],
	}), false, "every declared permission must be granted");

	const expired = await policy.authenticate("account", {
		...authContext,
		request: commandRequest(manifest, "expired", "account_policy_direct_0002"),
	});
	assert.equal(expired.authenticated, false);
	assert.ok(rejections.includes("expired"));

	const wrongOrigin = await policy.authenticate("account", {
		...authContext,
		origin: "https://other.example.com",
		request: commandRequest(manifest, "valid", "account_policy_direct_0003"),
	});
	assert.equal(wrongOrigin.authenticated, false);
	assert.ok(rejections.includes("origin-mismatch"));

	const boundRequest = commandRequest(manifest, "valid", "account_policy_direct_0004");
	const boundPolicy = createNENCAccountPolicy({
		now: () => now,
		verifiedDeviceKeys: {
			getVerifiedKeyId(request) {
				return request === boundRequest ? "device-key-1" : "different-device";
			},
		},
		resolveSession() {
			return {
				sessionId: "session-bound",
				accountId: "account-bound",
				permissions: ["profile.read"],
				expiresAt: now + 60_000,
				deviceKeyId: "device-key-1",
			};
		},
		onSessionRejected(reason) {
			rejections.push(reason);
		},
	});
	assert.equal(await boundPolicy.authenticate("account", {
		...authContext,
		request: boundRequest,
	}).then((result) => result.authenticated), true, "device-bound session must accept its verified request key");
	assert.equal(await boundPolicy.authenticate("account", authContext).then((result) => result.authenticated), false);
	assert.ok(rejections.includes("device-key-mismatch"));

	const wildcardPolicy = createNENCAccountPolicy({
		now: () => now,
		permissionWildcards: "namespace",
		resolveSession() {
			return {
				sessionId: "session-admin",
				accountId: "account-admin",
				permissions: ["profile.*"],
				expiresAt: now + 60_000,
			};
		},
	});
	const wildcardAuth = await wildcardPolicy.authenticate("account", authContext);
	assert.equal(await wildcardPolicy.authorize({
		...authContext,
		principal: wildcardAuth.principal,
		permissions: ["profile.read"],
	}), true, "namespace wildcards can be enabled explicitly");
	assert.equal(await policy.authenticate("service", authContext).then((result) => result.authenticated), false);

	registerEngineCommand("account.profile.smoke", {
		run: "server",
		auth: "account",
		permissions: ["profile.read"],
		input: { value: "string" },
		execute({ input, principal }) {
			assert.equal(isNENCAccountPrincipal(principal), true, "dispatcher must preserve the authenticated principal");
			return { accountId: principal.accountId, value: input.value };
		},
	});
	const dispatcher = createNENCDispatcher({
		manifest,
		api: new EngineAPIResolver(),
		...policy,
	});

	const validResponse = await dispatcher(commandRequest(manifest, "valid", "account_policy_dispatch_0001"));
	assert.equal(validResponse.status, 200);
	assert.deepEqual(await validResponse.json(), { accountId: "account-42", value: "hello" });

	const missingResponse = await dispatcher(commandRequest(manifest, null, "account_policy_dispatch_0002"));
	assert.equal(missingResponse.status, 401);
	assert.deepEqual(await missingResponse.json(), { error: "invalid_request" });

	const forbiddenResponse = await dispatcher(commandRequest(manifest, "limited", "account_policy_dispatch_0003"));
	assert.equal(forbiddenResponse.status, 403);
	assert.deepEqual(await forbiddenResponse.json(), { error: "invalid_request" });

	console.log("Generation 3 NENC account policy smoke: ok");
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
