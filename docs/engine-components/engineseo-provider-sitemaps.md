# EngineSEO provider-aware XML sitemaps

EngineSEO can generate a universal `/sitemap.xml` plus search-engine-aware XML endpoints for Google, Bing, and Yandex. The provider maps share the same route inventory but deliberately emit different XML instead of cloning one generic sitemap under several names.

Provider XML is opt-in. Existing EngineSEO applications keep the ordinary Next.js sitemap behavior until `sitemap.providerFiles` is enabled.

## Enable all built-in provider maps

```js
module.exports = withEngine(nextConfig, {
	seo: {
		schema: {
			site: {
				name: "Kastrick",
				url: "https://kastrick.example",
			},
			sitemap: {
				routes: "auto",
				lastModified: "git",
				providerFiles: true,
			},
		},
	},
});
```

That creates:

```text
/sitemap.xml
/google_sitemap.xml
/bing_sitemap.xml
/yandex_sitemap.xml
```

The provider URLs are generated as protected App Router route handlers. EngineSEO owns only files carrying its generated marker and will not overwrite an application-owned `route.ts`.

The provider handlers are static with hourly revalidation. This matters for Google News because News metadata is valid only for recent articles; a long-running deployment can age old News tags out without requiring a redeploy.

## What each provider receives

### Google

The Google map follows the standard Sitemap protocol and can additionally emit Google's supported XML extensions:

- accurate `<lastmod>`
- image entries with the Google image namespace
- video entries with the Google video namespace
- recent Google News entries
- localized alternates with `xhtml:link` / `hreflang`

Google ignores sitemap `priority` and `changefreq`, so EngineSEO intentionally omits them from `google_sitemap.xml`.

### Bing

The Bing map is intentionally lean:

- `<loc>`
- accurate `<lastmod>` when known

Bing currently recommends accurate `lastmod` and ignores `priority` and `changefreq`, so those fields are omitted rather than emitting noise.

### Yandex

The Yandex map emits standard Sitemap fields that Yandex currently documents:

- `<loc>`
- `<lastmod>`
- `<changefreq>`
- `<priority>`

EngineSEO does not copy Google image/video/News namespaces into the Yandex map. It also does not emit sitemap `hreflang` there because current Yandex guidance directs language-version declarations to page HTML instead.

## Custom names and selective providers

`true` enables all built-ins. An object enables only the providers you configure:

```js
sitemap: {
	routes: "auto",
	providerFiles: {
		google: {
			filename: "google.sitemap.xml",
		},
		bing: true,
		yandex: false,
	},
}
```

The example creates `/google.sitemap.xml` and `/bing_sitemap.xml` only.

Provider filenames must be safe `.xml` basenames. `sitemap.xml` is reserved for the universal Next.js sitemap and cannot be reused by a provider map. Duplicate provider filenames are rejected.

The build plugin can disable only these endpoints without disabling the universal sitemap:

```js
generate: {
	sitemap: true,
	providerSitemaps: false,
}
```

## Route metadata

Explicit routes can carry provider-specific XML data:

```ts
sitemap: {
	providerFiles: true,
	routes: [
		{
			path: "/products/nextjs-engine",
			lastModified: "2026-09-17T03:00:00Z",
			changeFrequency: "weekly",
			priority: 0.9,
			images: [
				"/images/nextjs-engine/hero.png",
			],
			alternates: {
				en: "/products/nextjs-engine",
				"gu-IN": "/gu/products/nextjs-engine",
			},
			videos: [
				{
					thumbnailUrl: "/video/engine-thumb.jpg",
					title: "Next.js Engine overview",
					description: "A short overview of the Generation 3 engine.",
					contentUrl: "/video/engine-overview.mp4",
					duration: 120,
					publicationDate: "2026-09-17T02:00:00Z",
					familyFriendly: true,
					tags: ["Next.js", "EngineSEO"],
				},
			],
		},
		{
			path: "/news/engine-3",
			providers: ["google"],
			news: {
				publicationName: "Kastrick News",
				language: "en",
				publicationDate: "2026-09-17T01:30:00Z",
				title: "Generation 3 ships provider-aware sitemaps",
			},
		},
	],
}
```

`providers` filters a route from provider maps. It does not change the universal `/sitemap.xml`.

Google video entries support the current useful sitemap fields: thumbnail, title, description, direct content URL or player URL, duration, expiration date, rating, view count, publication date, family-friendly state, country restrictions, platform restrictions, subscription requirement, uploader information, live state, and up to 32 tags.

EngineSEO validates important Google constraints before emitting XML, including the content/player requirement, description length, duration/rating/view-count ranges, uploader length, tag count, and valid dates.

## Google News aging

A route can remain in `google_sitemap.xml` indefinitely, but its `<news:news>` block is emitted only while the publication is within Google's two-day News window.

This means an article naturally changes from:

```xml
<url>
	<loc>https://kastrick.example/news/engine-3</loc>
	<news:news>...</news:news>
</url>
```

to an ordinary sitemap URL after the News window expires. The page itself is not removed from the sitemap.

A single provider sitemap is rejected if it would exceed the standard 50,000 URL / 50 MB uncompressed limits. Google-specific validation also enforces at most 1,000 image entries per URL and at most 1,000 currently active News entries in one generated map.

## robots.txt and webmaster submission

EngineSEO keeps `/sitemap.xml` as the normal sitemap advertised by generated `robots.txt`.

It intentionally does **not** add all provider maps to `robots.txt`. A `Sitemap:` directive is global rather than scoped to a particular user-agent, so advertising three provider-specialized maps there would make every crawler discover all three copies.

Submit the specialized maps directly where useful:

- `/google_sitemap.xml` in Google Search Console
- `/bing_sitemap.xml` in Bing Webmaster Tools
- `/yandex_sitemap.xml` in Yandex Webmaster

The universal `/sitemap.xml` remains a standards-compliant fallback for every crawler and for engines without a dedicated EngineSEO compiler.
