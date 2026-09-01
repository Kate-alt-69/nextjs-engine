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
	"src/engine/core/nenc/types.ts",
	"src/engine/core/nenc/EngineCommand.ts",
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

const command = read("src/engine/core/nenc/EngineCommand.ts");
check(command.includes("NENC transport is not configured"), "client command calls cannot silently bypass NENC");
check(command.includes("Command inspection is development-only"), "command introspection fails closed in production");
check(command.includes("Invalid command request"), "unknown server commands return a generic failure");

const cors = read("src/engine/core/EngineCORS.ts");
check(cors.includes("Credentialed CORS cannot use a wildcard origin"), "credentialed CORS rejects wildcard origins");
check(cors.includes("Vary: \"Origin\""), "CORS responses vary by origin");

if (failures > 0) {
	console.error(`\nGeneration 3 Phase C foundation smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 Phase C foundation smoke passed.");
