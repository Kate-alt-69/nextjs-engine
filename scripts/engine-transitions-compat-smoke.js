"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

function transpile(sourcePath, destinationPath) {
	const source = fs.readFileSync(sourcePath, "utf8");
	const result = ts.transpileModule(source, {
		fileName: sourcePath,
		reportDiagnostics: true,
		compilerOptions: {
			target: ts.ScriptTarget.ES2020,
			module: ts.ModuleKind.CommonJS,
			esModuleInterop: true,
		},
	});
	const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
	if (errors.length > 0) {
		throw new Error(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
	}
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function main() {
	const sourceRoot = path.join(process.cwd(), "src", "engine", "core", "enginetransitions");
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "engine-transitions-compat-"));
	try {
		const compatibilitySource = path.join(sourceRoot, "TransitionCompatibility.ts");
		const compatibilityOutput = path.join(tempRoot, "TransitionCompatibility.js");
		transpile(compatibilitySource, compatibilityOutput);
		const {
			isExactTransitionLocation,
			safeSharedTransitionName,
			scaleTransitionCssValue,
		} = require(compatibilityOutput);

		assert.equal(scaleTransitionCssValue("10deg", -1, "fallback"), "-10deg");
		assert.equal(scaleTransitionCssValue("36px", -0.35, "fallback"), "-12.6px");
		assert.equal(scaleTransitionCssValue("7px", 0.5, "fallback"), "3.5px");
		assert.equal(scaleTransitionCssValue("var(--custom)", -1, "fallback"), "fallback");

		const normalizedCollisionA = safeSharedTransitionName("Foo Bar");
		const normalizedCollisionB = safeSharedTransitionName("foo-bar");
		assert.notEqual(normalizedCollisionA, normalizedCollisionB, "sanitized shared ids must remain unique");
		assert.match(normalizedCollisionA, /^e-shared-[a-z0-9_-]+$/);

		const longPrefix = "shared-element-" + "x".repeat(90);
		assert.notEqual(
			safeSharedTransitionName(`${longPrefix}-a`),
			safeSharedTransitionName(`${longPrefix}-b`),
			"truncated shared ids must remain unique",
		);

		assert.equal(isExactTransitionLocation("/docs?a=1#x", "https://example.test/docs?a=1#x"), true);
		assert.equal(isExactTransitionLocation("https://example.test/docs", "https://example.test/docs"), true);
		assert.equal(isExactTransitionLocation("/docs?a=2", "https://example.test/docs?a=1"), false);

		const runtimeSource = fs.readFileSync(path.join(sourceRoot, "EngineTransitions.ts"), "utf8");
		assert.equal(
			/calc\([^)]*\*/.test(runtimeSource),
			false,
			"Transitions+ must not depend on CSS typed multiplication for browser compatibility",
		);
		assert.match(runtimeSource, /runLegacyTransition/, "older browsers should retain an animated fallback path");
		assert.match(runtimeSource, /isExactTransitionLocation/, "same-URL navigation should bypass transition waiting");
		assert.match(runtimeSource, /safeSharedTransitionName/, "shared transition ids should use collision-safe names");

		console.log("EngineTransitions compatibility smoke tests passed");
	} finally {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
