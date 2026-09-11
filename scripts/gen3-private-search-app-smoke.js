"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { compileNENCProject } = require("../src/engine/plugins/nencPlugin");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-private-search-app-smoke");
const generatedRoot = path.join(repoRoot, ".gen3-private-search-generated");
const generatedOutput = path.join(generatedRoot, "nenc");
const generatedApp = path.join(generatedRoot, "app");
const appOrigin = "https://app.example.com";
const backendToken = "server_only_backend_token";

function compileExample() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"examples/gen3-private-search/commands.ts",
		"examples/gen3-private-search/client.ts",
		"examples/gen3-private-search/nenc.server.ts",
		"--outDir", outDir,
		"--rootDir", ".",
		"--module", "commonjs",
		"--moduleResolution", "node",
		"--target", "es2022",
		"--jsx", "react-jsx",
		"--esModuleInterop",
		"--skipLibCheck",
		"--incremental", "false",
	], { cwd: repoRoot, stdio: "inherit" });
}

function createBrowserFetcher(handler, state) {
	return async (input, init = {}) => {
		const url = new URL(String(input), appOrigin);
		assert.equal(url.origin, appOrigin, "the browser must only call its application origin");
		assert.equal(url.pathname, "/_static/command", "the browser must use the single NENC endpoint");
		const headers = new Headers(init.headers);
		if (state.cookie) headers.set("Cookie", state.cookie);
		const request = new Request(url, {
			method: init.method,
			headers,
			body: init.body,
		});
		state.browserRequests.push(request.clone());
		state.lastRequest = request.clone();
		const response = await handler(request);
		const setCookie = response.headers.get("Set-Cookie");
		if (setCookie) {
			state.setCookie = setCookie;
			state.cookie = setCookie.split(";", 1)[0];
		}
		return response;
	};
}

async function expectStatus(operation, status, message) {
	await assert.rejects(operation, new RegExp(`\\(${status}\\)`), message);
}

