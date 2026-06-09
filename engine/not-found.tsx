"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Default 404 Page
//
//  Fallback 404 page built with the engine itself.
//  Used when the consuming app has no app/not-found.tsx of its own.
//
//  Design:
//    · Full black background
//    · Big sad emoji centred at the top of the content block
//    · Message text beneath it
//    · "come back home" link
//    · Subtle footer credit using the new TextPart inline-link feature
// ─────────────────────────────────────────────────────────────────────────────

import { createPage, defineSchema } from "./index";

const NotFoundSchema = defineSchema({
	meta: {
		title: "404 — Page Not Found",
		description: "The page you're looking for doesn't exist.",
	},
	theme: {
		vars: {
			"--e-accent": "#ffffff",
			"--e-bg":     "#000000",
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap",
		],
		globalStyles: `
			*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
			html, body { background: #000000; }
			body { font-family: 'Inter', system-ui, sans-serif; }
		`,
	},
	root: {
		type: "box",
		props: {
			display:  "flex",
			flexDir:  "column",
			align:    "center",
			justify:  "center",
			minH:     "100svh",
			bg:       "#000000",
			position: "relative",
			px:       "2rem",
		},
		children: [

			// ── Main content block ────────────────────────────────────────────────
			{
				type: "stack",
				props: {
					direction: "vertical",
					gap:       "1.5rem",
					align:     "center",
					style:     { textAlign: "center", maxWidth: "560px" },
				},
				children: [

					// Big sad emoji
					{
						type: "text",
						props: {
							as:      "span",
							content: "😔",
							style: {
								fontSize:   "9rem",
								lineHeight: "1",
								userSelect: "none",
								display:    "block",
							},
						},
					},

					// Message
					{
						type: "text",
						props: {
							variant: "lead",
							content: "the page you thought existed doesn't actually exist!! i guess..",
							color:   "#ffffff",
							align:   "center",
						},
					},

					// Come back home link
					{
						type: "button",
						props: {
							variant:     "ghost",
							href:        "/",
							label:       "come back home",
							accentColor: "#888888",
							style: {
								borderBottom:  "1px solid #333333",
								borderRadius:  0,
								padding:       "0 0 3px 0",
								letterSpacing: "0.025em",
								fontSize:      "0.9rem",
								fontWeight:    600,
							},
						},
					},

				],
			},

			// ── Footer credit ─────────────────────────────────────────────────────
			//  Small and dark — there if you look for it, invisible if you don't.
			//  Uses TextPart to embed the Kastrick hyperlink inline without
			//  wrapping the whole line in an <a>.
			{
				type: "text",
				props: {
					as:       "p",
					position: "absolute",
					bottom:   "1.75rem",
					left:     0,
					right:    0,
					parts: [
						{ text: "this website was made with love and with " },
						{
							text:   "Kastrick",
							href:   "https://kastricks.com",
							target: "_blank",
							style: {
								color:          "#3d3d3d",
								textDecoration: "none",
								borderBottom:   "1px solid #2a2a2a",
								paddingBottom:  "1px",
							},
						},
					],
					style: {
						textAlign:     "center",
						fontSize:      "0.6rem",
						color:         "#2a2a2a",
						letterSpacing: "0.05em",
						userSelect:    "none",
					},
				},
			},

		],
	},
});

export default createPage({ schema: NotFoundSchema });
