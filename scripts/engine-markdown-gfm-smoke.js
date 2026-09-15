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
	const rendererSource = fs.readFileSync(path.join(process.cwd(), "src", "engine", "components", "EngineMarkdownRenderer.tsx"), "utf8");
	const serverSource = fs.readFileSync(path.join(process.cwd(), "src", "engine", "compiler", "EngineServerRenderer.tsx"), "utf8");
	assert.doesNotMatch(componentSource, /import ReactMarkdown/, "the compatibility adapter must not own the AST implementation");
	assert.match(componentSource, /EngineMarkdownRenderer/, "direct component imports must retain the shared renderer");
	assert.match(rendererSource, /import ReactMarkdown/);
	assert.match(rendererSource, /remarkPlugins=\{\[remarkGfm\]\}/);
	assert.match(rendererSource, /skipHtml/, "raw HTML must remain disabled");
	assert.match(rendererSource, /overflowX: "auto"/, "wide code and tables must scroll inside their container");
	assert.match(rendererSource, /safeMarkdownUrl/, "links and images must pass through the Engine URL policy");
	assert.match(serverSource, /collector\.add\(ENGINE_MARKDOWN_CSS\)/, "server rendering must collect Markdown CSS without a client effect");
	assert.match(serverSource, /case "markdown"/, "the Gen 3 server renderer must own schema Markdown nodes");

	console.log("EngineMarkdown CommonMark/GFM smoke: ok");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
