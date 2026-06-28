"use client";

import { createPage, defineSchema } from "@/engine";
import type { ManimConfig } from "@/engine";

// ─────────────────────────────────────────────────────────────────────────────
//	Documentation Data
//	Following DRY principles by extracting repeating data structures to keep 
//	the schema clean, modular, and easy to maintain.
// ─────────────────────────────────────────────────────────────────────────────

const architectureModules = [
	{ name: "core/resolver.ts", desc: "Converts ResponsiveValue props to CSS custom properties dynamically." },
	{ name: "core/StyleCollector.ts", desc: "Collects CSS blocks during render, outputs one unified style tag." },
	{ name: "core/lazyDetect.ts", desc: "Analyses nodes and makes automated lazy-loading decisions per element." },
	{ name: "core/EngineAPIResolver.ts", desc: "Runtime fetch orchestrator with multi-tier auth and macros." },
	{ name: "core/schemaAnalyzer.ts", desc: "Static analyzer for diagnostics, accessibility, and performance warnings." },
];

const lazyLoadingRules = [
	{ type: "Video", condition: "Always", strategy: "Full lazy mount, rootMargin 800px" },
	{ type: "Image", condition: "Area > 640x480", strategy: "Lazy mount, size-based rootMargin" },
	{ type: "Section", condition: "Depth > 0, >10 descendants", strategy: "Full lazy mount" },
	{ type: "Section", condition: "Depth > 0, light content", strategy: "content-visibility: auto" },
	{ type: "Any", condition: "props.priority = true", strategy: "Always eager, skip all lazy logic" },
];

// ─────────────────────────────────────────────────────────────────────────────
//	EngineManim Configuration
//	Compiles into pre-allocated Float32Array coordinate pools on the client.
//	Performs zero heap allocation during the rendering loops.
// ─────────────────────────────────────────────────────────────────────────────

const morphingAnimation: ManimConfig = {
	mobjects: [
		{ 
			id: "circle", 
			type: "Circle", 
			radius: 65, 
			x: 180, 
			y: 180, 
			strokeColor: "#38bdf8", 
			strokeWidth: 3, 
			fillColor: "rgba(56, 189, 248, 0.08)" 
		},
		{ 
			id: "square", 
			type: "Square", 
			sideLength: 110, 
			x: 180, 
			y: 180, 
			strokeColor: "#818cf8", 
			strokeWidth: 3, 
			fillColor: "rgba(129, 140, 248, 0.08)" 
		},
		{ 
			id: "rectangle", 
			type: "Rectangle", 
			width: 150, 
			height: 80, 
			x: 180, 
			y: 180, 
			strokeColor: "#fbbf24", 
			strokeWidth: 3, 
			fillColor: "rgba(251, 191, 36, 0.08)" 
		}
	],
	timeline: [
		{ action: "Create", target: "circle", durationMs: 900, delay: 200, easing: "ease-out" },
		{ action: "Wait", durationMs: 400 },
		{ action: "Transform", origin: "circle", target: "square", durationMs: 800, easing: "elastic" },
		{ action: "Wait", durationMs: 400 },
		{ action: "Transform", origin: "square", target: "rectangle", durationMs: 800, easing: "bounce" },
		{ action: "Wait", durationMs: 400 },
		{ action: "Transform", origin: "rectangle", target: "circle", durationMs: 900, easing: "ease-in-out" },
		{ action: "FadeOut", target: "circle", durationMs: 500 }
	],
	settings: { 
		loop: true, 
		fpsLimit: 60, 
		background: "transparent" 
	}
};

// ─────────────────────────────────────────────────────────────────────────────
//	Schema Definition
// ─────────────────────────────────────────────────────────────────────────────

