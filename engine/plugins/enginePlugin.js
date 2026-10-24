"use strict";

const fs = require("node:fs");
const path = require("node:path");

const withEngineAPI = require("./engineApiPlugin");
const withEngineDebug = require("./engineDebugPlugin");
const withEngineSEO = require("./engineSEOPlugin");
const withEngineShader = require("./engineShaderPlugin");
const withEngineNENC = require("./nencPlugin");
const {
	clearPluginArtifactCache,
	inspectPluginArtifactCache,
} = require("./artifactCache");

const ENGINE_IMAGE_QUALITIES = Object.freeze([65, 75, 78, 90]);

function installDevelopmentOutputBridge() {
	const args = process.argv.slice(2);
	if (!args.some((arg) => arg === "dev") && process.env.NEXT_PHASE !== "phase-development-server") return;
	require("./nencTerminalLogger").installNextBuildOutputBridge({ mode: "dev" });
}

function withEngineImageConfig(nextConfig = {}) {
	const configuredQualities = Array.isArray(nextConfig.images?.qualities)
		? nextConfig.images.qualities.filter((quality) => Number.isInteger(quality) && quality >= 1 && quality <= 100)
		: [];
	const qualities = [...new Set([...configuredQualities, ...ENGINE_IMAGE_QUALITIES])]
		.sort((left, right) => left - right);
	return {
		...nextConfig,
		images: {
			...(nextConfig.images || {}),
			qualities,
		},
	};
}

function resolveConfiguredAdapterPath(value) {
	if (typeof value !== "string" || !value.trim()) return undefined;
	const candidate = value.trim();
	if (path.isAbsolute(candidate)) return candidate;
	try {
		return require.resolve(candidate, { paths: [process.cwd()] });
	} catch {
		return path.resolve(process.cwd(), candidate);
	}
}

function withEngineBuildAdapter(config, originalConfig = {}) {
	const configuredAdapter = originalConfig.adapterPath
		|| originalConfig.experimental?.adapterPath
		|| process.env.NEXT_ADAPTER_PATH;
	const delegatePath = resolveConfiguredAdapterPath(configuredAdapter);
	const engineAdapterPath = require.resolve("./engineBuildAdapter");

	if (delegatePath && delegatePath !== engineAdapterPath) {
		process.env.NEXTJS_ENGINE_DELEGATE_ADAPTER = delegatePath;
	} else {
		delete process.env.NEXTJS_ENGINE_DELEGATE_ADAPTER;
	}

	return {
		...config,
		adapterPath: engineAdapterPath,
	};
}

function withEngineTurbopackCache(nextConfig = {}) {
	const experimental = nextConfig.experimental || {};
	return {
		...nextConfig,
		experimental: {
			...experimental,
			turbopackFileSystemCacheForDev: experimental.turbopackFileSystemCacheForDev ?? true,
			turbopackFileSystemCacheForBuild: experimental.turbopackFileSystemCacheForBuild ?? true,
		},
	};
}

const GEN3_API_CONFIG_FILE = path.join(".nextjs-engine", "config", ".apiconfig.json");
const LEGACY_API_CONFIG_FILE = ".engine-api-compiled.json";

function withGeneration3APIConfig(nextConfig = {}, apiOptions = {}) {
	const hasCustomOutput = typeof apiOptions.outputFile === "string" && apiOptions.outputFile.trim().length > 0;
	const outputFile = hasCustomOutput ? apiOptions.outputFile : GEN3_API_CONFIG_FILE;
	// Compile first, then remove the stale root artifact from older combined Gen 3 builds.
	const configured = withEngineAPI(nextConfig, { ...apiOptions, outputFile });
	if (!hasCustomOutput) {
		const legacyOutput = path.resolve(process.cwd(), LEGACY_API_CONFIG_FILE);
		const currentOutput = path.resolve(process.cwd(), outputFile);
		if (legacyOutput !== currentOutput && fs.existsSync(legacyOutput) && fs.statSync(legacyOutput).isFile()) {
			fs.rmSync(legacyOutput, { force: true });
		}
	}
	return configured;
}


function withEngine(nextConfig = {}, pluginOptions = {}) {
	installDevelopmentOutputBridge();
	const cacheConfig = withEngineTurbopackCache(nextConfig);
	const imageConfig = withEngineImageConfig(cacheConfig);
	const apiOptions = pluginOptions.api || pluginOptions;
	const shaderOptions = pluginOptions.shader || pluginOptions;
	const apiConfig = withGeneration3APIConfig(imageConfig, apiOptions);
	const nencConfig = pluginOptions.nenc ? withEngineNENC(apiConfig, pluginOptions.nenc) : apiConfig;
	const debugConfig = withEngineDebug(nencConfig, pluginOptions.debug || {});
	const seoConfig = withEngineSEO(debugConfig, pluginOptions.seo);
	const shaderConfig = withEngineShader(
		seoConfig,
		shaderOptions,
	);
	return withEngineBuildAdapter(shaderConfig, nextConfig);
}

module.exports = withEngine;
module.exports.withEngine = withEngine;
module.exports.withGeneration3APIConfig = withGeneration3APIConfig;
module.exports.GEN3_API_CONFIG_FILE = GEN3_API_CONFIG_FILE;
module.exports.LEGACY_API_CONFIG_FILE = LEGACY_API_CONFIG_FILE;
module.exports.withEngineAPI = withEngineAPI;
module.exports.withEngineDebug = withEngineDebug;
module.exports.withEngineSEO = withEngineSEO;
module.exports.withEngineShader = withEngineShader;
module.exports.withEngineNENC = withEngineNENC;
module.exports.withEngineImageConfig = withEngineImageConfig;
module.exports.withEngineTurbopackCache = withEngineTurbopackCache;
module.exports.withEngineBuildAdapter = withEngineBuildAdapter;
module.exports.clearPluginArtifactCache = clearPluginArtifactCache;
module.exports.inspectPluginArtifactCache = inspectPluginArtifactCache;
