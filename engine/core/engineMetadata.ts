// ─────────────────────────────────────────────────────────────────────────────
//  Engine — generateEngineMetadata
//
//  Converts a PageSchema (or just its PageMeta) into Next.js App Router
//  Metadata objects that work with generateMetadata() in route pages.
//
//  WHY THIS EXISTS:
//  Next.js App Router ignores <meta> tags rendered inside the body.
//  SEO meta (title, description, Open Graph, Twitter Card) MUST come from
//  a generateMetadata() export in the page.tsx file. This utility bridges
//  the engine's PageMeta definition to the Next.js Metadata type.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import type { PageSchema, PageMeta } from "../schema/types";

export function generateEngineMetadata(schema: PageSchema): Metadata;
export function generateEngineMetadata(meta: PageMeta): Metadata;

export function generateEngineMetadata(input: PageSchema | PageMeta): Metadata {
	const meta: PageMeta = "root" in input ? (input as PageSchema).meta ?? {} : input as PageMeta;

	const title = meta.title;
	const description = meta.description;
	const ogImage = meta.ogImage;
	const ogTitle = meta.ogTitle ?? title;
	const ogDescription = meta.ogDescription ?? description;
	const result: Metadata = {};

	if (title) result.title = title;
	if (description) result.description = description;
	if (meta.keywords?.length) result.keywords = meta.keywords;
	if (meta.canonical) result.alternates = { canonical: meta.canonical };

	if (meta.noIndex) {
		result.robots = { index: false, follow: false };
	}

	// Do not manufacture empty social metadata objects. Besides keeping generated
	// head output smaller, this avoids claiming a Twitter card exists when the
	// schema supplied no social metadata at all.
	if (ogTitle || ogDescription || ogImage) {
		result.openGraph = {
			type: "website",
			...(ogTitle ? { title: ogTitle } : {}),
			...(ogDescription ? { description: ogDescription } : {}),
			...(ogImage ? { images: [{ url: ogImage }] } : {}),
		};
	}

	if (meta.twitterCard || ogTitle || ogDescription || ogImage) {
		result.twitter = {
			card: meta.twitterCard ?? "summary_large_image",
			...(ogTitle ? { title: ogTitle } : {}),
			...(ogDescription ? { description: ogDescription } : {}),
			...(ogImage ? { images: [ogImage] } : {}),
		};
	}

	return result;
}
