import { createPage, defineSchema } from "@/engine";
import { CityShowcase } from "./roavio/CityShowcase";
import { HeroSearch } from "./roavio/ClientWidgets";
import { footerNode, roavioNav, roavioTheme } from "./roavio/theme";

const HomeSchema = defineSchema({
  meta: {
    title: "Roavio — Find the city that fits your life",
    description: "Compare cost, connectivity, safety, quality of life and nomad essentials across global destinations."
  },
  theme: roavioTheme,
  root: {
    type: "box",
    props: { display: "flex", flexDir: "column", bg: "var(--rv-paper)", color: "var(--rv-ink)" },
    children: [
      roavioNav,
      {
        type: "hero",
        props: {
          variant: "split",
          fullViewport: false,
          contentMaxWidth: "1240px",
          px: "1rem",
          py: { xs: "3.4rem", md: "5rem" },
          style: { alignItems: "center" }
        },
        children: [
          {
            type: "stack",
            props: { direction: "vertical", gap: "1.35rem", align: "flex-start", justify: "center" },
            children: [
              { type: "text", props: { as: "span", className: "rv-kicker", content: "● 80 cities · 6 continents · data updated 2026" } },
              {
                type: "heading",
                props: {
                  level: 1,
                  content: "Your next city should fit your life — not the other way around.",
                  subheading: "Roavio turns cost, internet, safety, quality of life, climate and relocation data into a decision you can actually make.",
                  size: { xs: "2.8rem", md: "4.55rem" },
                  lineHeight: .98,
                  style: { margin: 0, maxWidth: "760px" }
                }
              },
              { type: "slot", props: { name: "hero-search" } },
              {
                type: "stack",
                props: { direction: "horizontal", gap: ".7rem", wrap: true },
                children: [
                  { type: "text", props: { content: "No paywall to explore", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "•", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "Sources stay visible", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "•", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "Compare before you commit", size: ".78rem", color: "var(--rv-muted)" } }
                ]
              }
            ]
          },
          {
            type: "box",
            props: { className: "rv-hero-art" },
            children: [
              { type: "box", props: { className: "rv-hero-map", "aria-hidden": true } },
              {
                type: "box",
                props: { className: "rv-floating-card rv-float-a" },
                children: [
                  { type: "text", props: { content: "Valencia", weight: 800 } },
                  { type: "text", props: { content: "9.1 quality · 263 Mbps" } }
                ]
              },
              {
                type: "box",
                props: { className: "rv-floating-card rv-float-b" },
                children: [
                  { type: "text", props: { content: "Chiang Mai", weight: 800 } },
                  { type: "text", props: { content: "EUR 472/mo · 7.8 safety" } }
                ]
              },
              {
                type: "box",
                props: { className: "rv-floating-card rv-float-c" },
                children: [
                  { type: "text", props: { content: "Singapore", weight: 800 } },
                  { type: "text", props: { content: "407 Mbps · top connectivity" } }
                ]
              }
            ]
          }
        ]
      },
      {
        type: "section",
        props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1rem", md: "2rem" } },
        children: [
          {
            type: "grid",
            props: { columns: { xs: 2, md: 4 }, gap: ".8rem" },
            children: [
              ["80", "indexed cities", "var(--rv-lime)"],
              ["407 Mbps", "fastest connection", "var(--rv-blue)"],
              ["8.9/10", "top safety score", "var(--rv-peach)"],
              ["6", "continents", "var(--rv-yellow)"]
            ].map(([value, label, accent]) => ({
              type: "card",
              key: label,
              props: { variant: "flat", innerPadding: "1rem", bg: "var(--rv-card)", border: "1px solid var(--rv-line)", borderRadius: "20px" },
              children: [
                { type: "box", props: { w: "2rem", h: ".35rem", borderRadius: "99px", bg: accent } },
                { type: "text", props: { content: value, size: { xs: "1.55rem", md: "2rem" }, weight: 800, mt: ".8rem", fontFamily: "Manrope" } },
                { type: "text", props: { content: label, size: ".78rem", color: "var(--rv-muted)" } }
              ]
            }))
          }
        ]
      },
      {
        type: "section",
        props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3.2rem", md: "5rem" } },
        children: [
          {
            type: "stack",
            props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", align: "flex-end", gap: "1rem", mb: "1.5rem" },
            children: [
              {
                type: "stack",
                props: { direction: "vertical", gap: ".45rem" },
                children: [
                  { type: "text", props: { content: "CURATED STARTING POINTS", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                  { type: "heading", props: { level: 2, content: "Cities worth opening first.", size: { xs: "2rem", md: "3rem" }, style: { margin: 0 } } },
                  { type: "text", props: { content: "Not just a list — each card gives you the decision signals before you click.", color: "var(--rv-muted)" } }
                ]
              },
              { type: "button", props: { href: "/cities", label: "Explore all cities →", variant: "outline", accentColor: "var(--rv-ink)" } }
            ]
          },
          { type: "slot", props: { name: "city-showcase" } }
        ]
      },
      {
        type: "section",
        props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3.2rem", md: "5rem" } },
        children: [
          {
            type: "grid",
            props: { columns: { xs: 1, md: 2 }, gap: "1rem" },
            children: [
              {
                type: "card",
                props: { variant: "flat", innerPadding: "1.5rem", bg: "var(--rv-ink)", color: "white", borderRadius: "26px", style: { minHeight: "330px" } },
                children: [
                  { type: "text", props: { content: "DECISION LAYER", variant: "overline", color: "var(--rv-lime)", weight: 800 } },
                  { type: "heading", props: { level: 2, content: "Rankings explain why — not just who won.", size: { xs: "2rem", md: "2.8rem" }, color: "white", style: { margin: ".8rem 0" } } },
                  { type: "text", props: { content: "Roavio Fit combines the signals a remote worker actually cares about, while the raw source metrics stay visible beside it.", color: "rgba(255,255,255,.72)", lineHeight: 1.7 } },
                  { type: "button", props: { href: "/compare", label: "Open side-by-side compare", variant: "elevated", accentColor: "var(--rv-lime)", color: "var(--rv-ink)", mt: "1.4rem" } }
                ]
              },
              {
                type: "grid",
                props: { columns: 2, gap: ".8rem" },
                children: [
                  ["01", "Choose what matters", "Budget, safety, speed, beach, climate and quality of life stay filterable instead of disappearing inside one score."],
                  ["02", "Compare in context", "Keep up to three cities in a persistent tray and see the winner for each metric instantly."],
                  ["03", "Read less, know more", "Long relocation guides become a structured dossier: strengths, friction, visa/tax, healthcare, areas and sources."],
                  ["04", "Trust the numbers", "Source and update context remains attached to each metric instead of being buried in a footer."]
                ].map(([number, title, body]) => ({
                  type: "card",
                  key: number,
                  props: { variant: "flat", innerPadding: "1rem", bg: "var(--rv-card)", border: "1px solid var(--rv-line)", borderRadius: "20px" },
                  children: [
                    { type: "text", props: { content: number, variant: "overline", color: "var(--rv-green)", weight: 800 } },
                    { type: "text", props: { content: title, size: "1.05rem", weight: 800, mt: ".65rem" } },
                    { type: "text", props: { content: body, size: ".82rem", color: "var(--rv-muted)", lineHeight: 1.6, mt: ".4rem" } }
                  ]
                }))
              }
            ]
          }
        ]
      },
      {
        type: "section",
        props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4rem" } },
        children: [
          {
            type: "box",
            props: { className: "rv-panel", p: { xs: "1.4rem", md: "2.2rem" }, bg: "linear-gradient(120deg,#fffdf8,#eef2df)" },
            children: [
              { type: "text", props: { content: "OPEN DATA, USEFUL PRODUCT", variant: "overline", color: "var(--rv-green)", weight: 800 } },
              { type: "heading", props: { level: 2, content: "Numbeo + Ookla + official guidance, presented like a product instead of a spreadsheet.", size: { xs: "1.9rem", md: "2.8rem" }, style: { maxWidth: "900px", margin: ".8rem 0" } } },
              { type: "text", props: { content: "Keep Roavio's existing public/local data integrations. Upgrade the information architecture, rendering path and interaction model around them.", color: "var(--rv-muted)", lineHeight: 1.65 } }
            ]
          }
        ]
      },
      footerNode
    ]
  }
});

export default createPage({
  schema: HomeSchema,
  slots: {
    "hero-search": <HeroSearch />,
    "city-showcase": <CityShowcase />
  },
  compiler: { pageId: "roavio-home", serverFirst: true }
});
