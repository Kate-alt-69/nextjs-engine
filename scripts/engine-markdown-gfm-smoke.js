"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const parserPath = path.join(process.cwd(), "src", "engine", "core", "markdownParser.ts");
const parserSource = fs.readFileSync(parserPath, "utf8");
const parserModule = { exports: {} };
new Function("module", "exports", "require", ts.transpileModule(parserSource, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022,
	},
	fileName: parserPath,
}).outputText)(parserModule, parserModule.exports, require);

const {
	normalizeEngineMarkdownSource,
	slugifyMarkdownHeading,
} = parserModule.exports;

async function main() {
	const compactNas = "For `<ROOT>`:\n\n```text <ROOT>/rbe/ ├── storage/ │ └── <object-sha256>/ └── chunks/<chunk-sha256>.chunk```";
	const normalizedNas = normalizeEngineMarkdownSource(compactNas);
	assert.equal(
		normalizedNas,
		"For `<ROOT>`:\n\n```text\n<ROOT>/rbe/ ├── storage/ │ └── <object-sha256>/ └── chunks/<chunk-sha256>.chunk\n```",
		"compact one-line code fences must retain their language and code payload",
	);

	const standardFence = "```ts\nconst stable = true;\n```";
	assert.equal(normalizeEngineMarkdownSource(standardFence), standardFence, "valid CommonMark fences must remain byte-stable");
	assert.equal(
		normalizeEngineMarkdownSource("~~~text tree/ └── leaf~~~"),
		"~~~text\ntree/ └── leaf\n~~~",
		"tilde fences must receive the same compact compatibility repair",
	);
	assert.equal(
		normalizeEngineMarkdownSource("Use ```text as prose, without a closing fence."),
		"Use ```text as prose, without a closing fence.",
		"ordinary prose containing backticks must not be rewritten",
	);
	assert.equal(slugifyMarkdownHeading("**NAS** layout `v3`"), "nas-layout-v3");

	const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
		import("react-markdown"),
		import("remark-gfm"),
	]);
	const gfm = `${normalizedNas}\n\n| Feature | Ready |\n| --- | --- |\n| Fences | yes |\n\n> durable quote\n\n- [x] parsed\n\n~~legacy~~`;
	const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, gfm));
	assert.match(html, /<code>&lt;ROOT&gt;<\/code>/, "inline code must render semantically");
	assert.match(html, /<pre><code class="language-text">[\s\S]*├── storage/, "fenced code must preserve the NAS tree");
	assert.match(html, /<table>/, "GFM tables must render natively");
	assert.match(html, /<blockquote>/, "blockquotes must render natively");
	assert.match(html, /type="checkbox"[^>]*checked/, "GFM task lists must render checked state");
	assert.match(html, /<del>legacy<\/del>/, "GFM strikethrough must render semantically");

	const componentSource = fs.readFileSync(path.join(process.cwd(), "src", "engine", "components", "EngineMarkdown.tsx"), "utf8");
	assert.match(componentSource, /import ReactMarkdown/);
	assert.match(componentSource, /remarkPlugins=\{\[remarkGfm\]\}/);
	assert.match(componentSource, /skipHtml/, "raw HTML must remain disabled");
	assert.match(componentSource, /overflowX: "auto"/, "wide code and tables must scroll inside their container");
	assert.match(componentSource, /safeMarkdownUrl/, "links and images must pass through the Engine URL policy");

	console.log("EngineMarkdown CommonMark/GFM smoke: ok");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
