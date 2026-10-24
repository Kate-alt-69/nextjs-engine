"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const {
	canonicalJson,
	compileEngineThemeArtifacts,
	ETR_FORMAT,
} = require("../src/engine/plugins/gen3ThemeCompiler");

function testPublicThemeApi() {
	const previousTsExtension = Module._extensions[".ts"];
	const previousTsxExtension = Module._extensions[".tsx"];
	const transpileThemeModule = (loadedModule, filePath) => {
		const sourceText = fs.readFileSync(filePath, "utf8");
		const transpiled = ts.transpileModule(sourceText, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2020,
				jsx: ts.JsxEmit.ReactJSX,
			},
			fileName: filePath,
			reportDiagnostics: true,
		});
		const errors = (transpiled.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
		assert.deepEqual(errors, [], filePath + " must transpile without syntax diagnostics");
		loadedModule._compile(transpiled.outputText, filePath);
	};
	Module._extensions[".ts"] = transpileThemeModule;
	Module._extensions[".tsx"] = transpileThemeModule;

	try {
		const themePath = path.resolve(__dirname, "../src/engine/theme/createTheme.ts");
		const resolverPath = path.resolve(__dirname, "../src/engine/theme/resolveTheme.ts");
		const { createTheme, parseEngineThemeId } = require(themePath);
		const { resolveEngineThemeSchema } = require(resolverPath);
		const {
			highlightEngineCode,
			listEngineHighlighterProviders,
			listEngineHighlighterLanguages,
			listEngineHighlighterThemes,
			registerEngineHighlighterProvider,
			unregisterEngineHighlighterProvider,
			normalizeEngineThemeColor,
			getEngineHighlighterColor,
		} = require(path.resolve(__dirname, "../src/engine/theme/highlighting.ts"));
		const {
			dispatchEngineThemeDataEvent,
			listEngineThemeDataHandlers,
			registerEngineThemeDataHandler,
			unregisterEngineThemeDataHandler,
		} = require(path.resolve(__dirname, "../src/engine/theme/dataApi.ts"));
		const React = require("react");
		const {
			renderEngineThemeTemplate,
			listEngineThemeTemplateAdapters,
			registerEngineThemeTemplateAdapter,
			unregisterEngineThemeTemplateAdapter,
		} = require(path.resolve(__dirname, "../src/engine/theme/templates.tsx"));

		const definition = createTheme({
			id: "safe-theme",
			tokens: { colors: { text: "#fff" } },
			markdown: { variants: { dark: { defaults: { codeBackground: "#111" } } } },
		});
		assert.equal(definition.scope, "local", "scope defaults to local");
		assert.equal(Object.isFrozen(definition), true, "returned theme group is frozen");
		assert.equal(Object.isFrozen(definition.tokens.colors), true, "nested theme values are frozen");
		assert.deepEqual(parseEngineThemeId("mycoolthemes.markdown.1.2.560"), {
			groupId: "mycoolthemes", componentId: "markdown", subthemes: ["1", "2", "560"],
		});
		assert.throws(() => parseEngineThemeId("mycoolthemes.markdown.a.b.c.d"), /at most three subtheme segments/);
		assert.throws(() => createTheme({ id: "my.theme" }), /group ID without dots/);
		assert.throws(() => createTheme({ id: "function-theme", markdown: { build: () => true } }), /JSON data/);

		let getterCalled = false;
		const accessorTheme = {};
		Object.defineProperty(accessorTheme, "id", { enumerable: true, get() { getterCalled = true; return "unsafe"; } });
		assert.throws(() => createTheme(accessorTheme), /accessors/);
		assert.equal(getterCalled, false, "accessor validation must not execute the getter");

		const highlighted = highlightEngineCode(
			"const value: number = 42; // safe",
			"typescript",
		);
		assert.ok(highlighted, "the lightweight provider recognizes TypeScript");
		assert.equal(highlighted.map((token) => token.text).join(""), "const value: number = 42; // safe",
			"highlighting preserves every source character");
		assert.ok(highlighted.some((token) => token.kind === "keyword" && token.text === "const"));
		assert.ok(highlighted.some((token) => token.kind === "type" && token.text === "number"));
		assert.ok(highlighted.some((token) => token.kind === "number" && token.text === "42"));
		assert.ok(highlighted.some((token) => token.kind === "comment" && token.text.includes("safe")));
		assert.ok(highlightEngineCode("console.log(1)", "nodejs"), "Node.js aliases to the JavaScript grammar");
		assert.equal(highlightEngineCode("console.log(1)", "ansi"), null, "ANSI is never passed through syntax highlighting");
		assert.equal(highlightEngineCode("x = 1", "not-a-real-language"), null, "unknown languages fall back to plain text");
		assert.ok(listEngineHighlighterLanguages().includes("typescript"));
		assert.ok(listEngineHighlighterProviders().some((provider) => provider.id === "engine-lite"));
		assert.equal(normalizeEngineThemeColor("#1a2b3c"), "#1a2b3c");
		assert.equal(normalizeEngineThemeColor("rgb(30, 40, 50)"), "rgb(30, 40, 50)");
		assert.equal(normalizeEngineThemeColor("color(srgb 0.2 0.4 0.8 / 0.5)"), "color(srgb 0.2 0.4 0.8 / 0.5)");
		assert.equal(normalizeEngineThemeColor("rgb(999, 10, 20)"), undefined, "RGB channels must be in range");
		assert.equal(normalizeEngineThemeColor("color(srgb 2 0 0)"), undefined, "sRGB channels must be in range");
		assert.equal(normalizeEngineThemeColor("rgba(10, 20, 30, 200%)"), undefined, "alpha must be in range");
		assert.equal(normalizeEngineThemeColor("url(javascript:alert(1))"), undefined);
		assert.deepEqual(listEngineHighlighterThemes().map((theme) => theme.id), ["vscode-dark", "vscode-light"]);
		assert.equal(getEngineHighlighterColor("keyword", {
			theme: "vscode-dark",
			palette: { foreground: "#fafafa" },
		}), "#fafafa", "custom palettes replace provider colors for all unspecified categories");
		const customProvider = {
			id: "smoke-provider",
			name: "Smoke Provider",
			languages: ["json"],
			highlight: (code) => [{ kind: "plain", text: code }],
		};
		registerEngineHighlighterProvider(customProvider);
		assert.ok(listEngineHighlighterProviders().some((provider) => provider.id === "smoke-provider"));
		assert.deepEqual(highlightEngineCode('{"ok":true}', "json", { provider: "smoke-provider" }), [
			{ kind: "plain", text: '{"ok":true}' },
		]);
		assert.equal(unregisterEngineHighlighterProvider("smoke-provider"), true);

		let allocatedEvent;
		const existingContext = { label: "Name" };
		const incomingContext = { icon: "sort" };
		const dataHandler = (event) => {
			allocatedEvent = event;
			return { operation: "append", value: event.context.incoming };
		};
		assert.throws(() => registerEngineThemeDataHandler("constructor", dataHandler), /cannot be reserved names/);
		registerEngineThemeDataHandler("smoke-theme.table-join", dataHandler);
		assert.ok(listEngineThemeDataHandlers().includes("smoke-theme.table-join"));
		assert.deepEqual(dispatchEngineThemeDataEvent("join:left", {
			handlerId: "smoke-theme.table-join",
		}, {
			themeId: "theme-runtime-smoke.markdown.dark",
			componentId: "markdown",
			slotId: "table.header",
			direction: "left",
			existing: existingContext,
			incoming: incomingContext,
		}), { operation: "append", value: { icon: "sort" } });
		assert.equal(allocatedEvent.type, "join:left");
		assert.equal(Object.isFrozen(allocatedEvent), true);
		assert.equal(Object.isFrozen(allocatedEvent.context), true);
		assert.equal(Object.isFrozen(allocatedEvent.context.existing), true);
		existingContext.label = "mutated after dispatch";
		incomingContext.icon = "changed";
		assert.equal(allocatedEvent.context.existing.label, "Name", "handler context is isolated from later caller mutation");
		assert.equal(allocatedEvent.context.incoming.icon, "sort", "nested event payloads are cloned and frozen");
		assert.throws(() => dispatchEngineThemeDataEvent("join:left", "missing-handler", {
			themeId: "theme-runtime-smoke.markdown.dark",
			componentId: "markdown",
			slotId: "table.header",
		}), /is not registered/);
		assert.throws(() => dispatchEngineThemeDataEvent("join:left", "smoke-theme.table-join", {
			themeId: "theme-runtime-smoke.markdown.dark",
			componentId: "markdown",
			slotId: "table.header",
			direction: "right",
		}), /direction must match/);
		assert.throws(() => dispatchEngineThemeDataEvent("join:left", "smoke-theme.table-join", {
			themeId: "theme-runtime-smoke.markdown.dark",
			componentId: "markdown",
			slotId: "table.header",
			incoming: { run: () => true },
		}), /must be JSON data/);
		assert.equal(unregisterEngineThemeDataHandler("smoke-theme.table-join"), true);

		const schemaTemplate = {
			schema: {
				type: "stack",
				props: { direction: "row", gap: "6px", align: "center", style: { background: "{{codeBackground}}" } },
				children: [
					{ type: "slot", props: { name: "leading" } },
					{ type: "slot", props: { name: "content" } },
					{ type: "text", props: { content: "{{language}}" } },
				],
			},
		};
		const schemaTemplateResult = renderEngineThemeTemplate(schemaTemplate, {
			componentId: "markdown",
			block: "tableHeader",
			language: "typescript",
			codeBackground: "#123456",
			slots: {
				leading: React.createElement("b", null, "icon"),
				content: React.createElement("span", null, "Feature"),
			},
		});
		assert.equal(schemaTemplateResult.type, "div", "Engine Schema templates render as safe React elements");
		assert.equal(schemaTemplateResult.props.style.flexDirection, "row");
		assert.equal(schemaTemplateResult.props.style.gap, "6px");
		assert.equal(schemaTemplateResult.props.style.background, "#123456", "schema templates can bind safe block style values");
		assert.equal(schemaTemplateResult.props.children[2].props.children, "typescript");
		const fallbackTemplate = renderEngineThemeTemplate({
			schema: {
				type: "box",
				props: { style: { background: "url(https://unsafe.invalid/pixel)" } },
				children: ["literal <script> text"],
			},
		}, {});
		assert.equal(fallbackTemplate.props.style.background, undefined, "template CSS URLs are dropped");
		assert.equal(fallbackTemplate.props.children, "literal <script> text", "template text is kept as text, never raw HTML");
		assert.equal(renderEngineThemeTemplate({
			schema: { type: "box", props: { dangerouslySetInnerHTML: { __html: "x" } } },
		}, {}), undefined, "raw HTML and dangerous props invalidate a template");
		const localAdapter = (props) => React.createElement("aside", null, props.label);
		registerEngineThemeTemplateAdapter("smoke.markdown.header", localAdapter);
		assert.ok(listEngineThemeTemplateAdapters().includes("smoke.markdown.header"));
		const adapterElement = renderEngineThemeTemplate({ adapterId: "smoke.markdown.header" }, { label: "custom" });
		assert.equal(adapterElement.type, localAdapter, "only the explicitly registered local adapter is returned");
		assert.equal(unregisterEngineThemeTemplateAdapter("smoke.markdown.header"), true);
		assert.equal(renderEngineThemeTemplate({ adapterId: "missing.remote.adapter" }, {}), undefined, "unregistered adapters fail closed");

		createTheme({
			id: "theme-runtime-smoke",
			scope: "global",
			vars: { "--runtime-accent": "#aabbcc" },
			fonts: ["https://fonts.example.invalid/theme.css"],
			markdown: {
				defaults: {
					codeBackground: "#111111",
					codeColor: "#eeeeee",
				},
				styles: {
					codeBlock: { borderRadius: "10px", color: "#e0e0e0" },
				},
				templates: { tableHeader: { schema: { type: "slot", props: { name: "content" } } } },
				variants: {
					dark: {
						defaults: { codeBackground: "#222222" },
						styles: { codeBlock: { boxShadow: "0 0 2px #fff" } },
					},
				},
			},
		});
		const pageSchema = {
			theme: { id: "theme-runtime-smoke.markdown.dark" },
			root: {
				type: "section",
				children: [{
					type: "markdown",
					props: {
						content: "test",
						codeBackground: "#333333",
						markdownStyles: { codeBlock: { padding: "8px" } },
					},
				}],
			},
		};
		const resolvedPage = resolveEngineThemeSchema(pageSchema);
		assert.equal(resolvedPage.theme.id, "theme-runtime-smoke", "qualified references retain the group theme for CSS/fonts");
		assert.equal(resolvedPage.theme.vars["--runtime-accent"], "#aabbcc");
		assert.equal(resolvedPage.theme.fonts.length, 1);
		const markdownProps = resolvedPage.root.children[0].props;
		assert.equal(markdownProps.codeBackground, "#333333", "explicit node props beat theme defaults");
		assert.equal(markdownProps.codeColor, "#eeeeee", "base theme defaults survive variant overrides");
		assert.equal(markdownProps.markdownStyles.codeBlock.borderRadius, "10px");
		assert.equal(markdownProps.markdownStyles.codeBlock.boxShadow, "0 0 2px #fff");
		assert.equal(markdownProps.markdownStyles.codeBlock.padding, "8px", "local style-slot properties merge last");
		assert.equal(markdownProps.themeTemplates.tableHeader.schema.type, "slot", "theme templates reach Markdown props through ID resolution");

		const localTheme = createTheme({
			id: "local-theme-runtime-smoke",
			scope: "local",
			markdown: { defaults: { codeColor: "#abcdef" } },
		});
		const localPage = resolveEngineThemeSchema({
			theme: localTheme,
			root: { type: "markdown", props: { content: "local" } },
		});
		assert.equal(localPage.root.props.codeColor, "#abcdef", "a local theme definition can be applied directly");

		assert.throws(() => resolveEngineThemeSchema({
			theme: { id: "missing-theme.markdown.dark" },
			root: { type: "markdown", props: { content: "missing" } },
		}), /not globally registered/);
		assert.throws(() => resolveEngineThemeSchema({
			theme: { id: "remote-theme.markdown.dark", sourceUrl: "https://example.invalid/theme.etr" },
			root: { type: "markdown", props: { content: "remote" } },
		}), /Remote EngineTheme fetching is not enabled/);
	} finally {
		if (previousTsExtension) Module._extensions[".ts"] = previousTsExtension;
		else delete Module._extensions[".ts"];
		if (previousTsxExtension) Module._extensions[".tsx"] = previousTsxExtension;
		else delete Module._extensions[".tsx"];
	}
}

