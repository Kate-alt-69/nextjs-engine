"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const previousLoaders = { ts: require.extensions[".ts"], tsx: require.extensions[".tsx"] };
const loadTypeScript = (module, filename) => {
	const source = fs.readFileSync(filename, "utf8");
	const output = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
			jsx: ts.JsxEmit.ReactJSX,
			esModuleInterop: true,
		},
		fileName: filename,
	}).outputText;
	module._compile(output, filename);
};
require.extensions[".ts"] = loadTypeScript;
require.extensions[".tsx"] = loadTypeScript;

const {
	EngineSEO,
	compileEngineSEOJsonLd,
	compileEngineSEOMetadata,
	compileEngineSEORobots,
	compileEngineSEOSitemap,
	createEngineSEO,
	inferEngineSEOSchema,
} = require("../src/engine/core/engineseo/EngineSEO.ts");
const { serializeEngineSEOJsonLd } = require("../src/engine/core/engineseo/EngineSEOJsonLd.tsx");
const {
	GENERATED_MARKER,
	captureEngineSEOWebsitePreview,
	discoverEngineSEORoutes,
	prepareEngineSEORoutes,
} = require("../src/engine/plugins/engineSEOPlugin.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-seo-"));

function touch(relative, source = "export default function Page() { return null; }\n") {
	const filename = path.join(root, relative);
	fs.mkdirSync(path.dirname(filename), { recursive: true });
	fs.writeFileSync(filename, source, "utf8");
	return filename;
}

