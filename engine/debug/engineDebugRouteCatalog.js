"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { discoverEngineDebugPages } = require("../plugins/engineDebugPlugin.js");

const DYNAMIC_SEGMENT = /\[[^[\]]+\]/;
const HIDDEN_PREFIXES = ["/_engine/debug", "/api/"];

function normalizePath(value) {
	if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.length > 2_000) return null;
	if (/[\u0000-\u001f\\]/.test(value)) return null;
	const pathname = value.split(/[?#]/, 1)[0] || "/";
	return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isDisplayablePath(value) {
	return !HIDDEN_PREFIXES.some(prefix => value === prefix || value.startsWith(prefix))
		&& !value.split("/").some(segment => segment.startsWith("_") && !segment.toLowerCase().startsWith("%5f"));
}

function readManifestPaths(rootDirectory, distDir = process.env.NEXTJS_ENGINE_DIST_DIR || ".next") {
	const outputRoot = path.resolve(rootDirectory, distDir);
	const files = [
		path.resolve(outputRoot, "prerender-manifest.json"),
		path.resolve(outputRoot, "server", "prerender-manifest.json"),
		path.resolve(outputRoot, "routes-manifest.json"),
	];
	const paths = new Set();
	for (const filename of files) {
		if (!fs.existsSync(filename)) continue;
		try {
			const manifest = JSON.parse(fs.readFileSync(filename, "utf8"));
			if (manifest.routes && typeof manifest.routes === "object") {
				for (const route of Object.keys(manifest.routes)) {
					const normalized = normalizePath(route);
					if (normalized && !DYNAMIC_SEGMENT.test(normalized) && isDisplayablePath(normalized)) paths.add(normalized);
				}
			}
			if (Array.isArray(manifest.staticRoutes)) {
				for (const entry of manifest.staticRoutes) {
					if (!entry || typeof entry.page !== "string") continue;
					const normalized = normalizePath(entry.page);
					if (normalized && !DYNAMIC_SEGMENT.test(normalized) && isDisplayablePath(normalized)) paths.add(normalized);
				}
			}
		} catch {
			// Next may rewrite manifests while compiling. Ignore partial JSON and retry on the next refresh.
		}
	}
	return [...paths];
}

function discoverEngineDebugRouteCatalog(rootDirectory, options = {}) {
	const patterns = discoverEngineDebugPages(rootDirectory, options.pages || []);
	const staticPaths = new Set([
		...patterns.filter(route => !DYNAMIC_SEGMENT.test(route)),
		...readManifestPaths(rootDirectory, options.distDir),
	]);
	return {
		patterns,
		staticPaths: [...staticPaths].filter(isDisplayablePath).sort((left, right) =>
			left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right)),
		dynamicPatterns: patterns.filter(route => DYNAMIC_SEGMENT.test(route)),
	};
}

module.exports = { discoverEngineDebugRouteCatalog, readManifestPaths };
