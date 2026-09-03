"use strict";

const { compileNENCManifest, ENDPOINT } = require("../src/engine/plugins/nencCompiler");

let failures = 0;
function check(condition, message) {
	if (condition) {
		console.log(`PASS ${message}`);
		return;
	}
	failures += 1;
	console.error(`FAIL ${message}`);
}

const commands = [{
	name: "privateSearch",
	run: "server",
	auth: "account",
	permissions: ["catalog.read"],
	replay: { maxAgeMs: 10_000, maxFutureSkewMs: 1_000 },
	rateLimit: { limit: 20, windowMs: 60_000 },
	input: {
		search: { type: "string", maxLength: 120 },
		page: { type: "number", optional: true, min: 1, max: 50 },
	},
}];

const first = compileNENCManifest(commands, { seed: "wire-test", buildId: "build-a" });
const repeat = compileNENCManifest(commands, { seed: "wire-test", buildId: "build-a" });
const nextBuild = compileNENCManifest(commands, { seed: "wire-test", buildId: "build-b" });

check(ENDPOINT === "/_static/command", "NENC owns exactly one command endpoint");
check(JSON.stringify(first) === JSON.stringify(repeat), "same build seed produces stable wire ids");
check(
	first.client.commands.privateSearch.id !== nextBuild.client.commands.privateSearch.id,
	"command ids change across builds",
);

const clientCommand = first.client.commands.privateSearch;
const serverCommand = first.server.commandsById[clientCommand.id];
check(Boolean(serverCommand), "server manifest resolves the client opaque command id");
check(serverCommand.name === "privateSearch", "server manifest maps opaque id back to logical command");
check(clientCommand.args.search !== "search", "search argument is opaque on the wire");
check(clientCommand.args.page !== "page", "page argument is opaque on the wire");
check(serverCommand.argsById[clientCommand.args.search] === "search", "server reverses opaque argument ids");
check(serverCommand.replay.maxAgeMs === 10_000, "server manifest carries command replay policy");
check(serverCommand.rateLimit.limit === 20, "server manifest carries command rate policy");
check(clientCommand.replay === undefined && clientCommand.rateLimit === undefined, "client manifest does not expose traffic policy");

const headerValues = Object.values(first.client.headers);
check(new Set(headerValues).size === headerValues.length, "compiled NENC headers are unique");
check(headerValues.every((name) => /^x-h[A-Za-z0-9_-]+$/.test(name)), "compiled header names are valid opaque tokens");
check(!clientCommand.id.includes("privateSearch"), "wire command id does not expose the logical command name");

let duplicateRejected = false;
try {
	compileNENCManifest([...commands, commands[0]], { seed: "wire-test", buildId: "duplicate" });
} catch {
	duplicateRejected = true;
}
check(duplicateRejected, "duplicate logical commands fail compilation");

let invalidRateRejected = false;
try {
	compileNENCManifest([{ ...commands[0], rateLimit: { limit: 0, windowMs: 60_000 } }], { seed: "wire-test" });
} catch {
	invalidRateRejected = true;
}
check(invalidRateRejected, "invalid command rate policy fails compilation");

if (failures > 0) {
	console.error(`\nGeneration 3 NENC wire smoke failed with ${failures} issue(s).`);
	process.exit(1);
}
console.log("\nGeneration 3 NENC wire smoke passed.");