async function run() {
	const inferred = inferEngineSEOSchema({
		root: {
			type: "section",
			children: [
				{ type: "heading", props: { content: "Automatic Engine title" } },
				{ type: "text", props: { content: "A concise description inferred from the first useful Engine text node." } },
			],
		},
	});
	assert.equal(inferred.page.title, "Automatic Engine title");
	assert.match(inferred.page.description, /concise description/);
	assert.equal(inferred.structuredData, "auto");

	const schema = {
		site: { name: "Kastrick", url: "https://kastrick.example", description: "Engine-powered websites", titleTemplate: "%s | Kastrick", language: "en" },
		page: { title: "EngineSEO", description: "Search metadata without repetitive route boilerplate.", path: "/engine-seo", keywords: ["Next.js", "SEO"] },
		preview: { mode: "website", pageUrl: "https://kastrick.example/engine-seo", screenshot: { url: "/seo/engine-seo.png", alt: "EngineSEO website preview", width: 1200, height: 630 } },
		verification: { google: "google-proof", bing: "bing-proof" },
		sitemap: { routes: [{ path: "/", priority: 1 }, { path: "/engine-seo", changeFrequency: "weekly", priority: 0.8 }] },
		structuredData: "auto",
	};
	const metadata = compileEngineSEOMetadata(schema);
	assert.equal(metadata.title, "EngineSEO | Kastrick");
	assert.equal(metadata.alternates.canonical, "https://kastrick.example/engine-seo");
	assert.equal(metadata.openGraph.images[0].url, "https://kastrick.example/seo/engine-seo.png");
	assert.equal(metadata.twitter.card, "summary_large_image");
	assert.equal(metadata.verification.other["msvalidate.01"], "bing-proof");
	assert.deepEqual(compileEngineSEOMetadata({}), {}, "an empty SEO schema must not manufacture metadata objects");
	assert.equal(compileEngineSEOMetadata({
		site: { name: "Kastrick", url: "https://kastrick.example" },
		preview: { mode: "website", pageUrl: "https://kastrick.example/live", screenshot: { url: "/live.png" } },
	}).alternates.canonical, "https://kastrick.example/live");

	const sitemap = compileEngineSEOSitemap(schema);
	assert.deepEqual(sitemap.map(({ url }) => url), ["https://kastrick.example/", "https://kastrick.example/engine-seo"]);
	assert.equal(sitemap[1].changeFrequency, "weekly");
	const robots = compileEngineSEORobots(schema);
	assert.equal(robots.rules.userAgent, "*");
	assert.equal(robots.sitemap, "https://kastrick.example/sitemap.xml");
	assert.equal(compileEngineSEORobots({ ...schema, robots: { index: false } }).rules.disallow, "/");
	const jsonLd = compileEngineSEOJsonLd(schema);
	assert.deepEqual(jsonLd.map((entry) => entry["@type"]), ["WebSite", "WebPage"]);
	assert.doesNotMatch(serializeEngineSEOJsonLd([{ "@type": "WebPage", name: "</script><script>alert(1)</script>" }]), /<script>/);

	const builder = createEngineSEO(schema);
	builder.set.title("Setter title").set.description("Setter description").set.preview.customImage("/setter.png");
	const builderMetadata = await builder.generateMetadata({}, Promise.resolve({}));
	assert.equal(builderMetadata.title, "Setter title | Kastrick");
	assert.equal(builderMetadata.description, "Setter description");
	assert.equal(builderMetadata.openGraph.images[0].url, "https://kastrick.example/setter.png");
	assert.equal(typeof EngineSEO.generate(schema), "function");

	touch("app/page.tsx");
	touch("app/products/page.tsx");
	touch("app/(docs)/docs/page.tsx");
	touch("app/blog/[slug]/page.tsx");
	touch("app/_private/page.tsx");
	touch("pages/account.tsx");
	assert.deepEqual(discoverEngineSEORoutes(root), ["/", "/account", "/docs", "/products"]);

	const generated = prepareEngineSEORoutes({
		rootDir: root,
		modulePath: path.resolve(__dirname, "../src/engine/core/engineseo/index.ts"),
		imageModulePath: path.resolve(__dirname, "../src/engine/seo.ts"),
		schema: { ...schema, sitemap: { routes: "auto" }, preview: { mode: "generated" } },
	});
	assert.deepEqual(generated.routes, ["/", "/account", "/docs", "/products"]);
	for (const filename of Object.values(generated.files)) assert.ok(fs.readFileSync(filename, "utf8").startsWith(GENERATED_MARKER));
	assert.match(fs.readFileSync(generated.files.sitemap, "utf8"), /createEngineSEO/);
	assert.match(fs.readFileSync(generated.files.openGraphImage, "utf8"), /createEngineSEOImageResponse/);

	const foreignRobots = "export default function robots() { return { rules: [] }; }\n";
	fs.writeFileSync(generated.files.robots, foreignRobots, "utf8");
	prepareEngineSEORoutes({ rootDir: root, enabled: false });
	assert.equal(fs.readFileSync(generated.files.robots, "utf8"), foreignRobots, "EngineSEO must preserve application-owned metadata routes");
	assert.equal(fs.existsSync(generated.files.sitemap), false);
	assert.equal(fs.existsSync(generated.files.openGraphImage), false);

	const calls = [];
	const browserType = {
		async launch() {
			return {
				async newPage(options) {
					calls.push(["newPage", options]);
					return {
						emulateMedia: async (options) => calls.push(["emulateMedia", options]),
						goto: async (url) => calls.push(["goto", url]),
						waitForTimeout: async (delay) => calls.push(["delay", delay]),
						screenshot: async (options) => calls.push(["screenshot", options]),
					};
				},
				close: async () => calls.push(["close"]),
			};
		},
	};
	const capture = await captureEngineSEOWebsitePreview({
		url: "https://kastrick.example/engine-seo",
		outputPath: path.join(root, "public", "seo", "engine-seo.png"),
		publicDir: path.join(root, "public"),
		browserType,
		delay: 0,
	});
	assert.equal(capture.publicUrl, "/seo/engine-seo.png");
	assert.ok(calls.some(([name]) => name === "screenshot"));
	assert.equal(calls.at(-1)[0], "close");

	console.log("Generation 3 EngineSEO schema and route smoke: ok");
}

run().finally(() => {
	if (previousLoaders.ts) require.extensions[".ts"] = previousLoaders.ts;
	else delete require.extensions[".ts"];
	if (previousLoaders.tsx) require.extensions[".tsx"] = previousLoaders.tsx;
	else delete require.extensions[".tsx"];
	fs.rmSync(root, { recursive: true, force: true });
}).catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