async function run() {
	fs.rmSync(generatedRoot, { recursive: true, force: true });
	const compiled = compileNENCProject({
		projectRoot: repoRoot,
		commandFiles: ["examples/gen3-private-search/commands.ts"],
		handlerModule: "examples/gen3-private-search/nenc.server.ts",
		outputDir: ".gen3-private-search-generated/nenc",
		appDir: ".gen3-private-search-generated/app",
		seed: "private-search-proving-seed",
		buildId: "private-search-proving-build",
		packageName: "nextjs-engine",
	});
	assert.equal(compiled.commands.length, 2);
	assert.equal(compiled.routeFile, path.join(generatedApp, "_static", "command", "route.ts"));
	const routeFiles = fs.readdirSync(path.dirname(compiled.routeFile)).filter((file) => file === "route.ts");
	assert.deepEqual(routeFiles, ["route.ts"], "the plugin must generate exactly one command route");
	for (const [name, command] of Object.entries(compiled.manifest.client.commands)) {
		assert.equal(command.id.includes(name), false, "wire command ids must not contain logical names");
	}

	compileExample();
	require(path.join(outDir, "examples", "gen3-private-search", "commands.js"));
	const { createPrivateSearchHandler } = require(path.join(
		outDir, "examples", "gen3-private-search", "nenc.server.js",
	));
	const { PrivateSearchClient } = require(path.join(
		outDir, "examples", "gen3-private-search", "client.js",
	));
	const { EngineDeviceKey } = require(path.join(
		outDir, "src", "engine", "core", "enginecookies", "EngineDeviceKey.js",
	));

	const backendRequests = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init = {}) => {
		const request = {
			url: String(input),
			method: init.method,
			headers: new Headers(init.headers),
			body: String(init.body ?? ""),
		};
		backendRequests.push(request);
		assert.equal(request.headers.get("Authorization"), `Bearer ${backendToken}`);
		assert.equal(request.headers.has("X-NENC-Command"), false);
		if (request.url === "https://private-backend.invalid/login") {
			const credentials = JSON.parse(request.body);
			if (credentials.email !== "kate@example.com" || credentials.password !== "correct horse battery staple") {
				return Response.json({ error: "invalid_credentials" }, { status: 401 });
			}
			return Response.json({
				id: "account-kate",
				displayName: "Kate",
				permissions: ["catalog.read"],
			});
		}
		if (request.url === "https://private-backend.invalid/search") {
			return Response.json({
				items: [{ id: "result-7", title: "Private shader", rankingSecret: 0.998 }],
				internal: { databaseHost: "postgres.private", queryPlan: "secret-index" },
				credentialEcho: backendToken,
			});
		}
		throw new Error(`Unexpected private backend request: ${request.url}`);
	};

	try {
		const handler = createPrivateSearchHandler(compiled.manifest.server, {
			backendBaseURL: "https://private-backend.invalid/",
			backendToken,
			sessionTTLms: 60_000,
		});
		const browser = { cookie: null, setCookie: null, lastRequest: null, browserRequests: [] };
		const browserFetch = createBrowserFetcher(handler, browser);
		const legitimateDevice = await EngineDeviceKey.create({ keyId: "legitimate_device_0001" });
		const client = await PrivateSearchClient.connect(compiled.manifest.client, {
			fetcher: browserFetch,
			destinationOrigin: appOrigin,
			deviceKey: legitimateDevice,
		});

		await expectStatus(
			() => client.login("kate@example.com", "wrong password"),
			401,
			"invalid credentials must fail closed",
		);
		assert.equal(browser.cookie, null, "invalid credentials must not issue a session cookie");

		const login = await client.login("kate@example.com", "correct horse battery staple");
		assert.deepEqual(login.account, { id: "account-kate", displayName: "Kate" });
		assert.equal(Number.isSafeInteger(login.expiresAt), true);
		assert.equal(Object.hasOwn(login, "token"), false, "raw session tokens must not enter command results");
		assert.match(browser.setCookie, /^__Host-engine-session=[A-Za-z0-9_-]+;/);
		assert.match(browser.setCookie, /; Path=\//);
		assert.match(browser.setCookie, /; Secure/);
		assert.match(browser.setCookie, /; HttpOnly/);
		assert.match(browser.setCookie, /; SameSite=Strict/);
		assert.match(browser.setCookie, /; Max-Age=60$/);

		const capturedLogin = browser.lastRequest.clone();
		const backendCountAfterLogin = backendRequests.length;
		const replay = await handler(capturedLogin);
		assert.equal(replay.status, 409, "an identical signed request must be rejected as a replay");
		assert.equal(backendRequests.length, backendCountAfterLogin, "replays must not reach the private backend");

		const result = await client.search("shader");
		assert.deepEqual(result, {
			account: { id: "account-kate", displayName: "Kate" },
			items: [{ id: "result-7", title: "Private shader" }],
		});
		const browserResult = JSON.stringify(result);
		assert.equal(browserResult.includes(backendToken), false, "backend credentials must not reach the browser");
		assert.equal(browserResult.includes("postgres.private"), false, "backend hostnames must not reach the browser");
		assert.equal(browserResult.includes("rankingSecret"), false, "backend-only result fields must be removed");
		assert.equal(browserResult.includes("credentialEcho"), false, "backend credential echoes must be removed");

		const loginRequest = backendRequests.find((request) => request.url.endsWith("/login") && request.body.includes("correct horse"));
		assert.deepEqual(JSON.parse(loginRequest.body), {
			email: "kate@example.com",
			password: "correct horse battery staple",
		});
		const searchRequest = backendRequests.find((request) => request.url.endsWith("/search"));
		assert.deepEqual(JSON.parse(searchRequest.body), {
			search: "shader",
			accountId: "account-kate",
		});

		const backendCountAfterSearch = backendRequests.length;
		const copiedCookieClient = await PrivateSearchClient.connect(compiled.manifest.client, {
			fetcher: browserFetch,
			destinationOrigin: appOrigin,
		});
		await expectStatus(
			() => copiedCookieClient.search("stolen cookie"),
			401,
			"a copied cookie must fail with a different device key",
		);
		assert.equal(backendRequests.length, backendCountAfterSearch, "a copied cookie must fail before backend access");

		const collidingDevice = await EngineDeviceKey.create({ keyId: legitimateDevice.identity.keyId });
		const collidingKeyClient = await PrivateSearchClient.connect(compiled.manifest.client, {
			fetcher: browserFetch,
			destinationOrigin: appOrigin,
			deviceKey: collidingDevice,
		});
		await expectStatus(
			() => collidingKeyClient.search("colliding key id"),
			401,
			"a copied cookie must fail when another public key reuses the legitimate key id",
		);
		assert.equal(backendRequests.length, backendCountAfterSearch, "a colliding public key must fail before backend access");

		const wrongOriginClient = await PrivateSearchClient.connect(compiled.manifest.client, {
			fetcher: browserFetch,
			destinationOrigin: "https://evil.example",
			deviceKey: legitimateDevice,
		});
		await expectStatus(
			() => wrongOriginClient.search("wrong origin"),
			401,
			"a proof signed for a different origin must fail",
		);
		assert.equal(backendRequests.length, backendCountAfterSearch, "wrong-origin proofs must fail before backend access");

		assert.ok(browser.browserRequests.length >= 5);
		const browserSource = fs.readFileSync(
			path.join(repoRoot, "examples", "gen3-private-search", "client.ts"), "utf8",
		);
		assert.equal(browserSource.includes("PRIVATE_BACKEND_TOKEN"), false);
		assert.equal(browserSource.includes(backendToken), false);
		console.log("Generation 3 private login/search proving application smoke: ok");
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
		fs.rmSync(generatedOutput, { recursive: true, force: true });
		fs.rmSync(generatedApp, { recursive: true, force: true });
		fs.rmSync(generatedRoot, { recursive: true, force: true });
	});
