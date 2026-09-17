"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const generatedRoute = path.join(root, "app", "%5Fengine", "debug", "page.tsx");
const output = path.join(root, "dist");

assert.equal(fs.existsSync(generatedRoute), false, "the dev-only debug route must be removed before production compilation");
assert.equal(fs.existsSync(output), true, "run this proof after next build");

const manifestPaths = [
	path.join(output, "server", "app-paths-manifest.json"),
	path.join(output, "server", "middleware-manifest.json"),
];
for (const manifestPath of manifestPaths) {
	if (!fs.existsSync(manifestPath)) continue;
	const manifest = fs.readFileSync(manifestPath, "utf8");
	assert.doesNotMatch(manifest, /_engine\/debug|%5Fengine\/debug/i, `${path.basename(manifestPath)} must not contain EngineDebug`);
}

const compiledRoots = [path.join(output, "server", "app"), path.join(output, "static", "chunks")];
for (const compiledRoot of compiledRoots) {
	if (!fs.existsSync(compiledRoot)) continue;
	const pending = [compiledRoot];
	while (pending.length > 0) {
		const current = pending.pop();
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const filename = path.join(current, entry.name);
			if (entry.isDirectory()) pending.push(filename);
			else if (/\.(?:js|json)$/.test(entry.name)) {
				assert.doesNotMatch(
					fs.readFileSync(filename, "utf8"),
					/Next\.js Engine Debug|D\.5–D\.10|data-next-engine-debug-active/,
					`${filename} compiled the dev-only debugger`,
				);
			}
		}
	}
}

console.log("Generation 3 EngineDebug production absence: ok");
