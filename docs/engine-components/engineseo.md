# EngineSEO

EngineSEO is the Generation 3 schema-driven bridge to Next.js 16 metadata, crawler routes, structured data, and social previews. It can infer basic page metadata from an Engine `PageSchema`, or accept a dedicated JSON-style `EngineSEOSchema` when a site needs exact control.

SEO makes a page understandable and presentable to crawlers and link unfurlers. It does not guarantee a ranking or click increase.

## Automatic page metadata

`EngineSEO.create(pageSchema)` reads existing `PageMeta`. If title or description is absent, it conservatively uses the first Engine heading and text node rather than inventing marketing claims.

```tsx
// app/products/page.tsx — keep this file a Server Component
import { createPage, defineSchema, EngineSEO } from "nextjs-engine";

const products = defineSchema({
	meta: {
		title: "Products",
		description: "Browse the current Kastrick product catalog.",
	},
	root: { type: "section", children: [] },
});

const engineseo = EngineSEO.create(products);

export const generateMetadata = engineseo.generateMetadata;
export default createPage(products);
```

Next resolves `generateMetadata()` on the server. Prerenderable metadata is included in the initial HTML, while Next preserves its crawler-specific metadata behavior for dynamic pages.

## Full JSON-style schema

```ts
import { EngineSEO } from "nextjs-engine";

export const engineseo = EngineSEO.create({
	site: {
		name: "Kastrick",
		url: "https://kastrick.example",
		description: "Engine-powered websites and infrastructure.",
		defaultTitle: "Kastrick",
		titleTemplate: "%s | Kastrick",
		locale: "en_IN",
		language: "en",
	},
	page: {
		title: "Next.js Engine",
		description: "A schema-driven rendering engine for Next.js.",
		path: "/products/nextjs-engine",
		keywords: ["Next.js", "React", "schema rendering"],
	},
	social: {
		twitterCard: "summary_large_image",
		twitterCreator: "@kastrick",
	},
	verification: {
		google: "google-site-verification-value",
		bing: "bing-site-verification-value",
	},
	robots: {
		index: true,
		follow: true,
		googleBot: { "max-image-preview": "large" },
	},
	structuredData: "auto",
});
```

Explicit values win over inferred ones. Empty schemas do not manufacture social cards or robots tags.

## Setter API

The schema can be adjusted during server-module initialization:

```ts
const engineseo = EngineSEO.create({
	site: { name: "Kastrick", url: "https://kastrick.example" },
});

engineseo.set.title("Next.js Engine");
engineseo.set.description("Build schema-driven Next.js pages.");
engineseo.set.canonical("/products/nextjs-engine");
engineseo.set.keywords(["Next.js", "engine"]);
```

Use the correctly spelled `description()` API. Setters return the builder, so calls may also be chained.

For request-dependent metadata, pass a resolver and export the generated function:

```ts
export const generateMetadata = EngineSEO.generate<PageProps<"/products/[slug]">>(async ({ params }) => {
	const { slug } = await params;
	const product = await loadProduct(slug);
	return {
		site: { name: "Kastrick", url: "https://kastrick.example" },
		page: { title: product.name, description: product.summary, path: `/products/${slug}` },
	};
});
```

## Social preview modes

### Custom image

```ts
engineseo.set.preview.customImage({
	url: "/social/nextjs-engine.png",
	alt: "Next.js Engine preview",
	width: 1200,
	height: 630,
});
```

### Website screenshot

Website mode uses a real screenshot image as the OpenGraph/Twitter preview and retains the source page URL:

```ts
engineseo.set.preview.website({
	pageUrl: "https://kastrick.example/products/nextjs-engine",
	screenshot: {
		url: "/engine-seo/nextjs-engine.png",
		alt: "Screenshot of the Next.js Engine product page",
		width: 1200,
		height: 630,
	},
});
```

Capture or refresh that asset with the Node-only SEO plugin helper. The page must already be reachable; capturing the same not-yet-built application from inside its own build would create a circular dependency.

