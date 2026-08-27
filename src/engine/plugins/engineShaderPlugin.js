"use strict";

const fs = require("fs");
const path = require("path");
const { compileShaderDirectory } = require("./engineShaderCompiler");

const WATCH_STATE_KEY = Symbol.for("nextjs-engine.engine-shader-watch-state");

function normalizeShaderBasePath(value) {
	const normalized = String(value || "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/\/+$/g, "");
	if (!normalized || normalized === "/") return "";
	return normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
		? normalized
		: `/${normalized}`;
}

function resolveShaderBasePath(projectRoot, shaderOutputDir, explicitBasePath) {
	if (explicitBasePath !== undefined && explicitBasePath !== null) {
		return normalizeShaderBasePath(explicitBasePath);
	}
	const publicDirectory = path.resolve(projectRoot, "public");
	const outputDirectory = path.resolve(projectRoot, shaderOutputDir);
	const relative = path.relative(publicDirectory, outputDirectory);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(
			`[engine:shader] shaderOutputDir must be inside public/ so the browser can fetch compiled shaders. Received: ${shaderOutputDir}`,
		);
	}
	return normalizeShaderBasePath(relative.split(path.sep).join("/"));
}

function swapDirectory(stagingDirectory, outputDirectory) {
	const backupDirectory = `${outputDirectory}.backup-${process.pid}-${Date.now().toString(36)}`;
	const hadExistingOutput = fs.existsSync(outputDirectory);
	let backedUp = false;
	let installed = false;
	try {
		if (hadExistingOutput) {
			fs.renameSync(outputDirectory, backupDirectory);
			backedUp = true;
		}
		fs.renameSync(stagingDirectory, outputDirectory);
		installed = true;
	} catch (reason) {
		if (!installed) {
			if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true });
			if (backedUp && fs.existsSync(backupDirectory)) {
				fs.renameSync(backupDirectory, outputDirectory);
				backedUp = false;
			}
		}
		throw reason;
	} finally {
		if (fs.existsSync(stagingDirectory)) fs.rmSync(stagingDirectory, { recursive: true, force: true });
		if (installed && backedUp && fs.existsSync(backupDirectory)) fs.rmSync(backupDirectory, { recursive: true, force: true });
	}
}

function compileShaderArtifacts(projectRoot, shaderDir, shaderOutputDir) {
	const outputDirectory = path.resolve(projectRoot, shaderOutputDir);
	const stagingDirectory = `${outputDirectory}.staging-${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	fs.rmSync(stagingDirectory, { recursive: true, force: true });
	fs.mkdirSync(stagingDirectory, { recursive: true });
	try {
		const manifest = compileShaderDirectory({ projectRoot, shaderDir, outputDir: stagingDirectory });
		swapDirectory(stagingDirectory, outputDirectory);
		return manifest;
	} catch (reason) {
		fs.rmSync(stagingDirectory, { recursive: true, force: true });
		throw reason;
	}
}

function watchShaderSources({ projectRoot, shaderDir, compile }) {
	const watchOverride = process.env.NEXTJS_ENGINE_SHADER_WATCH;
	const isNextDev = process.env.NODE_ENV === "development" && process.argv.includes("dev");
	if (watchOverride === "0" || (watchOverride !== "1" && !isNextDev)) return;
	const absoluteShaderDir = path.resolve(projectRoot, shaderDir);
	const root = globalThis;
	if (!root[WATCH_STATE_KEY]) root[WATCH_STATE_KEY] = new Map();
	const state = root[WATCH_STATE_KEY];
	if (state.has(absoluteShaderDir)) return;
	fs.mkdirSync(absoluteShaderDir, { recursive: true });
	let timer = null;
	let compiling = false;
	let compileAgain = false;
	const queueCompile = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			if (compiling) {
				compileAgain = true;
				return;
			}
			compiling = true;
			try {
				compile();
			} catch (reason) {
				console.error("[engine:shader] Failed to recompile .shed files:", reason);
			} finally {
				compiling = false;
				if (compileAgain) {
					compileAgain = false;
					queueCompile();
				}
			}
		}, 40);
	};
	try {
		const watcher = fs.watch(absoluteShaderDir, { recursive: true }, (_eventType, fileName) => {
			const name = typeof fileName === "string" ? fileName : fileName?.toString() || "";
			if (!name || name.endsWith(".shed")) queueCompile();
		});
		watcher.on("error", (reason) => console.warn("[engine:shader] Shader watcher failed:", reason));
		watcher.unref?.();
		state.set(absoluteShaderDir, watcher);
	} catch (reason) {
		console.warn(`[engine:shader] Could not watch ${absoluteShaderDir}:`, reason);
	}
}

function withEngineShader(nextConfig = {}, pluginOptions = {}) {
	const {
		shaderDir = "data/shader/public",
		shaderOutputDir = "public/_static/shader",
		shaderBasePath,
	} = pluginOptions;
	const projectRoot = process.cwd();
	const resolvedBasePath = resolveShaderBasePath(projectRoot, shaderOutputDir, shaderBasePath);
	const compile = () => compileShaderArtifacts(projectRoot, shaderDir, shaderOutputDir);
	compile();
	watchShaderSources({ projectRoot, shaderDir, compile });
	return {
		...nextConfig,
		env: {
			...(nextConfig.env || {}),
			NEXT_PUBLIC_ENGINE_SHADER_BASE_PATH: resolvedBasePath,
		},
	};
}

module.exports = withEngineShader;
module.exports.withEngineShader = withEngineShader;
module.exports.compileShaderArtifacts = compileShaderArtifacts;
module.exports.resolveShaderBasePath = resolveShaderBasePath;
