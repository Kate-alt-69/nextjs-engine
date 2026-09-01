"use strict";

// Build-only NENC wire compiler. Opaque ids reduce transport readability; they
// are never treated as authorization credentials.

const { createHmac, randomBytes } = require("node:crypto");

const ENDPOINT = "/_static/command";
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

function seedBuffer(seed) {
	if (seed === undefined) return randomBytes(32);
	if (Buffer.isBuffer(seed)) return seed;
	if (typeof seed === "string" && seed.length > 0) return Buffer.from(seed, "utf8");
	throw new Error("[NENC compiler] seed must be a non-empty string or Buffer.");
}

function digest(seed, buildId, scope, value) {
	return createHmac("sha256", seed)
		.update(buildId)
		.update("\0")
		.update(scope)
		.update("\0")
		.update(value)
		.digest("base64url");
}

function uniqueId(used, seed, buildId, scope, value, prefix) {
	const hash = digest(seed, buildId, scope, value);
	for (let length = 8; length <= Math.min(hash.length, 28); length += 2) {
		const candidate = `${prefix}${hash.slice(0, length)}`;
		if (!used.has(candidate)) {
			used.add(candidate);
			return candidate;
		}
	}
	throw new Error(`[NENC compiler] Could not allocate a collision-free id for ${scope}.`);
}

function normalizeCommand(command) {
	if (!command || typeof command !== "object" || !NAME_PATTERN.test(String(command.name || ""))) {
		throw new Error("[NENC compiler] Every command requires a valid logical name.");
	}
	const input = command.input && typeof command.input === "object" ? command.input : {};
	for (const field of Object.keys(input)) {
		if (!NAME_PATTERN.test(field)) throw new Error(`[NENC compiler] Invalid input field on ${command.name}.`);
	}
	return {
		name: command.name,
		run: command.run || "auto",
		auth: command.auth || "anonymous",
		permissions: Array.isArray(command.permissions) ? [...command.permissions] : [],
		input,
	};
}

function compileNENCManifest(rawCommands, options = {}) {
	if (!Array.isArray(rawCommands)) throw new Error("[NENC compiler] commands must be an array.");
	const commands = rawCommands.map(normalizeCommand).sort((left, right) => left.name.localeCompare(right.name));
	const logicalNames = new Set();
	for (const command of commands) {
		if (logicalNames.has(command.name)) throw new Error(`[NENC compiler] Duplicate command: ${command.name}`);
		logicalNames.add(command.name);
	}

	const seed = seedBuffer(options.seed);
	const buildId = options.buildId || randomBytes(8).toString("hex");
	const headerIds = new Set();
	const headers = {
		selector: `x-${uniqueId(headerIds, seed, buildId, "header", "selector", "h")}`,
		nonce: `x-${uniqueId(headerIds, seed, buildId, "header", "nonce", "h")}`,
		timestamp: `x-${uniqueId(headerIds, seed, buildId, "header", "timestamp", "h")}`,
		signature: `x-${uniqueId(headerIds, seed, buildId, "header", "signature", "h")}`,
	};

	const clientCommands = Object.create(null);
	const serverCommands = Object.create(null);
	const commandIds = new Set();

	for (const command of commands) {
		const id = uniqueId(commandIds, seed, buildId, "command", command.name, "c");
		const argsByName = Object.create(null);
		const argsById = Object.create(null);
		const argIds = new Set();
		for (const name of Object.keys(command.input).sort()) {
			const wireId = uniqueId(argIds, seed, buildId, `arg:${command.name}`, name, "a");
			argsByName[name] = wireId;
			argsById[wireId] = name;
		}
		clientCommands[command.name] = { id, args: argsByName };
		serverCommands[id] = {
			id,
			name: command.name,
			run: command.run,
			auth: command.auth,
			permissions: command.permissions,
			argsByName,
			argsById,
		};
	}

	return {
		client: { version: 1, endpoint: ENDPOINT, buildId, headers, commands: clientCommands },
		server: { version: 1, endpoint: ENDPOINT, buildId, headers, commandsById: serverCommands },
	};
}

module.exports = {
	ENDPOINT,
	compileNENCManifest,
};
