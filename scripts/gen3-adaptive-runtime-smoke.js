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

const { compileAdaptiveSchema } = require("../src/engine/compiler/EngineAdaptiveCompiler.ts");

if (previousTsLoader) require.extensions[".ts"] = previousTsLoader;
else delete require.extensions[".ts"];

function findByName(node, name) {
	if (node.name === name) return node;
	if (!Array.isArray(node.children)) return null;
	for (const child of node.children) {
		const match = findByName(child, name);
		if (match) return match;
	}
	return null;
}

const baseSchema = {
	root: {
		type: "box",
		children: [
			{
				type: "stack",
				name: "site-header",
				props: { direction: "horizontal", px: "4rem", py: "2rem", gap: "2rem" },
				children: [
					{ type: "text", props: { content: "Brand" } },
					{ type: "text", props: { content: "Docs" } },
					{ type: "text", props: { content: "Download" } },
				],
			},
			{
				type: "section",
				name: "main-content",
				props: { px: "5rem", py: "8rem", gap: "3rem" },
				children: [{
					type: "image",
					name: "hero-image",
					props: { src: "/hero.png", alt: "Hero", quality: 95, width: 1920, height: 1080 },
				}],
			},
			{
				type: "grid",
				name: "site-footer",
				props: { role: "contentinfo", columns: 5, px: "4rem", py: "5rem", gap: "2rem" },
				children: [],
			},
			{
				type: "canvas",
				name: "visual",
				props: { dpr: 2, maxDpr: 3, adaptive: false },
			},
			{
				type: "section",
				name: "responsive-content",
				props: { px: { xs: "1rem", md: "3rem" }, py: { xs: "2rem", md: "6rem" } },
			},
		],
	},
};

const phone = compileAdaptiveSchema(baseSchema, "phone", "auto");
const phoneHeader = findByName(phone.schema.root, "site-header");
const phoneContent = findByName(phone.schema.root, "main-content");
const phoneFooter = findByName(phone.schema.root, "site-footer");
const phoneImage = findByName(phone.schema.root, "hero-image");
const phoneCanvas = findByName(phone.schema.root, "visual");
const responsiveContent = findByName(phone.schema.root, "responsive-content");

check(phoneHeader.props.px === "min(4rem, 1rem)", "phone header horizontal spacing is compacted semantically");
check(phoneHeader.props.py === "min(2rem, 0.75rem)", "phone header vertical spacing is compacted semantically");
check(phoneHeader.props.direction === "horizontal", "phone header is not blindly turned into a vertical stack");
check(phoneHeader.props.wrap === true, "crowded phone header can wrap instead of shrinking content");
check(phoneContent.props.py === "min(8rem, 3.5rem)", "phone content spacing is compacted without stripping content");
check(phoneFooter.props.autoFit === true, "wide footer grid becomes container-driven auto-fit");
check(phoneFooter.props.py === "min(5rem, 2.5rem)", "footer receives its own compact spacing policy");
check(phoneImage.props.quality === 95 && phoneImage.props.width === 1920, "adaptive compiler preserves image resolution and quality");
check(phoneCanvas.props.dpr === 2 && phoneCanvas.props.maxDpr === 3, "adaptive compiler preserves Canvas resolution settings");
check(responsiveContent.props.px.xs === "1rem" && responsiveContent.props.px.md === "3rem", "developer responsive spacing remains authoritative");
check(phone.changes.some((change) => change.name === "site-header" && change.reason.includes("header")), "compiler explains semantic header adaptation");

const tablet = compileAdaptiveSchema(baseSchema, "tablet", "auto");
const tabletContent = findByName(tablet.schema.root, "main-content");
check(tabletContent.props.py === "min(8rem, 4.5rem)", "tablet uses a distinct, less aggressive spacing policy");

const structuralOnly = compileAdaptiveSchema(baseSchema, "phone", { mode: "auto", compact: false });
check(findByName(structuralOnly.schema.root, "main-content").props.py === "8rem", "compact:false preserves authored spacing");
check(findByName(structuralOnly.schema.root, "site-footer").props.autoFit === true, "compact:false still keeps structural width adaptation");

const patched = compileAdaptiveSchema(baseSchema, "phone", {
	mode: "auto",
	patches: [{
		"#main-content": {
			props: { py: "9rem" },
		},
	}],
});
check(findByName(patched.schema.root, "main-content").props.py === "9rem", "developer patches run after automatic adaptation and win");

if (failures > 0) {
	console.error(`\nGeneration 3 adaptive runtime smoke failed with ${failures} issue(s).`);
	process.exit(1);
}

console.log("\nGeneration 3 adaptive runtime smoke passed.");
