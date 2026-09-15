"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const previousNodeEnv = process.env.NODE_ENV;
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
process.env.NODE_ENV = "development";

const { compilePage } = require("../src/engine/compiler/EngineCompiler.ts");
const { compileAdaptiveSchema } = require("../src/engine/compiler/EngineAdaptiveCompiler.ts");
const { resolveEngineFallbackPlan } = require("../src/engine/compiler/EngineFallbackCompiler.ts");
const { EngineModel } = require("../src/engine/core/EngineModel.ts");
const {
	explainEngineDecisions,
	inspectEngineCapabilities,
	inspectEngineCookies,
	inspectEngineNENC,
} = require("../src/engine/debug/EngineInspectors.ts");

function restoreEnvironment() {
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
	if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
	else delete require.extensions[".ts"];
}

try {
	const nenc = inspectEngineNENC({
		version: 1,
		endpoint: "/_static/command",
		buildId: "debug-inspection",
		headers: { selector: "x-a", nonce: "x-b", timestamp: "x-c", signature: "x-d" },
		commandsById: {
			opaque123: {
				id: "opaque123",
				name: "privateSearch",
				run: "server",
				auth: "account",
				permissions: ["catalog:read"],
				argsByName: { query: "arg456" },
				argsById: { arg456: "query" },
			},
		},
	});
	assert.deepEqual(nenc[0], {
		logicalName: "privateSearch",
		runtime: "server",
		server: true,
		compiledCommand: "opaque123",
		authentication: "account",
		permissions: ["catalog:read"],
		usesEngineAPIResolver: true,
		privateEndpointExposed: false,
		publicEndpoint: "/_static/command",
	});

	const cookieInspection = inspectEngineCookies([{
		alias: "catalogSession",
		storageId: "must-never-appear",
		owner: "catalog",
		creator: "login",
		purpose: "Private catalog access",
		createdAt: 100,
		expiresAt: 500,
		binding: "device-key",
		commands: ["privateSearch"],
		device: {
			version: 1,
			keyId: "device-public-id",
			algorithm: "ECDSA-P256-SHA256",
			publicKey: { kty: "EC", x: "must-never-appear" },
		},
	}], 200);
	assert.equal(cookieInspection[0].owner, "catalog");
	assert.equal(cookieInspection[0].deviceBinding, "device-key");
	assert.deepEqual(cookieInspection[0].authorizedCommands, ["privateSearch"]);
	assert.doesNotMatch(JSON.stringify(cookieInspection), /storageId|ciphertext|must-never-appear|publicKey/);

	const model = EngineModel.create({ count: 1, filter: "all" }, { name: "catalogFilters" });
	model.computed("double", (state) => state.count * 2).action("increment", (current) => current.update("count", (value) => value + 1));
	const unregister = model.registerDebugConsumer("ProductGrid", "filter");
	model.debugSet("filter", "available");
	const modelInspection = model.inspect();
	assert.equal(modelInspection.name, "catalogFilters");
	assert.equal(modelInspection.state.filter, "available");
	assert.deepEqual(modelInspection.computed, ["double"]);
	assert.deepEqual(modelInspection.actions, ["increment"]);
	assert.deepEqual(modelInspection.consumers, [{ id: "ProductGrid", keys: ["filter"] }]);
	unregister();

	const schema = {
		meta: { title: "Debug decisions" },
		root: {
			type: "grid",
			name: "catalog-grid",
			props: { columns: 5 },
			children: [{
				type: "link",
				name: "animated-link",
				props: { href: "/next", transition: "fade", lazy: true },
			}],
		},
	};
	const plan = compilePage(schema, { pageId: "/debug-decisions" });
	const support = new Set(["dom", "web-animations", "css-grid"]);
	const capabilities = inspectEngineCapabilities(plan, (feature) => support.has(feature));
	assert.equal(capabilities.find(({ feature }) => feature === "view-transitions").usage, "USED");
	assert.equal(capabilities.find(({ feature }) => feature === "view-transitions").fallback, "web-animations");
	assert.equal(capabilities.find(({ feature }) => feature === "speech").usage, "UNUSED");

	const adaptive = compileAdaptiveSchema(schema, "phone", "auto");
	const fallbacks = resolveEngineFallbackPlan(plan.fallbackPlan, (feature) => support.has(feature));
	const explanations = explainEngineDecisions(plan, {
		adaptiveChanges: adaptive.changes,
		resolvedFallbacks: fallbacks,
	});
	assert.ok(explanations.some(({ kind, decision, why }) => kind === "runtime" && decision === "client" && why.length > 10));
	assert.ok(explanations.some(({ kind, decision, why }) => kind === "scheduling" && decision === "deferred" && /lazy/i.test(why)));
	assert.ok(explanations.some(({ kind, why }) => kind === "responsive" && /container-driven/i.test(why)));
	assert.ok(explanations.some(({ kind, decision, why }) => kind === "fallback" && /web-animations/.test(decision) && /first supported/i.test(why)));

	process.env.NODE_ENV = "production";
	assert.throws(() => inspectEngineNENC({}), /development-only/);
	assert.throws(() => model.inspect(), /development-only/);
	assert.throws(() => model.debugSet("count", 4), /development-only/);

	console.log("Generation 3 D.11-D.15 debug inspector smoke: ok");
} finally {
	restoreEnvironment();
}
