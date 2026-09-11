const withEngine = require("nextjs-engine/plugin");

module.exports = withEngine({}, {
	nenc: {
		commandFiles: ["commands.ts"],
		handlerModule: "nenc.server.ts",
		seed: process.env.ENGINE_NENC_SEED,
		buildId: process.env.VERCEL_GIT_COMMIT_SHA,
	},
});
