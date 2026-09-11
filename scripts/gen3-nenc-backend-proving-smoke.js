"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { compileNENCManifest } = require("../src/engine/plugins/nencCompiler");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-backend-proving-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/EngineAPIResolver.ts",
		"src/engine/core/nenc/NENCCommandAPI.ts",
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

function wireRequest(manifest, commandName, input, options = {}) {
	const command = manifest.client.commands[commandName];
	const body = Object.fromEntries(Object.entries(input).map(([name, value]) => [command.args[name], value]));
	const headers = new Headers({
		"Content-Type": "application/json",
		[manifest.client.headers.selector]: command.id,
		[manifest.client.headers.nonce]: options.nonce || "backend_proving_nonce_0001",
		[manifest.client.headers.timestamp]: String(options.now),
	});
	if (options.cookie) headers.set("Cookie", options.cookie);
	if (options.origin) headers.set("Origin", options.origin);
	return new Request("https://app.example.com/_static/command", {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
}

async function run() {
	compileRuntime();
	const { EngineAPIResolver } = require(path.join(outDir, "core", "EngineAPIResolver.js"));
	const { registerEngineCommand } = require(path.join(outDir, "core", "nenc", "EngineCommand.js"));
	const { createNENCCommandAPIResolverFactory } = require(path.join(outDir, "core", "nenc", "NENCCommandAPI.js"));
	const { createNENCDispatcher } = require(path.join(outDir, "core", "nenc", "NENCDispatcher.js"));
	const {
		createNENCAccountSessionPolicy,
		hashNENCSessionToken,
	} = require(path.join(outDir, "core", "nenc", "NENCSessionAuth.js"));

	registerEngineCommand("catalog.publicSearch", {
		run: "server",
		auth: "anonymous",
		input: { search: "string" },
		async execute({ input, api }) {
			const response = await api.resolveRequest({ input });
			const payload = await response.json();
			return { source: payload.source, items: payload.items };
		},
	});
	registerEngineCommand("catalog.privateSearch", {
		run: "server",
		auth: "account",
		permissions: ["catalog.read"],
		input: { search: "string" },
		async execute({ input, api, principal }) {
			const response = await api.resolveRequest({ input });
			const payload = await response.json();
			return {
				account: principal.subject,
				items: payload.items.map(({ id, title }) => ({ id, title })),
			};
		},
	});

	const manifest = compileNENCManifest([
		{
			name: "catalog.publicSearch",
			run: "server",
			auth: "anonymous",
			input: { search: {} },
		},
		{
			name: "catalog.privateSearch",
			run: "server",
			auth: "account",
			permissions: ["catalog.read"],
			input: { search: {} },
		},
	], { seed: "backend-proving-seed", buildId: "backend-proving-build" });

	const now = 2_000_000_000_000;
	const privateBackendToken = "server_only_private_backend_token";
	const sessionToken = "session_token_abcdefghijklmnopqrstuvwxyz_123456";
	const sessionTokenHash = await hashNENCSessionToken(sessionToken);
	let currentSession = {
		id: "session-proving-1",
		subject: "account-kate",
		permissions: ["catalog.read"],
		commands: ["catalog.privateSearch"],
		origins: ["https://app.example.com"],
		expiresAt: now + 60_000,
	};
	const accountSessions = createNENCAccountSessionPolicy({
		now: () => now,
		async resolveSession(candidateHash) {
			return candidateHash === sessionTokenHash ? currentSession : null;
		},
	});
	const requests = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init = {}) => {
		const request = {
			url: String(url),
			method: init.method,
			headers: new Headers(init.headers),
			body: init.body,
		};
		requests.push(request);
		if (request.url === "https://ordinary.invalid/search") {
			return Response.json({ source: "ordinary-rest", items: [{ id: 1, title: "Public result" }] });
		}
		if (request.url === "https://private.invalid/search") {
			return Response.json({
				items: [{ id: 7, title: "Private result", databaseScore: 0.98 }],
				internal: { databaseHost: "postgres.internal", queryPlan: "secret-index" },
				credentialEcho: privateBackendToken,
			});
		}
		throw new Error(`Unexpected backend request: ${request.url}`);
	};

	try {
		const publicAPIConfig = {
			endpoint: "https://ordinary.invalid/search",
			method: "POST",
			auth: { type: "none" },
			headers: { "X-Powered-By": "Next.js Engine" },
		};
		const privateAPIConfig = {
			endpoint: "https://private.invalid/search",
			method: "POST",
			auth: { type: "bearer", token: privateBackendToken },
			headers: { "X-Engine-Command": "privateSearch" },
		};
		const resolverContexts = [];
		const api = createNENCCommandAPIResolverFactory({
			async resolve(context) {
				resolverContexts.push(context);
				if (context.commandName === "catalog.publicSearch") return publicAPIConfig;
				if (context.commandName === "catalog.privateSearch") return privateAPIConfig;
				throw new Error("No scoped backend resolver for command.");
			},
		});
		const dispatcher = createNENCDispatcher({
			manifest: manifest.server,
			api,
			replay: { async verify() { return { allowed: true, reason: "ok" }; } },
			authenticate: accountSessions.authenticate,
			authorize: accountSessions.authorize,
		});

		let response = await dispatcher(wireRequest(manifest, "catalog.publicSearch", {
			search: "public",
		}, { now }));
		assert.equal(response.status, 200, "an ordinary backend must work without NENC awareness");
		assert.deepEqual(await response.json(), {
			source: "ordinary-rest",
			items: [{ id: 1, title: "Public result" }],
		});
		assert.equal(requests.length, 1);
		assert.equal(requests[0].url, "https://ordinary.invalid/search");
		assert.equal(requests[0].method, "POST");
		assert.deepEqual(JSON.parse(requests[0].body), { search: "public" });
		assert.equal(requests[0].headers.has("Authorization"), false);
		assert.equal(requests[0].headers.has("X-Powered-By"), false, "resolver must strip framework fingerprints");
		assert.equal(resolverContexts.length, 1);
		assert.equal(resolverContexts[0].commandName, "catalog.publicSearch");

		response = await dispatcher(wireRequest(manifest, "catalog.privateSearch", {
			search: "private",
		}, { now, nonce: "backend_proving_nonce_0002" }));
		assert.equal(response.status, 401, "private backend access must fail before fetch without a session");
		assert.equal(requests.length, 1, "unauthenticated commands must not reach the private backend");
		assert.equal(resolverContexts.length, 1, "unauthenticated commands must not receive a backend resolver");

		currentSession = { ...currentSession, permissions: ["profile.read"] };
		response = await dispatcher(wireRequest(manifest, "catalog.privateSearch", {
			search: "private",
		}, {
			now,
			nonce: "backend_proving_nonce_0003",
			cookie: `__Host-engine-session=${sessionToken}`,
		}));
		assert.equal(response.status, 403, "private backend access must fail before fetch without permission");
		assert.equal(requests.length, 1, "unauthorized commands must not reach the private backend");
		assert.equal(resolverContexts.length, 1, "unauthorized commands must not receive a backend resolver");

		currentSession = { ...currentSession, permissions: ["catalog.read"] };
		response = await dispatcher(wireRequest(manifest, "catalog.privateSearch", {
			search: "private",
		}, {
			now,
			nonce: "backend_proving_nonce_0004",
			cookie: `__Host-engine-session=${sessionToken}`,
		}));
		assert.equal(response.status, 200);
		const privateResultText = await response.text();
		assert.deepEqual(JSON.parse(privateResultText), {
			account: "account-kate",
			items: [{ id: 7, title: "Private result" }],
		});
		assert.equal(requests.length, 2);
		assert.equal(resolverContexts.length, 2);
		assert.equal(resolverContexts[1].principal.subject, "account-kate");
		assert.deepEqual(Object.keys(resolverContexts[1]).sort(), [
			"auth", "commandName", "origin", "permissions", "principal", "signal",
		]);
		assert.equal(Object.isFrozen(resolverContexts[1]), true);
		assert.equal(Object.isFrozen(resolverContexts[1].permissions), true);
		for (const forbidden of ["request", "cookie", "signature", "timestamp", "nonce", "input"]) {
			assert.equal(
				Object.hasOwn(resolverContexts[1], forbidden),
				false,
				`${forbidden} must not enter the backend resolver context`,
			);
		}
		assert.equal(requests[1].url, "https://private.invalid/search");
		assert.equal(requests[1].headers.get("Authorization"), `Bearer ${privateBackendToken}`);
		assert.equal(requests[1].headers.has("X-Engine-Command"), false, "resolver must strip engine fingerprints");
		assert.deepEqual(JSON.parse(requests[1].body), { search: "private" });
		assert.equal(privateResultText.includes(privateBackendToken), false, "backend credentials must not reach the browser");
		assert.equal(privateResultText.includes(sessionToken), false, "session credentials must not reach the browser");
		assert.equal(privateResultText.includes("postgres.internal"), false, "private backend internals must be sanitized");

		response = await dispatcher(wireRequest(manifest, "catalog.privateSearch", {
			search: "private",
		}, {
			now,
			nonce: "backend_proving_nonce_0005",
			cookie: `__Host-engine-session=${sessionToken}`,
			origin: "https://untrusted.example.com",
		}));
		assert.equal(response.status, 403, "untrusted origins must fail before backend resolver creation");
		assert.equal(requests.length, 2);
		assert.equal(resolverContexts.length, 2);

		const directAPI = new EngineAPIResolver(publicAPIConfig);
		await directAPI.resolveRequest({
			nodeOverrides: { endpoint: "https://ordinary.invalid/search", method: "POST" },
			formData: { ignored: true },
			input: false,
		});
		assert.equal(requests[2].body, "false", "explicit input must take precedence over the formData fallback");
		assert.throws(
			() => createNENCCommandAPIResolverFactory({}),
			/resolve\(\) is required/,
		);

		console.log("Generation 3 NENC backend proving flows smoke: ok");
	} finally {
		globalThis.fetch = originalFetch;
	}
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
