"use strict";

const path = require("node:path");

const { prepareEngineDebugRoute } = require("../src/engine/plugins/engineDebugPlugin.js");

const previousNodeEnv = process.env.NODE_ENV;

try {
	process.env.NODE_ENV = "production";
	prepareEngineDebugRoute({
		rootDir: path.resolve(__dirname, ".."),
		distDir: "dist",
	});
} finally {
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
}
