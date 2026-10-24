"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const nencLogger = require("./nencTerminalLogger");

const BUILD_STATE_KEY = Symbol.for("nextjs-engine.gen3-build-adapter-state");
const DELEGATE_ADAPTER_ENV = "NEXTJS_ENGINE_DELEGATE_ADAPTER";

function getState() {
	return globalThis[BUILD_STATE_KEY];
}
function setState(value) {
	globalThis[BUILD_STATE_KEY] = value;
}
async function loadDelegateAdapter() {
	const adapterPath = process.env[DELEGATE_ADAPTER_ENV];
	if (!adapterPath) return null;
	const imported = await import(pathToFileURL(adapterPath).href);
	const adapter = imported.default ?? imported;
	if (!adapter || typeof adapter !== "object") {
		throw new Error("[NENC] The application's configured Next.js adapter did not export an adapter object.");
	}
	return adapter;
}
function removeState(state) {
	if (getState() === state) delete globalThis[BUILD_STATE_KEY];
	if (state.bannerOwner && state.compiler) state.compiler.releaseBanner(state.projectDir);
	try { fs.rmSync(state.tempDirectory, { recursive: true, force: true }); } catch { /* Build cleanup must not hide the original outcome. */ }
}
function startCompiler(projectDir) {
	const existing = getState();
	if (existing) return existing;

	const resolvedProjectDir = path.resolve(projectDir || process.cwd());
	const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-gen3-build-"));
	const manifestFile = path.join(tempDirectory, "compiler-manifest.json");
	const compilerScript = path.join(__dirname, "gen3BuildCompiler.js");
	const compiler = require("./gen3BuildCompiler");
	const bannerOwner = compiler.printBannerOnce(resolvedProjectDir);
	// The child worker owns the live status row; avoid competing terminal cursors here.

	let child;
	try {
		child = spawn(process.execPath, [
			compilerScript,
			"--scan",
			"--adapter-worker",
			"--project-root", resolvedProjectDir,
			"--output", manifestFile,
		], {
			cwd: resolvedProjectDir,
			env: process.env,
			stdio: "inherit",
			windowsHide: true,
		});
	} catch (error) {
		if (bannerOwner) compiler.releaseBanner(resolvedProjectDir);
		throw error;
	}

	const state = {
		projectDir: resolvedProjectDir,
		tempDirectory,
		manifestFile,
		child,
		compiler,
		bannerOwner,
		completion: null,
	};
	state.completion = new Promise((resolve, reject) => {
		let settled = false;
		child.once("error", (error) => {
			if (settled) return;
			settled = true;
			reject(new Error("[NENC] Could not start the Generation 3 compiler worker: " + error.message));
		});
		child.once("close", (code, signal) => {
			if (settled) return;
			settled = true;
			if (code === 0) resolve();
			else reject(new Error("[NENC] The Generation 3 compiler worker failed with "
				+ (signal ? "signal " + signal : "exit code " + code)));
		});
	});
	setState(state);

	const cleanup = () => {
		if (child.exitCode === null && !child.killed) child.kill();
		removeState(state);
	};
	state.cleanup = cleanup;
	process.once("exit", cleanup);
	return state;
}

const adapter = {
	name: "nenc",

	async modifyConfig(config, context = {}) {
		const delegate = await loadDelegateAdapter();
		let nextConfig = config;
		if (typeof delegate?.modifyConfig === "function") {
			nextConfig = await delegate.modifyConfig(config, context);
		}

		if (context.phase === "phase-production-build") {
			startCompiler(process.cwd());
		}
		return nextConfig;
	},

	async onBuildComplete(context = {}) {
		const state = getState();
		try {
			if (state) {
				await state.completion;
				if (!fs.existsSync(state.manifestFile)) {
					throw new Error("[NENC] Generation 3 compiler completed without writing its manifest.");
				}
				const compiler = require("./gen3BuildCompiler");
				nencLogger.setStatus("FINALIZING NEXT.JS BUILD OUTPUTS");
				compiler.emitArtifacts(context.projectDir || state.projectDir, state.manifestFile, context.distDir, context);
			}
		} finally {
			nencLogger.clearStatus();
			if (state) {
				process.removeListener("exit", state.cleanup);
				removeState(state);
			}
		}

		const delegate = await loadDelegateAdapter();
		if (typeof delegate?.onBuildComplete === "function") {
			await delegate.onBuildComplete(context);
		}
	},
};

module.exports = adapter;
module.exports.startCompiler = startCompiler;
module.exports.loadDelegateAdapter = loadDelegateAdapter;
