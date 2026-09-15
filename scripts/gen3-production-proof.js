"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const previousTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
	const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
		fileName: filename,
	}).outputText;
	module._compile(output, filename);
};
const { assertEngineBuildBudgets, evaluateEngineBuildBudgets } = require("../src/engine/compiler/EngineBuildBudgets.ts");
if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

function parseClientReferenceManifest(filename) {
	const source = fs.readFileSync(filename, "utf8");
	const match = source.match(/= (\{.*\});\s*$/s);
	if (!match) throw new Error(`Could not parse ${filename}.`);
	return JSON.parse(match[1]);
}

function bytes(root, files) {
	return files.reduce((total, filename) => total + fs.statSync(path.join(root, filename)).size, 0);
}

function contributors(root, files) {
	return files.map((filename) => ({ name: filename, value: fs.statSync(path.join(root, filename)).size }))
		.sort((left, right) => right.value - left.value);
}

function routeManifestPath(distRoot, route) {
	const normalized = route.replace(/^\/+|\/+$/g, "");
	return path.join(distRoot, "server", "app", normalized, "page_client-reference-manifest.js");
}

function routeEntry(manifest, route) {
	const suffix = `/app/${route.replace(/^\/+|\/+$/g, "")}/page`;
	return Object.keys(manifest.entryJSFiles).find((key) => key.endsWith(suffix));
}

const distRoot = path.resolve(process.argv[2] || "dist");
const route = process.argv[3] || "/engine-compat-test";
const buildManifest = JSON.parse(fs.readFileSync(path.join(distRoot, "build-manifest.json"), "utf8"));
const routeManifest = parseClientReferenceManifest(routeManifestPath(distRoot, route));
const entry = routeEntry(routeManifest, route);
assert.ok(entry, `Missing route entry for ${route}.`);

const initialFiles = [...new Set([...buildManifest.polyfillFiles, ...buildManifest.rootMainFiles])];
const routeFiles = [...new Set(routeManifest.entryJSFiles[entry])];
const cssFiles = [...new Set(routeManifest.entryCSSFiles?.[entry] ?? [])];
const measurements = {
	initialJS: bytes(distRoot, initialFiles),
	routeJS: bytes(distRoot, routeFiles),
	criticalCSS: bytes(distRoot, cssFiles),
	requestCount: new Set([...routeFiles, ...cssFiles]).size,
	...(process.env.ENGINE_HYDRATED_ISLANDS
		? { hydratedIslands: Number(process.env.ENGINE_HYDRATED_ISLANDS) }
		: {}),
};

const runtimeMarkers = {
	NENC: ["NENCClient", "NENCTransport", "NENCCommand"],
	EngineModel: ["EngineModel]", "Unknown computed value"],
	EngineCanvas: ["EngineCanvas]", "adaptiveTargetFps"],
	EngineBrowser: ["EngineBrowser]", "browserInfo"],
	EngineCookies: ["EngineCookies]", "EngineCookieVault"],
};
const expectedAbsent = (process.env.ENGINE_EXPECT_ABSENT || "NENC,EngineModel,EngineCanvas,EngineCookies")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);
const routeSource = routeFiles.map((filename) => fs.readFileSync(path.join(distRoot, filename), "utf8")).join("\n");
for (const runtime of expectedAbsent) {
	const markers = runtimeMarkers[runtime];
	assert.ok(markers, `Unknown runtime ${runtime}.`);
	for (const marker of markers) assert.equal(routeSource.includes(marker), false, `${runtime} marker ${marker} leaked into ${route}.`);
}
for (const debugMarker of ["inspectEngineNENC", "inspectEngineArtifactGraph", "Artifact graph inspection is development-only"]) {
	assert.equal(routeSource.includes(debugMarker), false, `Development inspector marker ${debugMarker} leaked into a production route bundle.`);
}

const attribution = {
	"initial-js": contributors(distRoot, initialFiles),
	"route-js": contributors(distRoot, routeFiles),
	"critical-css": contributors(distRoot, cssFiles),
};
const limits = process.env.ENGINE_BUILD_BUDGETS ? JSON.parse(process.env.ENGINE_BUILD_BUDGETS) : {};
const budgetReport = evaluateEngineBuildBudgets(measurements, limits, attribution);
console.log(JSON.stringify({ route, measurements, budgetReport, attribution, absent: expectedAbsent }, null, 2));
assertEngineBuildBudgets(budgetReport);
