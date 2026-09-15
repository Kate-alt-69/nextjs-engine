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

function withEngine(nextConfig = {}, pluginOptions = {}) {
	const apiOptions = pluginOptions.api || pluginOptions;
	const shaderOptions = pluginOptions.shader || pluginOptions;
	const apiConfig = withEngineAPI(nextConfig, apiOptions);
	const nencConfig = pluginOptions.nenc ? withEngineNENC(apiConfig, pluginOptions.nenc) : apiConfig;
	const debugConfig = withEngineDebug(nencConfig, pluginOptions.debug || {});
	return withEngineShader(
		debugConfig,
	const seoConfig = withEngineSEO(nencConfig, pluginOptions.seo);
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
module.exports.clearPluginArtifactCache = clearPluginArtifactCache;
module.exports.inspectPluginArtifactCache = inspectPluginArtifactCache;
