"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
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
	const errors = (result.diagnostics || []).filter(
		(diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
	);
	if (errors.length > 0) {
		throw new Error(errors.map((diagnostic) =>
			ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
		).join("\n"));
	}
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function rect(top, left, width, height) {
	return {
		top,
		left,
		width,
		height,
		right: left + width,
		bottom: top + height,
	};
}

function main() {
	const tempRoot = fs.mkdtempSync(path.join(process.cwd(), ".engine-overlay-smoke-"));
	try {
		const sourcePath = path.join(
			process.cwd(),
			"src", "engine", "core", "engineoverlay", "EngineOverlayRuntime.ts",
		);
		const outputPath = path.join(tempRoot, "EngineOverlayRuntime.js");
		transpile(sourcePath, outputPath);
		const runtime = require(outputPath);

		const centered = runtime.computePopoverPosition(
			rect(100, 100, 80, 40),
			{ width: 120, height: 60 },
			{
				placement: "bottom",
				align: "center",
				offset: 8,
				viewportWidth: 800,
				viewportHeight: 600,
			},
		);
		assert.equal(centered.placement, "bottom");
		assert.equal(centered.top, 148);
		assert.equal(centered.left, 80);

		const flipped = runtime.computePopoverPosition(
			rect(560, 300, 80, 32),
			{ width: 160, height: 100 },
			{
				placement: "bottom",
				viewportWidth: 800,
				viewportHeight: 600,
			},
		);
		assert.equal(flipped.placement, "top");
		assert.ok(flipped.top < 560);

		const clamped = runtime.computePopoverPosition(
			rect(10, 2, 20, 20),
			{ width: 220, height: 80 },
			{
				placement: "top",
				align: "start",
				viewportWidth: 320,
				viewportHeight: 240,
				viewportPadding: 12,
			},
		);
		assert.ok(clamped.left >= 12);
		assert.ok(clamped.top >= 12);
		assert.ok(clamped.left + 220 <= 308);

		const releaseA = runtime.registerOverlay("a");
		assert.equal(runtime.isTopOverlay("a"), true);
		const releaseB = runtime.registerOverlay("b");
		assert.equal(runtime.isTopOverlay("a"), false);
		assert.equal(runtime.isTopOverlay("b"), true);
		releaseB();
		assert.equal(runtime.isTopOverlay("a"), true);
		releaseA();
		assert.equal(runtime.isTopOverlay("a"), false);

		const releaseOld = runtime.registerOverlay("same");
		const releaseNew = runtime.registerOverlay("same");
		assert.equal(runtime.isTopOverlay("same"), true);
		releaseOld();
		assert.equal(runtime.isTopOverlay("same"), true);
		releaseNew();
		assert.equal(runtime.isTopOverlay("same"), false);

		console.log("EngineOverlay runtime smoke tests passed");
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
