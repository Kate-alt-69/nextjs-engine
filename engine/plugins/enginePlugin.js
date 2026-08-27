"use strict";

const withEngineAPI = require("./engineApiPlugin");
const withEngineShader = require("./engineShaderPlugin");

function withEngine(nextConfig = {}, pluginOptions = {}) {
	const apiOptions = pluginOptions.api || pluginOptions;
	const shaderOptions = pluginOptions.shader || pluginOptions;
	return withEngineShader(
		withEngineAPI(nextConfig, apiOptions),
		shaderOptions,
	);
}

module.exports = withEngine;
module.exports.withEngine = withEngine;
module.exports.withEngineAPI = withEngineAPI;
module.exports.withEngineShader = withEngineShader;
