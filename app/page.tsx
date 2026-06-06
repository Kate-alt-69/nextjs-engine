"use client";
import { createPage, defineSchema } from "@/engine";

const HomeSchema = defineSchema({
	meta: {
		title: "BuffCowLand — Home",
		description: "The BuffCowLand platform.",
		ogImage: "/og.jpg",
	},
	theme: {
		vars: {
			"--e-accent":       "#7c3aed",
			"--e-bg":           "#0f0f1a",
			"--e-card-bg":      "#1a1a2e",
			"--e-card-filled":  "#1e1e35",
			"--e-divider":      "rgba(255,255,255,0.08)",
			"--e-muted":        "#94a3b8",
			"--e-caption-color":"#64748b",
			"--e-skeleton-a":   "#1e1e35",
			"--e-skeleton-b":   "#2a2a45",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
		],
		globalStyles: `
			*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
			html { scroll-behavior: smooth; scroll-snap-type: y proximity; }
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
					snapAlign: "start",
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
									content: "🚀 Now in Beta",
									color: "var(--e-accent)",
								},
							},
							{
								type: "heading",
								props: {
									level: 1,
									content: "Kastrick Platform",
									subheading: "A full-stack platform built for speed, built for scale.",
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
											label: "Get Started",
											variant: "solid",
											size: "lg",
											href: "/",
										},
									},
									{
										type: "button",
										props: {
											label: "View Docs",
											variant: "outline",
											size: "lg",
											href: "/docs",
										},
									},
								],
							},
						],
					},
					{
						type: "image",
						props: {
							src: "https://images.unsplash.com/photo-1633356122544-f134324ef6db?w=1200&h=700&fit=crop",
							alt: "Dashboard preview",
							width: 1200,
							height: 700,
							priority: true,
							aspectRatio: "16/7",
							objectFit: "cover",
							borderRadius: "16px",
							shadow: "0 40px 80px rgba(0,0,0,0.5)",
							mt: "3rem",
						},
					},
				],
			},
		],
	},
});

export default createPage({ schema: HomeSchema });