function source(filePath, text) {
	return {
		filePath,
		sourceFile: ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
	};
}

function readArtifact(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function verifyDigest(artifact) {
	const { sha256, ...payload } = artifact;
	const actual = crypto.createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
	assert.equal(actual, sha256, "the SHA-256 digest matches canonical artifact content");
}

function run() {
	testPublicThemeApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-theme-smoke-"));
	try {
		const themeSource = path.join(root, "app", "theme.tsx");
		const input = source(themeSource, [
			'import { createTheme } from "nextjs-engine";',
			'const markdown = { prettyPlease: { mode: "auto" }, table: { header: { placement: "left" } } };',
			'export const theme = createTheme({ id: "dark-fantasy", scope: "remote", name: "Dark Fantasy", markdown });',
			"",
		].join("\n"));
		const options = { nextjsVersion: "16.4.2", engineVersion: "3.0.0-alpha.1" };
		const first = compileEngineThemeArtifacts(root, [input], options);
		assert.equal(first.createdCount, 1);
		assert.equal(first.updatedCount, 0);
		assert.equal(first.unchangedCount, 0);
		assert.equal(first.artifacts[0].id, "dark-fantasy");
		assert.equal(first.artifacts[0].status, "created");

		const artifactPath = path.join(root, ".nextjs-engine", "gen3", "theme", "dark-fantasy.etr");
		const artifactText = fs.readFileSync(artifactPath, "utf8");
		const artifact = readArtifact(artifactPath);
		assert.equal(artifact.format, ETR_FORMAT);
		assert.equal(artifact.formatVersion, 1);
		assert.equal(artifact.generatedBy, "NENC");
		assert.equal(artifact.id, "dark-fantasy");
		assert.equal(artifact.createdWith.nextjs, "16.4.2");
		assert.equal(artifact.createdWith.nextjsEngine, "3.0.0-alpha.1");
		assert.equal(artifact.content.scope, "remote");
		assert.deepEqual(artifact.content.markdown.table.header, { placement: "left" });
		verifyDigest(artifact);

		const warm = compileEngineThemeArtifacts(root, [input], options);
		assert.equal(warm.createdCount, 0);
		assert.equal(warm.updatedCount, 0);
		assert.equal(warm.unchangedCount, 1, "identical artifacts are recognized without rewriting the output");
		assert.equal(fs.readFileSync(artifactPath, "utf8"), artifactText);

		const changed = source(themeSource, [
			'import { createTheme } from "nextjs-engine";',
			'export const theme = createTheme({ id: "dark-fantasy", scope: "remote", markdown: { prettyPlease: { mode: "auto", theme: "new-colors" } } });',
			"",
		].join("\n"));
		const update = compileEngineThemeArtifacts(root, [changed], options);
		assert.equal(update.updatedCount, 1);
		assert.equal(update.createdCount, 0);
		verifyDigest(readArtifact(artifactPath));

		const previousGoodOutput = fs.readFileSync(artifactPath, "utf8");
		assert.throws(() => compileEngineThemeArtifacts(root, [
			changed,
			source(path.join(root, "app", "other.tsx"),
				'import { createTheme } from "nextjs-engine"; createTheme({ id: "dark-fantasy", scope: "remote", markdown: { theme: "conflict" } });'),
		], options), /Duplicate theme group ID/);
		assert.equal(fs.readFileSync(artifactPath, "utf8"), previousGoodOutput,
			"invalid duplicate IDs fail before existing artifacts are changed");

		assert.throws(() => compileEngineThemeArtifacts(root, [
			source(path.join(root, "app", "dynamic.tsx"),
				'import { createTheme } from "nextjs-engine"; const makeTheme = () => ({ id: "dynamic" }); createTheme(makeTheme());'),
		], options), /function calls are not allowed/);

		assert.throws(() => compileEngineThemeArtifacts(root, [
			source(path.join(root, "app", "bad-id.tsx"),
				'import { createTheme } from "nextjs-engine"; createTheme({ id: "../outside", scope: "global" });'),
		], options), /theme id must be one plain group segment/);

		const protectedPath = path.join(root, ".nextjs-engine", "gen3", "theme", "user-owned.etr");
		fs.writeFileSync(protectedPath, JSON.stringify({ hello: "user file" }));
		assert.throws(() => compileEngineThemeArtifacts(root, [
			source(path.join(root, "app", "user-owned.tsx"),
				'import { createTheme } from "nextjs-engine"; createTheme({ id: "user-owned", scope: "global" });'),
		], options), /Refusing to overwrite non-generated theme artifact/);
		assert.equal(fs.readFileSync(protectedPath, "utf8"), JSON.stringify({ hello: "user file" }),
			"the compiler never overwrites an unrelated file with an artifact-name collision");

		const cleanup = compileEngineThemeArtifacts(root, [], options);
		assert.equal(cleanup.removedCount, 1, "stale artifacts previously owned by the compiler are removed");
		assert.equal(fs.existsSync(artifactPath), false);
		assert.equal(fs.existsSync(protectedPath), true, "stale cleanup never deletes files not owned by NENC");

		const symlinkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-theme-symlink-"));
		const outsideDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-theme-outside-"));
		try {
			fs.mkdirSync(path.join(symlinkRoot, ".nextjs-engine"), { recursive: true });
			fs.symlinkSync(outsideDirectory, path.join(symlinkRoot, ".nextjs-engine", "gen3"), "dir");
			assert.throws(() => compileEngineThemeArtifacts(symlinkRoot, [
				source(path.join(symlinkRoot, "app", "symlink-theme.tsx"),
					'import { createTheme } from "nextjs-engine"; createTheme({ id: "symlink-theme" });'),
			], options), /symbolic link/);
			assert.deepEqual(fs.readdirSync(outsideDirectory), [],
				"the compiler refuses to write through a symlink outside the project");
		} finally {
			fs.rmSync(symlinkRoot, { recursive: true, force: true });
			fs.rmSync(outsideDirectory, { recursive: true, force: true });
		}

		console.log("Generation 3 EngineTheme compiler smoke: ok");
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

run();
