"use client";

import { createPage, defineSchema } from "@/engine";

const featureCards = [
	{
		title: "At-rule style objects",
		kicker: "StyleCollector",
		body: "Nested @media and @supports rules compile through the engine instead of leaking invalid keys into React inline styles.",
		accent: "#13b8a6",
	},
	{
		title: "Schema-native surfaces",
		kicker: "Primitives",
		body: "Cards, grids, stacks, headings, links, forms, slots, and markdown render from one predictable tree.",
		accent: "#ef7d31",
	},
	{
		title: "Lazy-aware rendering",
		kicker: "Resolver",
		body: "Heavy sections and below-fold content can be mounted late while preserving layout with intrinsic height hints.",
		accent: "#6477ff",
	},
	{
		title: "Tokenized themes",
		kicker: "Theme",
		body: "Global variables, node-level vars, and responsive CSS values give the page a clean design language without component rewrites.",
		accent: "#cf3f62",
	},
];

const releaseRows = [
	["Nav", "Shared anchor pipeline, active states, dropdowns, and breakpoint-driven mobile behavior."],
	["API", "Compiled .EngineAPIConfig files, provider auth, version macros, and zero-fingerprint header filtering."],
	["Markdown", "Animated content blocks, generated heading anchors, and long-form typography controls."],
	["Forms", "Native form primitives with data-engine-bind attributes ready for API orchestration."],
];

