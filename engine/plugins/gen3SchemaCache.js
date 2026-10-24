"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CACHE_FORMAT_VERSION = 1;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

function isWithin(root, target) {
	const relative = path.relative(root, target);
	return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

function sha256(value) {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function stableValue(value, ancestors = new WeakSet()) {
	if (value === undefined) return ["undefined"];
	if (typeof value === "function") {
		// Static schema extraction replaces functions with a no-op placeholder.
		// The source string makes this safe if that policy changes in a later version.
		return ["function", Function.prototype.toString.call(value)];
	}
	if (typeof value === "bigint") return ["bigint", value.toString()];
	if (typeof value === "number") {
		if (Object.is(value, -0)) return ["number", "-0"];
		if (!Number.isFinite(value)) return ["number", String(value)];
		return ["number", value];
	}
	if (value === null) return ["null"];
	if (typeof value !== "object") return [typeof value, value];
	if (ancestors.has(value)) throw new TypeError("NENC schema cache fingerprint cannot contain a circular value");

	ancestors.add(value);
	try {
		if (Array.isArray(value)) return ["array", value.map((entry) => stableValue(entry, ancestors))];
		return ["object", Object.keys(value).sort().map((key) => [key, stableValue(value[key], ancestors)])];
	} finally {
		ancestors.delete(value);
	}
}

function listCompilerSources(directory) {
	if (!fs.existsSync(directory)) return [];
	const files = [];
	function visit(current) {
		for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
			const target = path.join(current, entry.name);
			if (entry.isDirectory()) visit(target);
			else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
				files.push(target);
			}
		}
	}
	visit(directory);
	return files;
}

function schemaOutputCachePath(projectRoot, sourcePath, pageId) {
	const root = path.resolve(projectRoot);
	const identity = sha256(String(sourcePath || "") + "\0" + String(pageId || ""));
	return path.join(root, ".nextjs-engine", ".cache", "gen3", "schema-output", identity + ".json");
}

function createSchemaOutputCache(projectRoot) {
	const root = path.resolve(projectRoot);
	const cacheDirectory = path.resolve(root, ".nextjs-engine", ".cache", "gen3", "schema-output");
	if (!isWithin(root, cacheDirectory) || cacheDirectory === root) {
		throw new Error("NENC schema cache must remain inside .nextjs-engine/.cache.");
	}

	const packageRoot = path.resolve(__dirname, "../../..");
	const compilerRoot = path.join(packageRoot, "src", "engine", "compiler");
	const compilerFiles = [
		...listCompilerSources(compilerRoot),
		path.join(packageRoot, "src", "engine", "plugins", "gen3BuildCompiler.js"),
		path.join(packageRoot, "src", "engine", "plugins", "gen3SchemaWorker.js"),
		path.join(packageRoot, "src", "engine", "plugins", "gen3SchemaCache.js"),
	].filter((file) => fs.existsSync(file));
	const compilerInputs = compilerFiles.map((file) => {
		const relative = path.relative(packageRoot, file).split(path.sep).join("/");
		return relative + "\0" + fs.readFileSync(file);
	});
	let typescriptVersion = "unknown";
	try {
		typescriptVersion = require("typescript").version || typescriptVersion;
	} catch { /* The compiler source fingerprint still prevents stale reuse. */ }
	const compilerFingerprint = sha256([
		"nenc-schema-cache-format:" + CACHE_FORMAT_VERSION,
		"typescript:" + typescriptVersion,
		...compilerInputs,
	].join("\0"));

	function fingerprint(job) {
		return sha256(JSON.stringify(stableValue({
			cacheFormatVersion: CACHE_FORMAT_VERSION,
			compilerFingerprint,
			pageId: job.pageId,
			sourcePath: job.sourcePath,
			schema: job.schema,
			customComponentTypes: [...(job.customComponentTypes || [])].sort(),
		})));
	}

	function isSafeCacheDirectory() {
		try {
			const actualRoot = fs.realpathSync(root);
			const relativeCache = path.relative(root, cacheDirectory);
			let current = actualRoot;
			for (const segment of relativeCache.split(path.sep).filter(Boolean)) {
				current = path.join(current, segment);
				try {
					const stat = fs.lstatSync(current);
					// Do not follow a project-controlled symlink into a location outside
					// the cache directory expected by NENC.
					if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
				} catch (error) {
					if (!error || error.code !== "ENOENT") return false;
					try { fs.mkdirSync(current); }
					catch (createError) {
						if (!createError || createError.code !== "EEXIST") return false;
					}
					const stat = fs.lstatSync(current);
					if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
				}
			}
			const actualCacheDirectory = fs.realpathSync(current);
			return isWithin(actualRoot, actualCacheDirectory) && actualCacheDirectory !== actualRoot;
		} catch {
			return false;
		}
	}

	function read(job, expectedFingerprint) {
		const file = schemaOutputCachePath(root, job.sourcePath, job.pageId);
		if (!isSafeCacheDirectory() || !isWithin(cacheDirectory, file)) return null;
		try {
			const entry = JSON.parse(fs.readFileSync(file, "utf8"));
			if (
				entry.formatVersion !== CACHE_FORMAT_VERSION
				|| entry.fingerprint !== expectedFingerprint
				|| entry.compilerFingerprint !== compilerFingerprint
				|| entry.pageId !== job.pageId
				|| entry.sourcePath !== job.sourcePath
				|| !entry.page
				|| entry.page.id !== job.pageId
				|| entry.page.sourcePath !== job.sourcePath
				|| !Array.isArray(entry.page.compiledNodes)
			) return null;
			return { page: entry.page, metadata: entry.metadata || {} };
		} catch {
			return null;
		}
	}

	function write(job, expectedFingerprint, page, metadata = {}) {
		const file = schemaOutputCachePath(root, job.sourcePath, job.pageId);
		if (!isSafeCacheDirectory() || !isWithin(cacheDirectory, file)) return false;
		const entry = {
			formatVersion: CACHE_FORMAT_VERSION,
			fingerprint: expectedFingerprint,
			compilerFingerprint,
			pageId: job.pageId,
			sourcePath: job.sourcePath,
			writtenAt: Date.now(),
			metadata: {
				durationMs: Number.isFinite(metadata.durationMs) ? metadata.durationMs : null,
				nodeCount: Number.isFinite(metadata.nodeCount) ? metadata.nodeCount : null,
			},
			page,
		};
		const temporary = file + "." + process.pid + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
		try {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(temporary, JSON.stringify(entry), { encoding: "utf8", flag: "wx" });
			try {
				fs.renameSync(temporary, file);
			} catch (error) {
				// Windows can refuse to rename over an existing file. The entry is an
				// optimization, so remove only this job's old entry and retry atomically.
				if (!fs.existsSync(file) || !error || !["EEXIST", "EPERM", "ENOTEMPTY"].includes(error.code)) throw error;
				fs.rmSync(file, { force: true });
				fs.renameSync(temporary, file);
			}
			return true;
		} catch {
			try { fs.rmSync(temporary, { force: true }); } catch { /* Cache writes are best-effort. */ }
			return false;
		}
	}

	return Object.freeze({
		cacheDirectory,
		compilerFingerprint,
		fingerprint,
		read,
		write,
		cachePathFor(job) {
			return schemaOutputCachePath(root, job.sourcePath, job.pageId);
		},
	});
}

module.exports = {
	CACHE_FORMAT_VERSION,
	createSchemaOutputCache,
	schemaOutputCachePath,
};
