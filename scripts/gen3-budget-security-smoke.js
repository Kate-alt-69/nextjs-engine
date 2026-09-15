"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

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

try {
	const { assertEngineBuildBudgets, evaluateEngineBuildBudgets } = require("../src/engine/compiler/EngineBuildBudgets.ts");
	const { compilePage } = require("../src/engine/compiler/EngineCompiler.ts");

	const report = evaluateEngineBuildBudgets({
		initialJS: 80_000,
		routeJS: 140_000,
		criticalCSS: 12_000,
		requestCount: 9,
		hydratedIslands: 3,
	}, {
		initialJS: 100_000,
		routeJS: 120_000,
		criticalCSS: 15_000,
		requestCount: 10,
		hydratedIslands: 4,
	}, {
		"route-js": [
			{ name: "EngineCanvas", value: 90_000 },
			{ name: "route", value: 50_000 },
		],
	});
	assert.equal(report.status, "FAIL");
	assert.equal(report.results.length, 5);
	assert.equal(report.failures[0].metric, "route-js");
	assert.equal(report.failures[0].attribution[0].name, "EngineCanvas");
	assert.throws(() => assertEngineBuildBudgets(report), /route-js 140000\/120000 bytes/);

	const insecureSchema = {
		meta: { title: "Unsafe" },
		root: {
			type: "form",
			props: {
				upload: true,
				token: "do-not-ship-this",
				action: "javascript:alert(1)",
				cors: { origins: ["*"], credentials: true },
				cookie: { sameSite: "None", secure: false },
				command: { protected: true, requiresDeviceProof: false },
			},
		},
	};
	assert.throws(() => compilePage(insecureSchema, { pageId: "unsafe-enforced" }), /Security compilation failed/);
	const reported = compilePage(insecureSchema, { pageId: "unsafe-reported", security: "report" });
	assert.deepEqual(
		reported.diagnostics.filter(({ level }) => level === "error").map(({ code }) => code),
		["G3-S001", "G3-S002", "G3-S004", "G3-S005", "G3-S006"],
	);
	assert.ok(reported.diagnostics.some(({ code }) => code === "G3-S101"));
	assert.ok(reported.diagnostics.some(({ code }) => code === "G3-S102"));
	assert.doesNotMatch(JSON.stringify(reported.diagnostics), /do-not-ship-this/);

	const safe = compilePage({
		meta: { title: "Safe" },
		root: { type: "box", props: { token: "env:CATALOG_TOKEN", href: "/catalog" } },
	}, { pageId: "safe-security" });
	assert.equal(safe.diagnostics.some(({ level }) => level === "error"), false);

	console.log("Generation 3 D.18-D.19 budget/security smoke: ok");
} finally {
	if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
	else delete require.extensions[".ts"];
}
