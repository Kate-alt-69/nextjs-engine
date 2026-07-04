import { createPage, defineSchema } from "@/engine";

const EngineShowcaseSchema = defineSchema({
	meta: {
		title: "Next.js Engine — Interactive Canvas & Animation",
		description: "Exploring GPU-accelerated graphics and declarative animation paths.",
	},
	root: {
		type: "section",
		props: {
			contentMaxWidth: "1200px",
			px: { xs: "1rem", md: "2.5rem" },
			py: "4rem",
			fullViewport: true,
		},
		children: [
			{
				type: "stack",
				props: {
					direction: "vertical",
					gap: "1.5rem",
					align: "center",
					mb: "3rem",
				},
				children: [
					{
						type: "heading",
						props: {
							level: 1,
							content: "The Animation Layer",
							subheading: "Seamless vector injection using EngineCanvas SVG graphics.",
						},
					},
				],
			},
			{
				type: "grid",
				props: {
					columns: { xs: 1, lg: 2 },
					gap: "3rem",
					alignItems: "center",
				},
				children: [
					{
						type: "stack",
						props: {
							direction: "vertical",
							gap: "1.5rem",
						},
						children: [
							{
								type: "text",
								props: {
									variant: "h3",
									content: "Declarative Vector Morphing",
								},
							},
							{
								type: "text",
								props: {
									variant: "body",
									content: "By targeting engine-level graphics pipelines, the system compiles geometry configurations directly into memory pools. This minimizes main-thread layout thrashing and ensures smooth, crisp rendering at any display zoom level.",
								},
							},
						],
					},
					{
						type: "card",
						props: {
							variant: "outlined",
							innerPadding: "1rem",
							cprop: {
								css: {
									position: "relative",
									overflow: "hidden",
									minHeight: "400px",
									background: "var(--e-bg-surface)",
									borderRadius: "12px",
								},
							},
						},
						children: [
							{
								type: "canvas",
								props: {
									graphics: {
										engine: "svg",
										/*
											The canvas runtime handles live SVG injection. 
											We leverage paths extracted from your structural assets 
											to draw fluid interactive nodes directly inside the view bounds.
										*/
										scene: {
											nodes: [
												{
													id: "vector-shape-1",
													type: "path",
													d: "M 50,100 A 50,50 0 1,1 150,100 A 50,50 0 1,1 50,100 Z",
													fill: "none",
													stroke: "var(--e-accent)",
													strokeWidth: 2,
												},
												{
													id: "vector-shape-2",
													type: "path",
													d: "M 250,100 Q 300,50 350,100 T 450,100",
													fill: "none",
													stroke: "var(--e-muted)",
													strokeWidth: 1.5,
												},
											],
										},
									},
								},
							},
						],
					},
				],
			},
		],
	},
});

export default createPage({
	schema: EngineShowcaseSchema,
});