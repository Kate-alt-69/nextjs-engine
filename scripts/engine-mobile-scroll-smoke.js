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
		throw new Error(errors.map(
			(diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
		).join("\n"));
	}
	fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
	fs.writeFileSync(destinationPath, result.outputText, "utf8");
}

function main() {
	const root = fs.mkdtempSync(path.join(process.cwd(), ".engine-mobile-scroll-smoke-"));
	try {
		const engineRoot = path.join(process.cwd(), "src", "engine");
		transpile(
			path.join(engineRoot, "core", "lazyDetect.ts"),
			path.join(root, "core", "lazyDetect.js"),
		);
		const { decideLazy } = require(path.join(root, "core", "lazyDetect.js"));

		for (const type of ["section", "hero", "grid", "stack", "card", "markdown"]) {
			const decision = decideLazy({ type, props: {}, children: [] }, 8);
			assert.equal(decision.lazy, false, `${type} must not auto-unmount from document flow`);
			assert.equal(decision.contentVisibility, false, `${type} must keep stable browser layout by default`);
		}
		assert.equal(decideLazy({ type: "card", props: { lazy: true } }, 8).lazy, true);
		assert.equal(decideLazy({ type: "canvas", props: {} }, 1).lazy, true);

		const legacyScroll = fs.readFileSync(
			path.join(engineRoot, "components", "EngineScroll.tsx"),
			"utf8",
		);
		assert.match(legacyScroll, /touchstart/);
		assert.match(legacyScroll, /touchmove/);
		assert.match(legacyScroll, /cancelPendingAnchor/);
		assert.match(legacyScroll, /document\.documentElement/);
		assert.doesNotMatch(legacyScroll, /height:\s*"100vh"/);
		assert.doesNotMatch(legacyScroll, /overflowY:\s*"scroll"/);

		const browserEvents = fs.readFileSync(
			path.join(engineRoot, "core", "enginescroll", "browser", "BrowserEvents.ts"),
			"utf8",
		);
		assert.match(browserEvents, /TOUCH_SCROLL_IDLE_MS/);
		assert.match(browserEvents, /userScrollIdleUntil/);
		assert.match(browserEvents, /Number\.POSITIVE_INFINITY/);

		console.log("Engine mobile scroll stability smoke tests passed");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

try {
	main();
} catch (reason) {
	console.error(reason);
	process.exit(1);
}