```js
const { captureEngineSEOWebsitePreview } = require("nextjs-engine/seo-plugin");

await captureEngineSEOWebsitePreview({
	url: "http://localhost:3000/products/nextjs-engine",
	outputPath: "public/engine-seo/nextjs-engine.png",
	width: 1200,
	height: 630,
});
```

The capture helper lazily uses `playwright` or `@playwright/test`, disables animation, applies reduced motion, waits for the selected page, and always closes the browser.

### Generated `ImageResponse` card

```ts
engineseo.set.preview.generated({
	background: "linear-gradient(135deg, #07111f, #172554)",
	accent: "#60a5fa",
});
```

The combined plugin can generate `app/opengraph-image.tsx`, or a hand-written route can call the dedicated server entrypoint:

```tsx
// app/opengraph-image.tsx
import { createEngineSEOImageResponse } from "nextjs-engine/seo";
import { seoSchema } from "./seo-schema";

export const alt = "Kastrick";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
	return createEngineSEOImageResponse(seoSchema, size);
}
```

## Sitemap and robots

Builders expose functions matching Next's metadata file conventions:

```ts
// app/sitemap.ts
export { sitemap as default } from "../seo";

// app/robots.ts
export { robots as default } from "../seo";
```

Or let the combined plugin discover static App Router and Pages Router routes and generate both protected files:

```js
module.exports = withEngine(nextConfig, {
	seo: {
		schema: {
			site: { name: "Kastrick", url: "https://kastrick.example" },
			sitemap: { routes: "auto", lastModified: "git" },
			robots: { index: true, follow: true },
			preview: { mode: "generated" },
		},
		generate: { sitemap: true, robots: true, openGraphImage: true },
	},
});
```

Dynamic segments such as `[slug]` cannot be guessed safely and must be listed explicitly with their real paths. EngineSEO refuses to overwrite hand-written `sitemap.ts`, `robots.ts`, or `opengraph-image.tsx` files and removes only files carrying its generated ownership marker.

### Accurate modification dates

Automatic sitemaps use `lastModified: "git"` by default. EngineSEO finds the source file for each static route and writes the date of the commit that most recently changed that file. An explicit route-level `lastModified` always wins. When Git history or a source file is unavailable (for example, a dynamic CMS route), EngineSEO omits the date instead of publishing a false signal; supply the content's real update date yourself:

```js
sitemap: {
	routes: [
		{ path: "/", lastModified: "2026-09-16T12:34:56Z" },
		{ path: "/articles/engine-seo", lastModified: article.updatedAt },
	],
}
```

Use `lastModified: false` to disable automatic dates. `lastModified: "build"` stamps every discovered route with one build timestamp and is intended only for pages whose meaningful content is genuinely regenerated on every build. Search engines can ignore repeatedly inaccurate dates, so build time is not the safe default. `changeFrequency` and `priority` remain available for sitemap compatibility, but major crawlers may ignore them.

## JSON-LD

`structuredData: "auto"` creates conservative `WebSite` and `WebPage`/`Article` nodes from known schema data. Add exact schema.org entities when needed:

```tsx
const data = await engineseo.jsonLd();

export default function Layout({ children }) {
	return <>{children}<EngineSEOJsonLd data={data} /></>;
}
```

Custom JSON-LD accepts ordinary JSON objects with `@type`, including `Person`, `Organization`, `SoftwareApplication`, `Article`, and portfolio entities. Serialization escapes markup-significant characters so user-controlled text cannot terminate the JSON-LD script.

## Next.js rules

- `metadata` and `generateMetadata` are Server Component exports; do not place them in a `"use client"` page.
- Do not export both `metadata` and `generateMetadata` from the same route segment.
- Next file-based metadata has higher priority than `generateMetadata`.
- OG image routes should remain within the `ImageResponse` 500 KB bundle limit and its supported flexbox/CSS subset.
