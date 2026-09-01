"use strict";

const fs = require("node:fs");
const ts = require("typescript");

let failures = 0;

function check(condition, message) {
	if (condition) {
		console.log(`PASS ${message}`);
		return;
	}
	failures += 1;
	console.error(`FAIL ${message}`);
}

const previousTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
	const source = fs.readFileSync(filename, "utf8");
	const output = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
			esModuleInterop: true,
		},
		fileName: filename,
	}).outputText;
	module._compile(output, filename);
};

const { compilePage } = require("../src/engine/compiler/EngineCompiler.ts");

if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

const plan = compilePage({
	meta: { title: "Gen 3 compiler smoke" },
	root: {
		type: "box",
		children: [
			{
				type: "dialog",
				name: "outer-dialog",
				children: [{
					type: "canvas",
					name: "nested-canvas",
					props: { mode: "webgl2" },
				}],
			},
			{
				type: "link",
				name: "animated-link",
				props: { href: "/next", transition: "fade" },
			},
			{
				type: "video",
				name: "sources",
				props: {
					src: [
						{ src: "/movie.webm", type: "video/webm" },
						{ src: "/movie.mp4", type: "video/mp4" },
					],
				},
			},
			{
				type: "image",
				name: "deferred-logo",
				props: { src: "/shared.png", lazy: true, alt: "Shared" },
			},
			{
				type: "image",
				name: "critical-logo",
				props: { src: "/shared.png", priority: true, alt: "Shared" },
			},
		],
	},
});

check(plan.summary.clientNodes === 4, "compiler counts all client nodes in the graph");
check(plan.summary.clientIslands === 4, "nested client nodes remain independent server-slot client islands");
check(plan.capabilities.includes("webgl2"), "Canvas mode contributes its concrete graphics capability");
check(plan.capabilities.includes("view-transitions"), "animated links contribute View Transition capability metadata");

const videoSources = plan.assets.filter((asset) => asset.kind === "video");
check(videoSources.some((asset) => asset.source === "/movie.webm"), "video source arrays record WebM assets");
check(videoSources.some((asset) => asset.source === "/movie.mp4"), "video source arrays record MP4 assets");

const sharedImage = plan.assets.find((asset) => asset.kind === "image" && asset.source === "/shared.png");
check(Boolean(sharedImage), "duplicate image sources are deduplicated in the page asset graph");
check(sharedImage?.priority === true, "deduplicated assets preserve their most urgent use");
check(sharedImage?.workClass === "critical", "deduplicated assets preserve critical work classification");
check(plan.summary.assetCount === plan.assets.length, "asset summary matches the final deduplicated graph");

if (failures > 0) {
	console.error(`\nGeneration 3 compiler runtime smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 compiler runtime smoke passed.");
