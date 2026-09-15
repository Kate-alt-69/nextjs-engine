"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const previousNodeEnv = process.env.NODE_ENV;
const previousTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
	const source = fs.readFileSync(filename, "utf8");
	const output = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
		fileName: filename,
	}).outputText;
	module._compile(output, filename);
};
process.env.NODE_ENV = "development";

const {
	compileEngineArtifact,
	inspectEngineArtifactGraph,
	invalidateEngineArtifacts,
} = require("../src/engine/compiler/EngineArtifactGraph.ts");
const { compilePage } = require("../src/engine/compiler/EngineCompiler.ts");
const {
	registerEngineRuntimeProfile,
	unregisterEngineRuntimeProfile,
} = require("../src/engine/compiler/runtimeRegistry.ts");
const {
	clearPluginArtifactCache,
	compilePluginArtifact,
	fingerprintPluginInputs,
	inspectPluginArtifactCache,
} = require("../src/engine/plugins/artifactCache.js");

function restoreEnvironment() {
	invalidateEngineArtifacts();
	clearPluginArtifactCache();
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
	if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
	else delete require.extensions[".ts"];
}

try {
	invalidateEngineArtifacts();
	let schemaBuilds = 0;
	let styleBuilds = 0;
	let commandBuilds = 0;
	const schema = () => compileEngineArtifact({ kind: "schema", id: "/catalog", input: { title: "Catalog" } }, () => ++schemaBuilds);
	const style = () => compileEngineArtifact({
		kind: "style",
		id: "/catalog",
		input: { color: "red" },
		dependencies: [{ kind: "schema", id: "/catalog" }],
	}, () => ++styleBuilds);
	const command = () => compileEngineArtifact({ kind: "command", id: "privateSearch", input: { auth: "account" } }, () => ++commandBuilds);

	assert.equal(schema().cacheHit, false);
	assert.equal(style().cacheHit, false);
	assert.equal(command().cacheHit, false);
	assert.equal(schema().cacheHit, true);
	assert.equal(style().cacheHit, true);
	assert.equal(command().cacheHit, true);
	assert.equal(invalidateEngineArtifacts({ kind: "schema", id: "/catalog" }), 2, "schema invalidation must remove only schema dependants");
	assert.equal(command().cacheHit, true, "unrelated command graphs must survive schema HMR");
	assert.equal(schema().cacheHit, false);
	assert.equal(style().cacheHit, false);
	assert.deepEqual({ schemaBuilds, styleBuilds, commandBuilds }, { schemaBuilds: 2, styleBuilds: 2, commandBuilds: 1 });

	for (const kind of ["asset", "model", "device", "capability"]) {
		assert.equal(compileEngineArtifact({ kind, id: "coverage", input: { version: 1 } }, () => kind).cacheHit, false);
		assert.equal(compileEngineArtifact({ kind, id: "coverage", input: { version: 1 } }, () => "wrong").value, kind);
	}
	const graph = inspectEngineArtifactGraph();
	for (const kind of ["schema", "style", "asset", "command", "model", "device", "capability"]) {
		assert.ok(graph.some((entry) => entry.kind === kind), `${kind} graph metadata must be inspectable`);
	}

	const pageSchema = {
		meta: { title: "Incremental page" },
		root: { type: "stack", children: [{ type: "text", props: { content: "Stable" } }] },
	};
	const firstPlan = compilePage(pageSchema, { pageId: "/incremental" });
	const cachedPlan = compilePage(pageSchema, { pageId: "/incremental" });
	assert.equal(cachedPlan, firstPlan, "unchanged schemas must reuse the exact compiled plan");
	registerEngineRuntimeProfile("incremental-test-node", { runtime: "static", reason: "test profile" });
	const registryUpdatedPlan = compilePage(pageSchema, { pageId: "/incremental" });
	assert.notEqual(registryUpdatedPlan, firstPlan, "runtime-registry HMR must invalidate affected schema plans");
	unregisterEngineRuntimeProfile("incremental-test-node");

	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-hmr-"));
	try {
		const schemaFile = path.join(tempRoot, "page.ts");
		const commandFile = path.join(tempRoot, "commands.ts");
		const shaderFile = path.join(tempRoot, "effect.shed");
		fs.writeFileSync(schemaFile, "export const page = 1;\n");
		fs.writeFileSync(commandFile, "export const command = 1;\n");
		fs.writeFileSync(shaderFile, "shader <= stable => []\n");
		let commandCompiles = 0;
		let shaderCompiles = 0;
		const compileCommand = () => compilePluginArtifact(
			"command",
			"project",
			fingerprintPluginInputs([commandFile]),
			() => ++commandCompiles,
		);
		const compileShader = () => compilePluginArtifact(
			"shader",
			"project",
			fingerprintPluginInputs([shaderFile]),
			() => ++shaderCompiles,
		);
		compileCommand();
		compileShader();
		fs.writeFileSync(schemaFile, "export const page = 2;\n");
		assert.equal(compileCommand().cacheHit, true);
		assert.equal(compileShader().cacheHit, true);
		assert.deepEqual({ commandCompiles, shaderCompiles }, { commandCompiles: 1, shaderCompiles: 1 });
		fs.writeFileSync(commandFile, "export const command = 2;\n");
		assert.equal(compileCommand().cacheHit, false);
		assert.equal(compileShader().cacheHit, true, "NENC HMR must not rebuild unrelated Shader artifacts");
		const pluginGraph = inspectPluginArtifactCache();
		assert.equal(pluginGraph.find(({ kind }) => kind === "command").rebuilds, 2);
		assert.equal(pluginGraph.find(({ kind }) => kind === "shader").rebuilds, 1);
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}

	console.log("Generation 3 D.16-D.17 incremental/HMR smoke: ok");
} finally {
	restoreEnvironment();
}