const DocumentationSchema = defineSchema({
	meta: {
		title: "Next.js Engine Documentation",
		description: "Official comprehensive guide to the Next.js schema-driven rendering layer with live mathematical animations.",
	},
	theme: {
		vars: {
			"--e-bg": "#0b0f19",
			"--e-surface": "#131a2e",
			"--e-card-bg": "#1e294b",
			"--e-text": "#f8fafc",
			"--e-muted": "#94a3b8",
			"--e-accent": "#38bdf8",
			"--e-border": "#1e293b",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
		],
		globalStyles: `
			body { background: var(--e-bg); color: var(--e-text); font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; }
			::selection { background: var(--e-accent); color: var(--e-bg); }
			code { font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.125rem 0.25rem; border-radius: 4px; color: #38bdf8; }
			html { scroll-behavior: smooth; }
		`
	},
	root: {
		type: "box",
		children: [
			
			// ── NAVIGATION ──
			{
				type: "nav",
				props: {
					sticky: true,
					logo: { alt: "Engine Docs", href: "#" },
					items: [
						{ label: "Overview", href: "#overview" },
						{ label: "Architecture", href: "#architecture" },
						{ label: "Animations", href: "#animations" },
						{ label: "Responsive", href: "#responsive" },
						{ label: "Lazy Loading", href: "#lazy" },
					],
					bg: "rgba(11, 15, 25, 0.95)",
					borderBottom: "1px solid var(--e-border)",
				}
			},

			// ── SPLIT HERO SECTION ──
			{
				type: "hero",
				props: {
					variant: "split",
					fullViewport: false,
					py: { xs: "4rem", md: "7rem" },
					px: "1.5rem",
					bg: "radial-gradient(circle at top left, rgba(56,189,248,0.1), transparent 45%)",
				},
				children: [
					// Column 1: Typography Block
					{
						type: "stack",
						props: { direction: "vertical", gap: "1.5rem", align: "flex-start" },
						children: [
							{
								type: "text",
								props: {
									variant: "overline",
									content: "⚡ Advanced Visual Pipelines",
									color: "var(--e-accent)",
									weight: 700,
								},
							},
							{
								type: "heading",
								props: {
									level: 1,
									content: "Mathematical Animation & Rendering Engine",
									subheading: "Define complex UI states and hardware-accelerated animations completely from high-performance schemas.",
									align: "left",
									size: { xs: "2.4rem", md: "3.6rem" },
									gradient: "linear-gradient(135deg, #38bdf8, #818cf8, #fbbf24)",
								}
							},
							{
								type: "button",
								props: {
									label: "Explore Animations",
									variant: "solid",
									size: "md",
									href: "#animations",
								}
							}
						]
					},
					// Column 2: Live EngineManim Playground
					{
						type: "card",
						props: {
							variant: "outlined",
							bg: "var(--e-surface)",
							border: "1px solid var(--e-border)",
							innerPadding: "1rem",
							style: {
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								minHeight: "360px",
								position: "relative"
							}
						},
						children: [
							{
								type: "manim",
								props: {
									cprop: { manim: morphingAnimation },
									width: 360,
									height: 360,
									style: {
										maxWidth: "100%",
									}
								}
							},
							{
								type: "text",
								props: {
									variant: "caption",
									content: "Live 2D Vector Morphing (Circle ➔ Square ➔ Rectangle)",
									color: "var(--e-muted)",
									position: "absolute",
									bottom: "1rem",
								}
							}
						]
					}
				]
			},

			// ── OVERVIEW (MARKDOWN) ──
			{
				type: "section",
				props: { point: "overview", contentMaxWidth: "850px", py: "3rem" },
				children: [
					{
						type: "markdown",
						props: {
							content: "## Core Principle\n\nRaw React and Next.js are fast when optimised correctly, but they give you nothing for free. Every optimization — `React.memo`, `next/image`, `IntersectionObserver`, `content-visibility`, responsive CSS — has to be applied manually.\n\n**The engine applies all of them automatically, every time, for every element.** You never touch a raw HTML tag again. The engine handles everything via a typed schema.",
							textColor: "var(--e-muted)",
							headingColor: "var(--e-text)",
						}
					}
				]
			},

			// ── ARCHITECTURE GRID ──
			{
				type: "section",
				props: { point: "architecture", contentMaxWidth: "1000px", py: "3rem" },
				children: [
					{ type: "heading", props: { level: 2, content: "Architecture Highlights", mb: "2rem" } },
					{
						type: "grid",
						props: { columns: { xs: 1, md: 2 }, gap: "1.5rem" },
						children: architectureModules.map((mod) => ({
							type: "card",
							key: mod.name,
							props: { 
								variant: "outlined", 
								bg: "var(--e-surface)", 
								border: "1px solid var(--e-border)",
								interactive: true
							},
							children: [
								{ type: "text", props: { variant: "mono", content: mod.name, color: "var(--e-accent)", mb: "0.5rem" } },
								{ type: "text", props: { content: mod.desc, color: "var(--e-muted)", lineHeight: 1.5 } }
							]
						}))
					}
				]
			},

			// ── ADVANCED ANIMATIONS DOCUMENTATION ──
			{
				type: "section",
				props: { point: "animations", contentMaxWidth: "850px", py: "4rem" },
				children: [
					{
						type: "markdown",
						props: {
							content: "## Mathematical Animations (Manim & Manim3D)\n\nOur engine features native abstractions for beautiful mathematical animations, directly inspired by Grant Sanderson's Manim framework. Because rendering animations via normal React render cycles triggers constant layout recalculation, the engine compiles geometry definitions into lightweight Float32Array pools on load.\n\n### Why 2D Manim is Performing\n\n- **Zero Heap Allocation:** Interpolation frames execute without invoking garbage collection arrays.\n- **Approximation Curves:** Circles automatically approximate with 4 cubic Bezier curves using KAPPA constants.\n- **Compositor Promotion:** Recalculations are completely isolated via `will-change: transform` and `contain: strict` bounds.\n\n",
                            textColor: "var(--e-muted)",
							headingColor: "var(--e-text)",
							linkColor: "var(--e-accent)",
						}
					}
				]
			},

			// ── LAZY LOADING RULES ──
			{
				type: "section",
				props: { point: "lazy", contentMaxWidth: "1000px", py: "3rem", mb: "4rem" },
				children: [
					{ type: "heading", props: { level: 2, content: "Automated Lazy Loading Logic", mb: "2rem" } },
					{ type: "text", props: { content: "The engine automatically assesses rendering weight and applies lazy-loading strategies without manual intervention.", color: "var(--e-muted)", mb: "2rem" } },
					{
						type: "grid",
						props: { columns: 1, gap: "1rem" },
						children: lazyLoadingRules.map((rule, idx) => ({
							type: "card",
							key: `rule-${idx}`,
							props: { 
								variant: "flat", 
								bg: "var(--e-surface)", 
								border: "1px solid var(--e-border)",
								direction: { xs: "vertical", md: "horizontal" }, 
								innerPadding: "1.5rem", 
								align: "center",
								gap: "1rem"
							},
							children: [
								{ type: "text", props: { variant: "label", content: rule.type, color: "var(--e-accent)", minW: "120px" } },
								{ type: "text", props: { content: rule.condition, minW: "250px", weight: 600 } },
								{ type: "text", props: { content: rule.strategy, color: "var(--e-muted)" } }
							]
						}))
					}
				]
			},

			// ── FOOTER ──
			{
				type: "section",
				props: {
					contentMaxWidth: "1000px",
					py: "3rem",
					borderTop: "1px solid var(--e-border)",
				},
				children: [
					{
						type: "text",
						props: {
							align: "center",
							color: "var(--e-muted)",
							variant: "caption",
							content: "Generated using the Next.js Engine primitive registry."
						}
					}
				]
			}
		]
	}
});

export default createPage({ schema: DocumentationSchema });