const HomeSchema = defineSchema({
	meta: {
		title: "Next.js Engine Advanced Showcase",
		description: "A schema-driven Next.js page exercising advanced engine rendering features.",
		ogImage: "/og.jpg",
	},
	theme: {
		vars: {
			"--e-bg": "#f6f1e8",
			"--e-surface": "#fffaf2",
			"--e-card-bg": "#fffaf2",
			"--e-card-filled": "#ebe4d8",
			"--e-border": "rgba(35, 32, 26, 0.14)",
			"--e-divider": "rgba(35, 32, 26, 0.14)",
			"--e-text": "#23201a",
			"--e-muted": "#6e6658",
			"--e-accent": "#0d9488",
			"--e-warm": "#ef7d31",
			"--e-rose": "#cf3f62",
			"--e-blue": "#4659d6",
			"--engine-nav-bg": "rgba(246, 241, 232, 0.88)",
			"--engine-nav-border": "rgba(35, 32, 26, 0.12)",
			"--engine-nav-color": "#23201a",
			"--engine-nav-active-color": "#0d9488",
			"--engine-nav-active-bg": "rgba(13, 148, 136, 0.1)",
			"--engine-nav-height": "4rem",
			"--engine-nav-max-width": "1180px",
			"--engine-nav-dropdown-bg": "#fffaf2",
			"--engine-nav-dropdown-border": "rgba(35, 32, 26, 0.14)",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
		],
		globalStyles: `
			*, *::before, *::after { box-sizing: border-box; }
			html { scroll-behavior: smooth; background: var(--e-bg); }
			body { margin: 0; background: var(--e-bg); color: var(--e-text); font-family: 'Inter', system-ui, sans-serif; }
			::selection { background: var(--e-accent); color: white; }
			input, textarea, button { font: inherit; }
			@keyframes enginePulse { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
			@keyframes engineSweep { from { transform: translateX(-40%); } to { transform: translateX(110%); } }
		`,
	},
	root: {
		type: "box",
		props: {
			display: "flex",
			flexDir: "column",
			bg: "var(--e-bg)",
			color: "var(--e-text)",
			overflow: "hidden",
		},
		children: [
			{
				type: "nav",
				key: "top-nav",
				props: {
					sticky: true,
					mobileBreakpoint: 860,
					logo: { alt: "Next.js Engine", href: "/" },
					items: [
						{ label: "Deck", href: "#deck", active: true },
						{ label: "Systems", href: "#systems" },
						{
							label: "Deep dives",
							children: [
								{ label: "At-rules", href: "#at-rules" },
								{ label: "Markdown", href: "#markdown" },
								{ label: "Forms", href: "#forms" },
							],
						},
						{ label: "Docs", href: "/DOCUMENT.md", target: "_blank" },
					],
				},
			},
			{
				type: "hero",
				key: "deck",
				props: {
					id: "deck",
					variant: "split",
					fullViewport: false,
					contentMaxWidth: "1180px",
					py: { xs: "5rem", md: "7rem" },
					px: { xs: "1.25rem", md: "2rem" },
					bg: "radial-gradient(circle at top left, rgba(13,148,136,0.18), transparent 32%), linear-gradient(135deg, #fffaf2 0%, #efe5d4 46%, #dfe8e4 100%)",
					style: {
						"@media(max-width: 860px)": {
							minHeight: "auto",
						},
					},
				},
				children: [
					{
						type: "stack",
						props: { direction: "vertical", gap: { xs: "1.25rem", md: "1.7rem" }, align: "flex-start" },
						children: [
							{
								type: "text",
								props: {
									variant: "overline",
									content: "Schema-driven rendering lab",
									color: "var(--e-accent)",
									weight: 800,
									letterSpacing: "0.08em",
								},
							},
							{
								type: "heading",
								props: {
									level: 1,
									content: "Next.js Engine, running the fun stuff.",
									subheading: "This page is rendered from one schema and exercises responsive values, nested CSS at-rules, sticky navigation, slots, markdown animation, form primitives, and lazy-friendly structure.",
									align: "left",
									size: { xs: "2.6rem", md: "4.8rem" },
									lineHeight: 0.94,
									subheadingProps: {
										size: { xs: "1rem", md: "1.15rem" },
										color: "var(--e-muted)",
										lineHeight: 1.7,
									},
								},
							},
							{
								type: "stack",
								props: { direction: "horizontal", gap: "0.75rem", wrap: true },
								children: [
									{
										type: "button",
										props: {
											label: "Explore systems",
											variant: "elevated",
											size: "lg",
											href: "#systems",
											accentColor: "var(--e-accent)",
											cprop: {
												onHover: {
													transform: "translateY(-2px)",
													"@media(prefers-reduced-motion: reduce)": {
														transform: "none",
													},
												},
											},
										},
									},
									{
										type: "button",
										props: {
											label: "See at-rules",
											variant: "outline",
											size: "lg",
											href: "#at-rules",
											accentColor: "var(--e-blue)",
										},
									},
								],
							},
						],
					},
					{
						type: "box",
						props: {
							display: "grid",
							gap: "0.8rem",
							p: { xs: "1rem", md: "1.2rem" },
							bg: "rgba(255, 250, 242, 0.72)",
							border: "1px solid rgba(35, 32, 26, 0.16)",
							borderRadius: "24px",
							boxShadow: "0 24px 80px rgba(35, 32, 26, 0.16)",
							backdropFilter: "blur(18px)",
							style: {
								minHeight: "430px",
								"@media(max-width: 860px)": {
									minHeight: "360px",
								},
							},
						},
						children: [
							{
								type: "grid",
								props: { columns: "1.2fr 0.8fr", gap: "0.8rem" },
								children: [
									{
										type: "card",
										props: {
											variant: "flat",
											innerPadding: "1rem",
											bg: "#23201a",
											color: "#fffaf2",
											style: { minHeight: "180px" },
										},
										children: [
											{ type: "text", props: { variant: "label", content: "Render graph", color: "#9ce0d6", weight: 800 } },
											{
												type: "grid",
												props: { columns: 4, gap: "0.5rem", mt: "1rem" },
												children: ["schema", "resolver", "collector", "paint"].map((label, index) => ({
													type: "box",
													key: label,
													props: {
														p: "0.75rem",
														borderRadius: "12px",
														bg: index === 1 ? "rgba(19,184,166,0.28)" : "rgba(255,250,242,0.12)",
														border: "1px solid rgba(255,250,242,0.14)",
													},
													children: [
														{ type: "text", props: { variant: "caption", content: label, color: "#f7ead8", weight: 700 } },
													],
												})),
											},
											{
												type: "box",
												props: {
													mt: "1.1rem",
													h: "0.45rem",
													borderRadius: "999px",
													bg: "linear-gradient(90deg, #13b8a6, #ef7d31, #cf3f62)",
													animation: "engineSweep 2.6s ease-in-out infinite alternate",
												},
											},
										],
									},
									{
										type: "stack",
										props: { direction: "vertical", gap: "0.8rem" },
										children: [
											{
												type: "card",
												props: {
													variant: "filled",
													innerPadding: "1rem",
													style: { minHeight: "86px" },
												},
												children: [
													{ type: "text", props: { variant: "caption", content: "CSS emitted", color: "var(--e-muted)" } },
													{ type: "text", props: { variant: "h3", content: "31", color: "var(--e-accent)" } },
												],
											},
											{
												type: "card",
												props: {
													variant: "outlined",
													innerPadding: "1rem",
													style: { minHeight: "86px" },
												},
												children: [
													{ type: "text", props: { variant: "caption", content: "Hydration work", color: "var(--e-muted)" } },
													{ type: "text", props: { variant: "h3", content: "low", color: "var(--e-warm)" } },
												],
											},
										],
									},
								],
							},
							{
								type: "slot",
								props: { name: "inspectorPanel" },
							},
						],
					},
				],
			},
			{
				type: "section",
				key: "systems",
				props: {
					id: "systems",
					contentMaxWidth: "1180px",
					py: { xs: "4rem", md: "6rem" },
					px: { xs: "1.25rem", md: "2rem" },
				},
				children: [
					{
						type: "stack",
						props: { direction: "vertical", gap: "2rem" },
						children: [
							{
								type: "heading",
								props: {
									level: 2,
									content: "Engine systems in one schema pass",
									subheading: "The cards below mix responsive maps, pseudo-state CSS, node variables, per-side spacing, and nested style at-rules.",
									align: "left",
									size: { xs: "2rem", md: "3rem" },
								},
							},
							{
								type: "grid",
								props: {
									columns: { xs: 1, md: 2, lg: 4 },
									gap: "1rem",
								},
								children: featureCards.map((card) => ({
									type: "card",
									key: card.title,
									props: {
										variant: "outlined",
										interactive: true,
										innerPadding: "1.15rem",
										vars: { "--card-accent": card.accent },
										borderTop: "4px solid var(--card-accent)",
										sides: [1],
										sideDistance: "0.35rem",
										sideType: "padding",
										cprop: {
											onHover: {
												background: "white",
												transform: "translateY(-6px)",
												boxShadow: "0 18px 42px rgba(35,32,26,0.12)",
											},
										},
										style: {
											minHeight: "245px",
											"@media(max-width: 720px)": {
												minHeight: "auto",
											},
										},
									},
									children: [
										{ type: "text", props: { variant: "overline", content: card.kicker, color: "var(--card-accent)", weight: 900 } },
										{ type: "text", props: { variant: "h4", content: card.title, mt: "0.7rem" } },
										{ type: "text", props: { content: card.body, color: "var(--e-muted)", lineHeight: 1.65, mt: "0.65rem" } },
									],
								})),
							},
						],
					},
				],
			},
			{
				type: "section",
				key: "at-rules",
				props: {
					id: "at-rules",
					contentMaxWidth: "1180px",
					py: { xs: "4rem", md: "6rem" },
					px: { xs: "1.25rem", md: "2rem" },
					bg: "#23201a",
					color: "#fffaf2",
				},
				children: [
					{
						type: "grid",
						props: { columns: { xs: 1, md: "0.9fr 1.1fr" }, gap: "2rem", align: "center" },
						children: [
							{
								type: "stack",
								props: { direction: "vertical", gap: "1rem" },
								children: [
									{ type: "text", props: { variant: "overline", content: "New CSS compiler path", color: "#9ce0d6", weight: 900 } },
									{
										type: "heading",
										props: {
											level: 2,
											content: "Nested @ rules, authored directly in schema.",
											subheading: "This section uses schema style objects to change its layout and paint values at breakpoints without hand-written component CSS.",
											align: "left",
											size: { xs: "2rem", md: "3.2rem" },
											subheadingProps: { color: "rgba(255,250,242,0.72)", lineHeight: 1.7 },
										},
									},
								],
							},
							{
								type: "card",
								props: {
									variant: "flat",
									innerPadding: "1.2rem",
									bg: "rgba(255,250,242,0.08)",
									border: "1px solid rgba(255,250,242,0.18)",
									style: {
										backdropFilter: "blur(16px)",
										"@supports not (backdrop-filter: blur(16px))": {
											background: "rgba(255,250,242,0.14)",
										},
									},
								},
								children: [
									{
										type: "markdown",
										props: {
											content: "```ts\nstyle: {\n\tdisplay: \"grid\",\n\t\"@media(max-width: 720px)\": {\n\t\tdisplay: \"block\"\n\t},\n\t\"@supports(backdrop-filter: blur(16px))\": {\n\t\tbackdropFilter: \"blur(16px)\"\n\t}\n}\n```",
											bodySize: "0.95rem",
											bodyLineHeight: 1.65,
											textColor: "#fffaf2",
											headingColor: "#9ce0d6",
											blockAnimation: "slide-up",
											animationStagger: 30,
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
				key: "markdown-release",
				props: {
					id: "markdown",
					contentMaxWidth: "1180px",
					py: { xs: "4rem", md: "6rem" },
					px: { xs: "1.25rem", md: "2rem" },
				},
				children: [
					{
						type: "grid",
						props: { columns: { xs: 1, lg: "1fr 1fr" }, gap: "1.5rem" },
						children: [
							{
								type: "card",
								props: { variant: "filled", innerPadding: "1.4rem" },
								children: [
									{
										type: "markdown",
										props: {
											headingIdPrefix: "release",
											blockAnimation: "fade-in",
											animationDuration: "0.45s",
											animationStagger: 45,
											headingColor: "var(--e-text)",
											linkColor: "var(--e-accent)",
											bodySize: "1rem",
											bodyLineHeight: 1.7,
											content: "## Markdown, but engine-native\n\nThe same schema can host long-form docs with generated heading anchors, animated blocks, and theme-aware typography.\n\n- Stable IDs for headings\n- Reduced-motion aware animations\n- Inline code and list rendering\n- Content can come from files or direct schema strings",
										},
									},
								],
							},
							{
								type: "suspense",
								props: {
									preset: "shimmer",
									minHeight: "320px",
									skeletonLines: 6,
									delay: 120,
									bg: "var(--e-card-bg)",
									border: "1px solid var(--e-border)",
									borderRadius: "18px",
									p: "1.4rem",
								},
								children: [
									{
										type: "stack",
										props: { direction: "vertical", gap: "0.85rem" },
										children: releaseRows.map(([label, body]) => ({
											type: "card",
											key: label,
											props: {
												variant: "outlined",
												innerPadding: "1rem",
												style: {
													display: "grid",
													gridTemplateColumns: "96px 1fr",
													gap: "1rem",
													"@media(max-width: 560px)": {
														gridTemplateColumns: "1fr",
													},
												},
											},
											children: [
												{ type: "text", props: { variant: "label", content: label, color: "var(--e-blue)", weight: 900 } },
												{ type: "text", props: { content: body, color: "var(--e-muted)", lineHeight: 1.55 } },
											],
										})),
									},
								],
							},
						],
					},
				],
			},
			{
				type: "section",
				key: "forms",
				props: {
					id: "forms",
					contentMaxWidth: "1180px",
					py: { xs: "4rem", md: "6rem" },
					px: { xs: "1.25rem", md: "2rem" },
					bg: "linear-gradient(180deg, #ebe4d8, #f6f1e8)",
				},
				children: [
					{
						type: "grid",
						props: { columns: { xs: 1, md: "0.85fr 1.15fr" }, gap: "1.5rem", align: "start" },
						children: [
							{
								type: "stack",
								props: { direction: "vertical", gap: "1rem" },
								children: [
									{ type: "text", props: { variant: "overline", content: "Native form primitives", color: "var(--e-rose)", weight: 900 } },
									{
										type: "heading",
										props: {
											level: 2,
											content: "A form authored entirely as schema.",
											subheading: "Inputs emit data-engine-bind markers and keep normal HTML semantics, which leaves room for EngineAPIResolver orchestration.",
											align: "left",
										},
									},
								],
							},
							{
								type: "form",
								props: {
									method: "post",
									noValidate: true,
									display: "grid",
									gap: "1rem",
									p: "1.2rem",
									bg: "var(--e-card-bg)",
									border: "1px solid var(--e-border)",
									borderRadius: "20px",
									boxShadow: "0 18px 52px rgba(35,32,26,0.1)",
								},
								children: [
									{
										type: "grid",
										props: { columns: { xs: 1, md: 2 }, gap: "1rem" },
										children: [
											{
												type: "stack",
												props: { direction: "vertical", gap: "0.45rem" },
												children: [
													{ type: "label", props: { forInput: "engine-name" }, children: [{ type: "text", props: { variant: "label", content: "Project name" } }] },
													{
														type: "input",
														props: {
															id: "engine-name",
															name: "project",
															placeholder: "Control room",
															required: true,
															p: "0.85rem",
															border: "1px solid var(--e-border)",
															borderRadius: "12px",
															bg: "#fffdf8",
														},
													},
												],
											},
											{
												type: "stack",
												props: { direction: "vertical", gap: "0.45rem" },
												children: [
													{ type: "label", props: { forInput: "engine-mode" }, children: [{ type: "text", props: { variant: "label", content: "Mode" } }] },
													{
														type: "input",
														props: {
															id: "engine-mode",
															name: "mode",
															placeholder: "production",
															p: "0.85rem",
															border: "1px solid var(--e-border)",
															borderRadius: "12px",
															bg: "#fffdf8",
														},
													},
												],
											},
										],
									},
									{
										type: "textarea",
										props: {
											name: "notes",
											placeholder: "What should the engine optimize first?",
											rows: 5,
											resizable: "vertical",
											p: "0.9rem",
											border: "1px solid var(--e-border)",
											borderRadius: "12px",
											bg: "#fffdf8",
										},
									},
									{
										type: "stack",
										props: { direction: "horizontal", gap: "0.75rem", align: "center", wrap: true },
										children: [
											{
												type: "checkbox",
												props: {
													id: "engine-consent",
													name: "profile",
													defaultChecked: true,
													accentColor: "var(--e-accent)",
													w: "1.1rem",
													h: "1.1rem",
												},
											},
											{ type: "label", props: { forInput: "engine-consent" }, children: [{ type: "text", props: { content: "Generate a diagnostic profile before shipping." } }] },
										],
									},
									{ type: "button", props: { label: "Submit schema payload", type: "submit", variant: "solid", accentColor: "var(--e-rose)", size: "md" } },
								],
							},
						],
					},
				],
			},
		],
	},
});

export default createPage({
	schema: HomeSchema,
	slots: {
		inspectorPanel: (
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(3, 1fr)",
					gap: "0.75rem",
				}}
			>
				{["staticClass", "cprop", "slots"].map((label, index) => (
					<div
						key={label}
						style={{
							minHeight: "118px",
							borderRadius: "18px",
							padding: "1rem",
							background: index === 0 ? "#13b8a6" : index === 1 ? "#ef7d31" : "#4659d6",
							color: "white",
							boxShadow: "0 16px 34px rgba(35,32,26,0.14)",
							animation: `enginePulse ${2.6 + index * 0.3}s ease-in-out infinite`,
						}}
					>
						<div style={{ fontSize: "0.78rem", opacity: 0.75 }}>live module</div>
						<div style={{ marginTop: "0.4rem", fontWeight: 900 }}>{label}</div>
					</div>
				))}
			</div>
		),
	},
});
