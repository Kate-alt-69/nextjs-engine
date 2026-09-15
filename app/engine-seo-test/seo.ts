import { EngineSEO, defineSchema } from "@/src/engine";

export const engineSEOTestSchema = defineSchema({
	meta: {
		title: "EngineSEO proof",
		description: "A production route proving EngineSEO metadata, JSON-LD, and generated social images.",
	},
	root: {
		type: "section",
		props: { contentMaxWidth: "800px", py: "5rem" },
		children: [
			{ type: "heading", props: { level: 1, content: "EngineSEO proof" } },
			{ type: "text", props: { content: "This route validates the Generation 3 SEO pipeline during a real Next.js build." } },
		],
	},
});

export const engineSEOTest = EngineSEO.create({
	site: {
		name: "Next.js Engine",
		url: "https://nextjs-engine.example",
		description: "Schema-driven Next.js rendering.",
		titleTemplate: "%s | Next.js Engine",
		language: "en",
	},
	page: {
		title: engineSEOTestSchema.meta?.title,
		description: engineSEOTestSchema.meta?.description,
		path: "/engine-seo-test",
		keywords: ["Next.js", "SEO", "structured data"],
	},
	preview: {
		mode: "generated",
		accent: "#60a5fa",
	},
	structuredData: "auto",
});
