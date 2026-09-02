"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, ".gen3-cookie-smoke");

function compileRuntime() {
	fs.rmSync(outDir, { recursive: true, force: true });
	const tscPath = require.resolve("typescript/lib/tsc.js");
	execFileSync(process.execPath, [
		tscPath,
		"src/engine/core/enginecookies/EngineCookieVault.ts",
		"src/engine/core/enginecookies/EngineDeviceKey.ts",
		"src/engine/core/enginecookies/EngineTrustList.ts",
		"src/engine/core/nenc/NENCClient.ts",
		"src/engine/core/nenc/NENCDeviceProof.ts",
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

function corruptCiphertext(value) {
	return `${value.startsWith("A") ? "B" : "A"}${value.slice(1)}`;
}

async function expectAccessError(operation, code) {
	await assert.rejects(operation, (error) => error && error.code === code);
}

async function run() {
	compileRuntime();
	const cookies = require(path.join(outDir, "core", "enginecookies", "index.js"));
	const { createNENCTransport } = require(path.join(outDir, "core", "nenc", "NENCClient.js"));
	const { createNENCDeviceSignatureVerifier } = require(path.join(outDir, "core", "nenc", "NENCDeviceProof.js"));

	const environment = "engine-smoke:browser-family-v1";
	const deviceKey = await cookies.EngineDeviceKey.create({ environment });
	assert.equal(deviceKey.privateKeyExtractable, false, "device private key must be non-exportable");
	assert.equal(deviceKey.identity.algorithm, "ECDSA-P256-SHA256");
	assert.ok(deviceKey.identity.environmentHash);
	assert.equal(deviceKey.identity.publicKey.d, undefined, "public identity must never expose private key material");
	assert.equal(cookies.isEngineDevicePublicIdentity(deviceKey.identity), true);

	const trust = new cookies.EngineTrustList({
		rules: [{
			origin: "https://app.example.com",
			commands: ["privateSearch"],
			cookies: [{
				cookie: "account-session",
				actions: ["use", "write", "delete"],
				commands: ["privateSearch"],
			}],
		}],
	});
	const store = new cookies.EngineCookieMemoryStore();
	const vault = await cookies.EngineCookieVault.create({ store, trust });
	const entry = await vault.seal({
		alias: "account-session",
		owner: "https://api.example.com",
		creator: "account.login",
		purpose: "Authentication",
		binding: "device-key+environment",
		commands: ["privateSearch"],
		device: deviceKey.identity,
		environmentHash: deviceKey.identity.environmentHash,
	}, "secret-session-token");

	const indexed = JSON.stringify(vault.index.list());
	assert.ok(!indexed.includes("secret-session-token"), "metadata index must not contain plaintext credentials");
	const sealed = await store.get(entry.storageId);
	assert.ok(sealed && sealed.ciphertext && !sealed.ciphertext.includes("secret-session-token"));

	const rawBody = JSON.stringify({ search: "minecraft" });
	const timestamp = Date.now();
	const nonce = "engine_device_nonce_0001";
	const bodyHash = await cookies.hashEngineDeviceValue(rawBody);
	const proof = await deviceKey.createProof({
		method: "POST",
		target: "/_static/command",
		origin: "https://api.example.com",
		bodyHash,
		timestamp,
		nonce,
	});
	const deviceProof = {
		proof,
		expected: {
			method: "POST",
			target: "/_static/command",
			origin: "https://api.example.com",
			bodyHash,
			timestamp,
			nonce,
		},
	};
	const access = {
		origin: "https://app.example.com",
		command: "privateSearch",
		deviceProof,
	};
	const unsealed = await vault.use(
		"account-session",
		access,
		(payload) => new TextDecoder().decode(payload),
	);
	assert.equal(unsealed, "secret-session-token");

	await expectAccessError(
		() => vault.use("account-session", { ...access, origin: "https://evil.example" }, () => undefined),
		"origin-not-trusted",
	);
	await expectAccessError(
		() => vault.use("account-session", { ...access, command: "admin.delete" }, () => undefined),
		"command-not-authorized",
	);
	const modifiedBodyHash = await cookies.hashEngineDeviceValue("modified");
	await expectAccessError(
		() => vault.use("account-session", {
			...access,
			deviceProof: {
				...deviceProof,
				expected: { ...deviceProof.expected, bodyHash: modifiedBodyHash },
			},
		}, () => undefined),
		"device-proof-invalid",
	);
	const copiedDevice = await cookies.EngineDeviceKey.create({ environment });
	const copiedProof = await copiedDevice.createProof({
		...deviceProof.expected,
	});
	await expectAccessError(
		() => vault.use("account-session", {
			...access,
			deviceProof: { proof: copiedProof, expected: deviceProof.expected },
		}, () => undefined),
		"device-proof-invalid",
	);
	await assert.rejects(
		() => vault.use("account-session", access, () => {
			throw new Error("operation-failed");
		}),
		(error) => error && error.message === "operation-failed",
		"consumer failures must not be misreported as ciphertext tampering",
	);

	const encodedProof = cookies.encodeEngineDeviceProof(proof);
	assert.deepEqual(cookies.decodeEngineDeviceProof(encodedProof), proof, "device proofs must round-trip through the header codec");
	const verifier = createNENCDeviceSignatureVerifier({
		resolveIdentity(keyId) {
			return keyId === deviceKey.identity.keyId ? deviceKey.identity : null;
		},
	});
	const signatureContext = {
		request: new Request("https://api.example.com/_static/command", { method: "POST" }),
		origin: "https://app.example.com",
		command: { name: "privateSearch" },
		input: { search: "minecraft" },
		rawBody,
		signature: encodedProof,
		timestamp: String(timestamp),
		nonce,
	};
	assert.equal(await verifier(signatureContext), true, "NENC verifier must accept the exact signed request context");
	assert.equal(verifier.getVerifiedKeyId(signatureContext.request), deviceKey.identity.keyId, "verified device identity remains request-scoped for account binding");
	assert.equal(await verifier({ ...signatureContext, rawBody: "modified" }), false, "NENC verifier must reject a modified body");
	assert.equal(verifier.getVerifiedKeyId(signatureContext.request), undefined, "failed verification clears request-scoped device identity");

	let capturedRequest;
	const manifest = {
		version: 1,
		endpoint: "/_static/command",
		buildId: "cookie-smoke",
		headers: {
			selector: "x-hselector",
			nonce: "x-hnonce",
			timestamp: "x-htimestamp",
			signature: "x-hsignature",
		},
		commands: {
			privateSearch: { id: "cPrivate", args: { search: "aSearch" } },
		},
	};
	const transport = createNENCTransport(manifest, {
		deviceKey,
		destinationOrigin: "https://api.example.com",
		async fetcher(target, init) {
			capturedRequest = { target, init };
			return Response.json({ ok: true });
		},
	});
	assert.deepEqual(await transport("privateSearch", { search: "minecraft" }), { ok: true });
	assert.equal(capturedRequest.target, "/_static/command");
	assert.ok(capturedRequest.init.headers.get(manifest.headers.signature), "device-bound transport must send a proof header");

	await vault.replace("account-session", "rotated-session-token", access);
	assert.equal(
		await vault.use("account-session", access, (payload) => new TextDecoder().decode(payload)),
		"rotated-session-token",
	);
	const rotated = await store.get(entry.storageId);
	await store.set({ ...rotated, ciphertext: corruptCiphertext(rotated.ciphertext) });
	await expectAccessError(
		() => vault.use("account-session", access, () => undefined),
		"sealed-record-invalid",
	);

	await vault.replace("account-session", "recovered-session-token", access);
	assert.equal(await vault.remove("account-session", access), true);
	assert.equal(await store.get(entry.storageId), undefined);
	assert.equal(vault.index.get("account-session"), undefined);

	console.log("Generation 3 EngineCookie vault/device proof smoke: ok");
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});
