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

const dispatcher = read("src/engine/core/nenc/NENCDispatcher.ts");
const replay = read("src/engine/core/nenc/NENCReplay.ts");
const server = read("src/engine/server.ts");

check(dispatcher.includes('request.method.toUpperCase() !== "POST"'), "dispatcher rejects non-POST command execution");
check(dispatcher.includes("maxBodyBytes"), "dispatcher enforces a configurable request-body budget");
check(dispatcher.includes("commandsById[selector]"), "dispatcher resolves only compiled opaque command ids");
check(dispatcher.includes("argsById[wireName]"), "dispatcher reverses compiled opaque argument ids");
check(dispatcher.includes("authorizeCommand(origin, command.name)"), "cross-origin command execution passes through Trust List authorization");
check(dispatcher.includes('command.auth !== "anonymous"'), "non-anonymous commands require authentication");
check(dispatcher.includes("command.permissions.length > 0"), "permission-bearing commands require authorization");
check(dispatcher.includes("verifySignature"), "dispatcher exposes signature verification before execution");
check(dispatcher.includes("executeRegisteredEngineCommand"), "dispatcher executes through the EngineCommand registry");
check(dispatcher.includes("resolveAPI(options)"), "dispatcher supplies EngineAPIResolver to command execution");
check(dispatcher.includes("principal,"), "dispatcher supplies the authenticated principal to command execution");
check(!dispatcher.includes("Available commands"), "dispatcher never returns a command list");

check(replay.includes("NENCReplayStore"), "replay protection supports a replaceable persistence store");
check(replay.includes("replayed-nonce"), "duplicate nonce claims are rejected");
check(replay.includes("maxClockSkewMs"), "timestamp freshness is bounded");
check(replay.includes("NONCE_PATTERN"), "malformed nonces are rejected before storage");

check(server.includes("createNENCDispatcher"), "server package exports the single NENC dispatcher factory");
check(server.includes("createNENCAccountPolicy"), "server package exports the account-session policy adapter");
check(server.includes("NENCReplayGuard"), "server package exports replay protection");

if (failures > 0) {
	console.error(`\nGeneration 3 NENC dispatcher smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 NENC dispatcher smoke passed.");
