// ─────────────────────────────────────────────────────────────────────────────
//  Example — app/page.tsx
//
//  A full page built entirely with the engine.
//  No raw HTML. No raw JSX. No manual optimization.
//  The engine handles:
//    · Responsive layout (CSS vars, zero JS)
//    · Lazy loading (images auto by size, videos always, sections if heavy)
//    · content-visibility: auto on off-screen sections
//    · React.memo on every component
//    · next/image on every image
//    · Blur-up progressive image loading
//    · Video never fetches until 800px before viewport
// ─────────────────────────────────────────────────────────────────────────────

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

			// ── HERO SECTION ─────────────────────────────────────────────────
			// depth=0 → never lazy, always eager
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
									content: "BuffCowLand Platform",
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
											href: "/signup",
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

					// Hero image — priority=true because it's above-fold
					// The engine sees priority and skips IntersectionObserver entirely
					{
						type: "image",
						props: {
							src: "/hero-screenshot.png",
							alt: "BuffCowLand dashboard preview",
							width: 1200,
							height: 700,
							priority: true,             // ← above fold: loads immediately
							aspectRatio: "16/7",
							objectFit: "cover",
							borderRadius: "16px",
							shadow: "0 40px 80px rgba(0,0,0,0.5)",
							mt: "3rem",
						},
					},
				],
			},

			// ── FEATURES GRID ─────────────────────────────────────────────────
			// depth=1, 9 children → engine auto-lazy-mounts this section
			{
				type: "section",
				key: "features",
				props: {
					contentMaxWidth: "1200px",
					py: { xs: "3rem", md: "5rem" },
					snapAlign: "start",
				},
				children: [
					{
						type: "heading",
						props: {
							level: 2,
							content: "Everything you need",
							subheading: "One platform, all the tools.",
							align: "center",
							mb: "3rem",
						},
					},
					{
						type: "grid",
						props: {
							// Responsive columns via CSS vars — zero JS
							columns: { xs: 1, sm: 2, lg: 3 },
							gap: { xs: "1.5rem", md: "2rem" },
						},
						children: [
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "⚡ Video Streaming", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "fMP4 + HLS adaptive streaming with Brotli archive recovery." } },
								],
							},
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "🔒 E2E Payments", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "X25519 ECDH + AES-256-GCM encrypted end-to-end payment flow." } },
								],
							},
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "🤖 Discord Bots", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "Full bot ecosystem with ThreadPool, ticket system, and HMAC privacy." } },
								],
							},
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "📦 Containers", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "Rust-based container runtime with UAC trust scoring and named pipes." } },
								],
							},
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "🛡 Auth System", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "Google OAuth + SMTP email, SQLite sessions, Cloudflare Tunnel." } },
								],
							},
							{
								type: "card",
								props: { variant: "filled", p: "1.5rem" },
								children: [
									{ type: "text", props: { variant: "h4", content: "📊 Status Page", mb: "0.5rem" } },
									{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "Multi-service monitoring with AES-256-GCM cloud sync and admin dashboard." } },
								],
							},
						],
					},
				],
			},

			// ── DEMO VIDEO ────────────────────────────────────────────────────
			// Video nodes are ALWAYS lazy — src never loads until 800px before viewport
			{
				type: "section",
				key: "demo",
				props: { contentMaxWidth: "900px", py: { xs: "3rem", md: "5rem" } },
				children: [
					{
						type: "heading",
						props: {
							level: 2,
							content: "See it in action",
							align: "center",
							mb: "2rem",
						},
					},
					{
						type: "video",
						props: {
							src: "/demo.mp4",
							poster: "/demo-thumb.jpg",
							aspectRatio: "16/9",
							controls: true,
							// lazy=true is applied automatically by the engine
							// src never touches the network until 800px before this enters view
						},
					},
				],
			},

			// ── GALLERY ───────────────────────────────────────────────────────
			// Images > 640×480 are auto-lazy by the engine's size threshold
			{
				type: "section",
				key: "gallery",
				props: { contentMaxWidth: "1200px", py: { xs: "3rem", md: "5rem" } },
				children: [
					{
						type: "heading",
						props: { level: 2, content: "Gallery", align: "center", mb: "2rem" },
					},
					{
						type: "grid",
						props: { columns: { xs: 1, md: 2, lg: 3 }, gap: "1rem" },
						children: [
							{
								type: "image",
								props: {
									src: "/gallery/1.jpg",
									alt: "Screenshot 1",
									width: 800,
									height: 500,
									// width=800, height=500 → area > 640×480 → engine auto-lazy loads
									borderRadius: "12px",
									objectFit: "cover",
								},
							},
							{
								type: "image",
								props: {
									src: "/gallery/2.jpg",
									alt: "Screenshot 2",
									width: 800,
									height: 500,
									borderRadius: "12px",
									objectFit: "cover",
								},
							},
							{
								type: "image",
								props: {
									src: "/gallery/3.jpg",
									alt: "Screenshot 3",
									width: 800,
									height: 500,
									borderRadius: "12px",
									objectFit: "cover",
								},
							},
						],
					},
				],
			},

			// ── FOOTER ────────────────────────────────────────────────────────
			{
				type: "section",
				key: "footer",
				props: {
					contentMaxWidth: "1200px",
					py: "3rem",
					bg: "rgba(0,0,0,0.3)",
				},
				children: [
					{ type: "divider", props: { mb: "2rem" } },
					{
						type: "stack",
						props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", align: "center", gap: "1rem" },
						children: [
							{ type: "text", props: { variant: "body-sm", color: "var(--e-muted)", content: "© 2025 BuffCowLand. Built by Kastrick." } },
							{
								type: "stack",
								props: { direction: "horizontal", gap: "1.5rem" },
								children: [
									{ type: "button", props: { label: "Docs", variant: "link", href: "/docs" } },
									{ type: "button", props: { label: "GitHub", variant: "link", href: "https://github.com" } },
									{ type: "button", props: { label: "Discord", variant: "link", href: "/discord" } },
								],
							},
						],
					},
				],
			},
		],
	},
});

// One line. All optimizations applied automatically.
export default createPage({ schema: HomeSchema });
