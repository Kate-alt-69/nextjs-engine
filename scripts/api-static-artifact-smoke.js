"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
	compileAPIStaticArtifacts,
	writeAPIStaticManifest,
} = require("../src/engine/plugins/engineApiPlugin");
const { getRouteHash } = require("../src/engine/plugins/apiStaticCompiler");

function routeSource(value) {
	return [
		"createEndpoint([",
		"\t{",
		'\t\tname: "value"',
		`\t\trun.input(${value})`,
		"\t}",
		"])",
	].join("\n");
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-api-static-artifacts-"));
	const routeDirectory = path.join(root, "data", "endpoint");
	const routeFile = path.join(routeDirectory, "value.route");
	const outputDirectory = path.join(root, "public", "_static", "endpoint");
	const generatedFile = path.join(outputDirectory, `value-${getRouteHash("value")}.js`);
	const manifestFile = path.join(outputDirectory, "manifest.json");

	try {
		fs.mkdirSync(routeDirectory, { recursive: true });
		fs.writeFileSync(routeFile, routeSource(1), "utf8");

		compileAPIStaticArtifacts(
			root,
			"data/endpoint",
			"public/_static/endpoint",
			"manifest.json",
		);

		assert.equal(fs.existsSync(generatedFile), true);
		assert.equal(fs.existsSync(manifestFile), true);
		const firstProgram = fs.readFileSync(generatedFile, "utf8");
		const firstManifest = fs.readFileSync(manifestFile, "utf8");
		assert.deepEqual(readJson(manifestFile), {
			version: 1,
			endpoints: {
				value: {
					hash: getRouteHash("value"),
					operations: ["value"],
				},
			},
		});

		// A manifest-stage failure must not publish the already-compiled new JS.
		fs.writeFileSync(routeFile, routeSource(2), "utf8");
		const originalWriteFileSync = fs.writeFileSync;
		fs.writeFileSync = function guardedWrite(filePath, ...args) {
			if (String(filePath).includes("manifest.json.tmp-")) {
				throw new Error("intentional manifest stage failure");
			}
			return originalWriteFileSync.call(fs, filePath, ...args);
		};
		try {
			assert.throws(
				() => compileAPIStaticArtifacts(
					root,
					"data/endpoint",
					"public/_static/endpoint",
					"manifest.json",
				),
				/intentional manifest stage failure/,
			);
		} finally {
			fs.writeFileSync = originalWriteFileSync;
		}

		assert.equal(fs.readFileSync(generatedFile, "utf8"), firstProgram);
		assert.equal(fs.readFileSync(manifestFile, "utf8"), firstManifest);

		compileAPIStaticArtifacts(
			root,
			"data/endpoint",
			"public/_static/endpoint",
			"manifest.json",
		);
		assert.notEqual(fs.readFileSync(generatedFile, "utf8"), firstProgram);
		assert.deepEqual(readJson(manifestFile).endpoints.value.operations, ["value"]);

		assert.throws(
			() => writeAPIStaticManifest(
				root,
				"public/_static/endpoint",
				"../escaped-manifest.json",
				[],
			),
			/staticManifestFile must name a file inside staticOutputDir/,
		);
		assert.equal(
			fs.existsSync(path.join(root, "public", "_static", "escaped-manifest.json")),
			false,
		);

		// Empty source directories still publish a valid empty manifest atomically.
		fs.rmSync(routeFile, { force: true });
		compileAPIStaticArtifacts(
			root,
			"data/endpoint",
			"public/_static/endpoint",
			"manifest.json",
		);
		assert.deepEqual(readJson(manifestFile), { version: 1, endpoints: {} });
		assert.equal(fs.existsSync(generatedFile), false);

		console.log("APIStatic artifact transaction smoke test passed");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

main();
