"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PLUGIN_CACHE_KEY = Symbol.for("nextjs-engine.plugin-artifact-cache");

function cacheState() {
	const root = globalThis;
	if (!root[PLUGIN_CACHE_KEY]) root[PLUGIN_CACHE_KEY] = new Map();
	return root[PLUGIN_CACHE_KEY];
}

function listFiles(target) {
	if (!fs.existsSync(target)) return [];
	if (fs.statSync(target).isFile()) return [target];
	return fs.readdirSync(target, { withFileTypes: true })
		.flatMap((entry) => listFiles(path.join(target, entry.name)))
		.sort();
}

function fingerprintPluginInputs(targets, configuration = {}) {
	const hash = crypto.createHash("sha256");
	hash.update(JSON.stringify(configuration, Object.keys(configuration).sort()));
	for (const file of [...new Set(targets.flatMap((target) => listFiles(path.resolve(target))))].sort()) {
		hash.update(file);
		hash.update(fs.readFileSync(file));
	}
	return hash.digest("hex");
}

function compilePluginArtifact(kind, id, fingerprint, compile) {
	const key = `${kind}:${id}`;
	const state = cacheState();
	const existing = state.get(key);
	if (existing?.fingerprint === fingerprint) {
		existing.hits += 1;
		return { value: existing.value, cacheHit: true, fingerprint };
	}
	const value = compile();
	state.set(key, {
		kind,
		id,
		fingerprint,
		value,
		hits: existing?.hits || 0,
		rebuilds: (existing?.rebuilds || 0) + 1,
	});
	return { value, cacheHit: false, fingerprint };
}

function inspectPluginArtifactCache() {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[Next.js Engine] Plugin artifact inspection is development-only.");
	}
	return Object.freeze([...cacheState().values()]
		.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
		.map(({ kind, id, fingerprint, hits, rebuilds }) => Object.freeze({ kind, id, fingerprint, hits, rebuilds })));
}

function clearPluginArtifactCache() {
	cacheState().clear();
}

module.exports = {
	clearPluginArtifactCache,
	compilePluginArtifact,
	fingerprintPluginInputs,
	inspectPluginArtifactCache,
};
