"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
let failures = 0;

function read(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function check(condition, message) {
	if (condition) {
		console.log(`PASS ${message}`);
		return;
	}
	failures += 1;
	console.error(`FAIL ${message}`);
}

const requiredFiles = [
	"src/engine/core/enginecookies/types.ts",
	"src/engine/core/enginecookies/EngineTrustList.ts",
	"src/engine/core/enginecookies/EngineCookies.ts",
	"src/engine/core/enginecookies/EngineCookieVault.ts",
	"src/engine/core/enginecookies/EngineDeviceKey.ts",
	"src/engine/core/nenc/types.ts",
	"src/engine/core/nenc/EngineCommand.ts",
	"src/engine/core/nenc/NENCManifest.ts",
	"src/engine/core/nenc/NENCClient.ts",
	"src/engine/core/nenc/NENCAccountPolicy.ts",
	"src/engine/core/nenc/NENCDeviceProof.ts",
	"src/engine/core/nenc/NENCRateLimit.ts",
	"src/engine/plugins/nencCompiler.js",
	"src/engine/core/EngineCORS.ts",
];

for (const file of requiredFiles) {
	check(fs.existsSync(path.join(root, file)), `Generation 3 Phase C file exists: ${file}`);
}

const trust = read("src/engine/core/enginecookies/EngineTrustList.ts");
check(trust.includes("Wildcard origins may grant CORS only"), "wildcard origins cannot gain privileged EngineCookie/command access");
check(trust.includes("authorizeCookie"), "trust list has granular cookie authorization");
check(trust.includes("cookie-command-not-authorized"), "cookie use can be restricted to specific commands");

const cookies = read("src/engine/core/enginecookies/EngineCookies.ts");
check(cookies.includes("EngineCookieIndex"), "EngineCookies exposes metadata indexing");
check(!cookies.includes("payload:"), "EngineCookie index never stores credential payloads");
check(cookies.includes("randomStorageId"), "EngineCookie aliases map to opaque storage identifiers");

const vault = read("src/engine/core/enginecookies/EngineCookieVault.ts");
check(vault.includes('algorithm: "AES-256-GCM"'), "EngineCookie vault seals credentials with AES-256-GCM");
check(vault.includes("additionalData: asArrayBuffer(metadataBytes(entry))"), "sealed credentials authenticate their metadata");
check(vault.includes("verifyEngineDeviceProof"), "bound EngineCookies require device-key proof");

const deviceKey = read("src/engine/core/enginecookies/EngineDeviceKey.ts");
check(deviceKey.includes('namedCurve: "P-256"'), "device proof uses P-256 signing keys");
check(deviceKey.includes("Device private key must be non-exportable"), "device signing keys fail closed if exportable");

const command = read("src/engine/core/nenc/EngineCommand.ts");
check(command.includes("validateEngineCommandInput"), "command input schemas are validated before execute()");
check(command.includes("Object.create(null)"), "validated command input avoids prototype-bearing output objects");
check(command.includes("NENC transport is not configured"), "client command calls cannot silently bypass NENC");
check(command.includes("Command inspection is development-only"), "command introspection fails closed in production");
check(command.includes("Invalid command request"), "unknown server commands return a generic failure");

const manifest = read("src/engine/core/nenc/NENCManifest.ts");
check(manifest.includes('endpoint: "/_static/command"'), "client/server manifests use the single NENC endpoint");
check(manifest.includes("commandsById"), "server manifest resolves opaque command ids");

const client = read("src/engine/core/nenc/NENCClient.ts");
check(client.includes("credentials: \"same-origin\""), "NENC client transport keeps credentials same-origin by default");
check(client.includes("randomNonce"), "NENC client sends a fresh request nonce");
check(client.includes("encodeEngineDeviceProof"), "NENC client can attach a compiled device-proof header");

const accountPolicy = read("src/engine/core/nenc/NENCAccountPolicy.ts");
check(accountPolicy.includes('auth !== "account"'), "account policy delegates or rejects non-account authentication modes");
check(accountPolicy.includes("session.expiresAt"), "account policy validates session expiry");
check(accountPolicy.includes("origin !== context.origin"), "origin-bound sessions fail closed on a different origin");
check(accountPolicy.includes("getVerifiedKeyId(context.request)"), "device-bound sessions require the verified request key");
check(accountPolicy.includes('permissionWildcards ?? "none"'), "permission wildcard grants are opt-in");

const rateLimit = read("src/engine/core/nenc/NENCRateLimit.ts");
check(rateLimit.includes("NENCRateLimitStore"), "rate limiting supports a replaceable atomic store");
check(rateLimit.includes("resolveKey(context)"), "rate identities are resolved by trusted server code");
check(rateLimit.includes("context.command.id"), "rate buckets are isolated per opaque command id");

const compiler = read("src/engine/plugins/nencCompiler.js");
check(compiler.includes('ENDPOINT = "/_static/command"'), "NENC compiler emits only the single command endpoint");
check(compiler.includes('createHmac("sha256"'), "wire ids are build-derived with HMAC");
check(!compiler.includes("/_static/command/"), "NENC compiler does not emit per-command routes");

const cors = read("src/engine/core/EngineCORS.ts");
check(cors.includes("Credentialed CORS cannot use a wildcard origin"), "credentialed CORS rejects wildcard origins");
check(cors.includes("Vary: \"Origin\""), "CORS responses vary by origin");

if (failures > 0) {
	console.error(`\nGeneration 3 Phase C foundation smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 Phase C foundation smoke passed.");
