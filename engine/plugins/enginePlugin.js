"use strict";

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

function withEngine(nextConfig = {}, pluginOptions = {}) {
	const imageConfig = withEngineImageConfig(nextConfig);
	const apiOptions = pluginOptions.api || pluginOptions;
	const shaderOptions = pluginOptions.shader || pluginOptions;
	const apiConfig = withEngineAPI(imageConfig, apiOptions);
	const nencConfig = pluginOptions.nenc ? withEngineNENC(apiConfig, pluginOptions.nenc) : apiConfig;
	const debugConfig = withEngineDebug(nencConfig, pluginOptions.debug || {});
	const seoConfig = withEngineSEO(debugConfig, pluginOptions.seo);
	return withEngineShader(
		seoConfig,
		shaderOptions,
	);
}

module.exports = withEngine;
module.exports.withEngine = withEngine;
module.exports.withEngineAPI = withEngineAPI;
module.exports.withEngineDebug = withEngineDebug;
module.exports.withEngineSEO = withEngineSEO;
module.exports.withEngineShader = withEngineShader;
module.exports.withEngineNENC = withEngineNENC;
module.exports.withEngineImageConfig = withEngineImageConfig;
module.exports.clearPluginArtifactCache = clearPluginArtifactCache;
module.exports.inspectPluginArtifactCache = inspectPluginArtifactCache;
