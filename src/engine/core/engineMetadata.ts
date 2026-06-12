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
//
//  USAGE in a route page:
//
//    import type { Metadata } from "next";
//    import { generateEngineMetadata } from "@/engine";
//    import { myPageSchema } from "./schema";
//
//    export async function generateMetadata(): Promise<Metadata> {
//      return generateEngineMetadata(myPageSchema);
//    }
//
//    export default createPage(myPageSchema);
//
//  USAGE with just meta (no full schema):
//
//    export async function generateMetadata(): Promise<Metadata> {
//      return generateEngineMetadata({
//        title: "My Page",
//        description: "Hello world",
//        ogImage: "https://example.com/og.jpg",
//      });
//    }
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import type { PageSchema, PageMeta } from "../schema/types";

// ── Overload signatures ───────────────────────────────────────────────────────

export function generateEngineMetadata(schema: PageSchema): Metadata;
export function generateEngineMetadata(meta: PageMeta): Metadata;

// ── Implementation ────────────────────────────────────────────────────────────

export function generateEngineMetadata(input: PageSchema | PageMeta): Metadata {
	// Detect if input is a full PageSchema (has .root) or just PageMeta
	const meta: PageMeta = "root" in input ? (input as PageSchema).meta ?? {} : input as PageMeta;

	const title       = meta.title;
	const description = meta.description;
	const ogImage     = meta.ogImage;
	const ogTitle     = meta.ogTitle ?? title;
	const ogDesc      = meta.ogDescription ?? description;

	const result: Metadata = {};

	if (title)         result.title       = title;
	if (description)   result.description = description;
	if (meta.keywords?.length) result.keywords = meta.keywords;
	if (meta.canonical) result.alternates  = { canonical: meta.canonical };

	if (meta.noIndex) {
		result.robots = { index: false, follow: false };
	}

	// ── Open Graph ────────────────────────────────────────────────────────────
	result.openGraph = {};
	if (ogTitle)   result.openGraph.title       = ogTitle;
	if (ogDesc)    result.openGraph.description = ogDesc;
	if (ogImage)   result.openGraph.images      = [{ url: ogImage }];
	if (result.openGraph) {
		(result.openGraph as any).type = "website";
	}

	// Remove empty openGraph object
	if (Object.keys(result.openGraph).length <= 1) delete result.openGraph;

	// ── Twitter Card ──────────────────────────────────────────────────────────
	const cardType = meta.twitterCard ?? "summary_large_image";
	result.twitter = { card: cardType } as Metadata["twitter"];
	if (ogTitle) (result.twitter as Record<string, unknown>).title       = ogTitle;
	if (ogDesc)  (result.twitter as Record<string, unknown>).description = ogDesc;
	if (ogImage) (result.twitter as Record<string, unknown>).images      = [ogImage];

	return result;
}
