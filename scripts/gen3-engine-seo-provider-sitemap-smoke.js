"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

const previousLoader = require.extensions[".ts"];
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

const { compileEngineSEOProviderSitemap } = require("../src/engine/core/engineseo/EngineSEOProviderSitemap.ts");
const {
	GENERATED_MARKER,
	PROVIDER_SITEMAP_MARKER,
	prepareEngineSEORoutes,
} = require("../src/engine/plugins/engineSEOPlugin.js");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextjs-engine-provider-sitemap-"));

function touch(relative, source = "export default function Page() { return null; }\n") {
	const filename = path.join(root, relative);
	fs.mkdirSync(path.dirname(filename), { recursive: true });
	fs.writeFileSync(filename, source, "utf8");
	return filename;
}

function run() {
	const schema = {
		site: { name: "Kastrick", url: "https://kastrick.example" },
		sitemap: {
			providerFiles: true,
			routes: [
				{
					path: "/localized?a=1&b=2",
					lastModified: "2026-09-16T12:34:56Z",
					changeFrequency: "weekly",
					priority: 0.8,
					images: ["/images/engine.png"],
					alternates: { en: "/localized", "gu-IN": "/gu/localized" },
				},
				{
					path: "/watch",
					videos: [{
						thumbnailUrl: "/video/thumb.jpg",
						title: "A & B <Guide>",
						description: "Provider-aware video sitemap coverage.",
						contentUrl: "/video/engine.mp4",
						duration: 120,
						rating: 4.5,
						viewCount: 123,
						publicationDate: "2026-09-17T00:00:00Z",
						familyFriendly: true,
						restriction: { relationship: "allow", countries: ["IN", "US"] },
						platform: { relationship: "allow", types: ["web", "mobile"] },
						requiresSubscription: false,
						uploader: { name: "Kastrick", info: "/about" },
						live: false,
						tags: ["engine", "seo"],
					}],
				},
				{
					path: "/news",
					providers: ["google"],
					news: {
						publicationName: "Kastrick News",
						language: "en",
						publicationDate: "2026-09-17T01:00:00Z",
						title: "Fresh & New",
					},
				},
				{
					path: "/old-news",
					news: {
						publicationName: "Kastrick News",
						language: "en",
						publicationDate: "2026-09-10T01:00:00Z",
						title: "Old Story",
					},
				},
			],
		},
	};

	const google = compileEngineSEOProviderSitemap(schema, "google", { now: "2026-09-17T12:00:00Z" });
	assert.match(google, /xmlns:image=/);
	assert.match(google, /xmlns:video=/);
	assert.match(google, /xmlns:news=/);
	assert.match(google, /xmlns:xhtml=/);
	assert.match(google, /<image:image>/);
	assert.match(google, /<video:video>/);
	assert.match(google, /<news:news>/);
	assert.match(google, /Fresh &amp; New/);
	assert.match(google, /A &amp; B &lt;Guide&gt;/);
	assert.doesNotMatch(google, /Old Story/);
	assert.doesNotMatch(google, /<priority>/);
	assert.doesNotMatch(google, /<changefreq>/);

	const bing = compileEngineSEOProviderSitemap(schema, "bing", { now: "2026-09-17T12:00:00Z" });
	assert.match(bing, /<lastmod>2026-09-16T12:34:56.000Z<\/lastmod>/);
	assert.doesNotMatch(bing, /<priority>/);
	assert.doesNotMatch(bing, /<changefreq>/);
	assert.doesNotMatch(bing, /image:image/);
	assert.doesNotMatch(bing, /video:video/);
	assert.doesNotMatch(bing, /news:news/);
	assert.doesNotMatch(bing, /xhtml:link/);
	assert.doesNotMatch(bing, /https:\/\/kastrick\.example\/news/);

	const yandex = compileEngineSEOProviderSitemap(schema, "yandex", { now: "2026-09-17T12:00:00Z" });
	assert.match(yandex, /<changefreq>weekly<\/changefreq>/);
	assert.match(yandex, /<priority>0.8<\/priority>/);
	assert.doesNotMatch(yandex, /xhtml:link/);
	assert.doesNotMatch(yandex, /image:image/);
	assert.doesNotMatch(yandex, /video:video/);
	assert.doesNotMatch(yandex, /news:news/);

	touch("app/page.tsx");
	const generated = prepareEngineSEORoutes({
		rootDir: root,
		modulePath: path.resolve(__dirname, "../src/engine/core/engineseo/index.ts"),
		schema: {
			site: { name: "Kastrick", url: "https://kastrick.example" },
			sitemap: { routes: "auto", lastModified: false, providerFiles: true },
		},
		generate: { robots: false, openGraphImage: false },
	});
	assert.deepEqual(Object.keys(generated.providerSitemaps), ["google", "bing", "yandex"]);
	for (const [provider, filename] of Object.entries(generated.providerSitemaps)) {
		assert.ok(fs.existsSync(filename), `${provider} provider sitemap route was not generated`);
		const source = fs.readFileSync(filename, "utf8");
		assert.ok(source.startsWith(GENERATED_MARKER));
		assert.match(source, new RegExp(PROVIDER_SITEMAP_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
		assert.match(source, /compileEngineSEOProviderSitemap/);
		assert.match(source, /revalidate = 3600/);
	}
	assert.ok(generated.providerSitemaps.google.endsWith(path.join("google_sitemap.xml", "route.ts")));
	assert.ok(generated.providerSitemaps.bing.endsWith(path.join("bing_sitemap.xml", "route.ts")));
	assert.ok(generated.providerSitemaps.yandex.endsWith(path.join("yandex_sitemap.xml", "route.ts")));

	prepareEngineSEORoutes({ rootDir: root, enabled: false });
	for (const filename of Object.values(generated.providerSitemaps)) assert.equal(fs.existsSync(filename), false);

	const custom = prepareEngineSEORoutes({
		rootDir: root,
		modulePath: path.resolve(__dirname, "../src/engine/core/engineseo/index.ts"),
		schema: {
			site: { name: "Kastrick", url: "https://kastrick.example" },
			sitemap: {
				routes: "auto",
				lastModified: false,
				providerFiles: { google: { filename: "google.sitemap.xml" }, bing: false },
			},
		},
		generate: { sitemap: false, robots: false, openGraphImage: false },
	});
	assert.ok(custom.providerSitemaps.google.endsWith(path.join("google.sitemap.xml", "route.ts")));
	assert.equal(custom.providerSitemaps.bing, undefined);
	assert.throws(() => prepareEngineSEORoutes({
		rootDir: root,
		modulePath: path.resolve(__dirname, "../src/engine/core/engineseo/index.ts"),
		schema: {
			site: { name: "Kastrick", url: "https://kastrick.example" },
			sitemap: { providerFiles: { google: { filename: "sitemap.xml" } } },
		},
		generate: { sitemap: false },
	}), /cannot use sitemap\.xml/);

	console.log("Generation 3 EngineSEO provider sitemap smoke: ok");
}

try {
	run();
} finally {
	if (previousLoader) require.extensions[".ts"] = previousLoader;
	else delete require.extensions[".ts"];
	fs.rmSync(root, { recursive: true, force: true });
}
