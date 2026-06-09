"use client";
import { createPage, defineSchema } from "@/engine";

const HomeSchema = defineSchema({
	meta: {
		title: "Next.js Engine — Technical Showcase & Dev Log",
		description: "Discover the schema-driven rendering layer built on top of Next.js.",
		ogImage: "/og.jpg",
	},
	theme: {
		vars: {
			"--e-accent": "#7c3aed",
			"--e-bg": "#0f0f1a",
			"--e-card-bg": "#1a1a2e",
			"--e-card-filled": "#1e1e35",
			"--e-divider": "rgba(255,255,255,0.08)",
			"--e-muted": "#94a3b8",
			"--e-caption-color": "#64748b",
			"--e-skeleton-a": "#1e1e35",
			"--e-skeleton-b": "#2a2a45",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
		],
		globalStyles: `
			*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
			html { scroll-behavior: smooth; }
			body { background: var(--e-bg); color: #e2e8f0; font-family: 'Inter', sans-serif; }
			::selection { background: var(--e-accent); color: #fff; }
		`,
	},
	root: {
		type: "box",
		props: { display: "flex", flexDir: "column" },
		children: [
			{
				type: "section",
				key: "hero",
				props: {
					fullViewport: true,
					contentMaxWidth: "1100px",
					bg: "linear-gradient(135deg, #0f0f1a 0%, #1a0a3e 100%)",
				},
				children: [
					{
						type: "stack",
						props: { direction: "vertical", gap: "2rem", align: "center" },
						children: [
							{
								type: "text",
								props: {
									variant: "overline",
									content: "⚡ High-Performance Architecture",
									color: "var(--e-accent)",
								},
							},
							{
								type: "heading",
								props: {
									level: 1,
									content: "The Next.js Engine",
									subheading: "A schema-driven rendering layer sitting directly over Next.js. Define pages as plain TypeScript objects and let the engine automate all complex performance optimizations.",
									align: "center",
									gradient: "linear-gradient(135deg, #a78bfa, #60a5fa)",
								},
							},
							{
								type: "stack",
								props: { direction: "horizontal", gap: "1rem", wrap: true, justify: "center" },
								children: [
									{
										type: "button",
										props: {
											label: "Core Principles",
											variant: "solid",
											size: "lg",
											href: "#core-principles",
										},
									},
									{
										type: "button",
										props: {
											label: "v1.1.0 Dev Log",
											variant: "outline",
											size: "lg",
											href: "#dev-log",
										},
									},
								],
							},
						],
					},
				],
			},
			{
				type: "section",
				key: "principles",
				props: {
					id: "core-principles",
					contentMaxWidth: "1200px",
					py: "6rem",
				},
				children: [
					{
						type: "stack",
						props: { direction: "vertical", gap: "3rem" },
						children: [
							{
								type: "heading",
								props: {
									level: 2,
									content: "Core Principles",
									subheading: "Eliminating the friction of raw JSX boilerplate while strictly enforcing automated best practices out of the box.",
									align: "center",
								},
							},
							{
								type: "grid",
								props: { columns: { xs: 1, md: 3 }, gap: "2rem" },
								children: [
									{
										type: "card",
										props: { variant: "filled", innerPadding: "1.5rem" },
										children: [
											{ type: "text", props: { variant: "h4", content: "No Raw HTML markup" } },
											{ type: "text", props: { content: "You never interact directly with a <div> element again. Page models are managed entirely via predictable, type-safe structures." } },
										],
									},
									{
										type: "card",
										props: { variant: "filled", innerPadding: "1.5rem" },
										children: [
											{ type: "text", props: { variant: "h4", content: "Pure CSS Responsive" } },
											{ type: "text", props: { content: "Responsive values map to CSS custom properties and media queries natively, completely eliminating heavy runtime resize listeners." } },
										],
									},
									{
										type: "card",
										props: { variant: "filled", innerPadding: "1.5rem" },
										children: [
											{ type: "text", props: { variant: "h4", content: "Intelligent Lazy Mounts" } },
											{ type: "text", props: { content: "The schema tree is analyzed contextually to apply aggressive chunk lazy loading and content-visibility optimization parameters automatically." } },
										],
									},
								],
							},
						],
					},
				],
			},
			{
				type: "section",
				key: "dev-log-section",
				props: {
					id: "dev-log",
					contentMaxWidth: "1200px",
					py: "6rem",
					bg: "var(--e-card-filled)",
				},
				children: [
					{
						type: "stack",
						props: { direction: "vertical", gap: "3rem" },
						children: [
							{
								type: "heading",
								props: {
									level: 2,
									content: "Dev Log — Version 1.1.0",
									subheading: "An overview tracking the architectural implementations, components, and stability fixes built in the latest update.",
									align: "center",
								},
							},
							{
								type: "grid",
								props: { columns: { xs: 1, md: 2 }, gap: "2.5rem" },
								children: [
									{
										type: "stack",
										props: { direction: "vertical", gap: "1.5rem" },
										children: [
											{
												type: "text",
												props: { variant: "label", content: "✨ What's New", color: "var(--e-accent)", weight: "700" },
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "CSS Tier System" } },
													{ type: "text", props: { variant: "body-sm", content: "StyleCollector automatically ranks CSS blocks into Global, Group, or Local tiers by count metrics to safeguard the cascade order." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Per-Side Spacing System" } },
													{ type: "text", props: { variant: "body-sm", content: "Exposes the new sides property arrays [1,2,3,4] to fine-tune unique granular padding or margin adjustments per element." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Inline CSS Variables" } },
													{ type: "text", props: { variant: "body-sm", content: "Introduces the vars property configuration on schema nodes to assign custom CSS properties that automatically inherit down the layout subtree." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Component Injections (createComponent)" } },
													{ type: "text", props: { variant: "body-sm", content: "An engine utility optimized to build highly modular reusable frame designs that carry operational slots and nested layout elements." } },
												],
											},
										],
									},
									{
										type: "stack",
										props: { direction: "vertical", gap: "1.5rem" },
										children: [
											{
												type: "text",
												props: { variant: "label", content: "📈 What's Improved & Fixed", color: "#60a5fa", weight: "700" },
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Next-Gen Image Pipelines" } },
													{ type: "text", props: { variant: "body-sm", content: "Automated routing through an AVIF -> WebP chain, adding presets ('sharp', 'balanced') and responsive, viewport-aware compression variables." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Markdown Anchors & Transitions" } },
													{ type: "text", props: { variant: "body-sm", content: "EngineMarkdown now generates stable slug IDs for header anchor link tags, coupled with precise controls over staggered text entries." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Expanded Style Bridges" } },
													{ type: "text", props: { variant: "body-sm", content: "Full tracking added for long-form style properties like fontSize, fontWeight, and boxShadow. The 'bg' utility now writes directly to backgrounds." } },
												],
											},
											{
												type: "card",
												props: { variant: "outlined", innerPadding: "1.25rem" },
												children: [
													{ type: "text", props: { variant: "h5", content: "Webpack Async Resolver Patch" } },
													{ type: "text", props: { variant: "body-sm", content: "Resolved a critical SSR build crash by transitioning top-level Node.js fs imports into a dynamic async runtime evaluation block." } },
												],
											},
										],
									},
								],
							},
						],
					},
				],
			},
		],
	},
});

export default createPage({ schema: HomeSchema });