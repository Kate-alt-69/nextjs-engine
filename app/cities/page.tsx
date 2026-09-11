import { createPage, defineSchema } from "@/engine";
import { Explorer } from "../roavio/ClientWidgets";
import { footerNode, roavioNav, roavioTheme } from "../roavio/theme";

const CitiesSchema = defineSchema({
  meta: {
    title: "Explore nomad cities · Roavio",
    description: "Filter and compare remote-work destinations by quality of life, safety, internet and location."
  },
  theme: roavioTheme,
  root: {
    type: "box",
    props: { bg: "var(--rv-paper)", minH: "100svh" },
    children: [
      roavioNav,
      {
        type: "section",
        props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } },
        children: [
          {
            type: "grid",
            props: { columns: { xs: 1, md: "1.2fr .8fr" }, gap: "2rem", align: "end", mb: "1.4rem" },
            children: [
              {
                type: "stack",
                props: { direction: "vertical", gap: ".7rem" },
                children: [
                  { type: "text", props: { content: "EXPLORE", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                  { type: "heading", props: { level: 1, content: "Find the place that matches the way you work.", size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: 0 } } },
                  { type: "text", props: { content: "Search once, filter fast, save the interesting ones and keep your compare tray with you.", color: "var(--rv-muted)", lineHeight: 1.65, maxW: "720px" } }
                ]
              },
              {
                type: "box",
                props: { className: "rv-soft", p: "1rem" },
                children: [
                  { type: "text", props: { content: "Better than a giant list", weight: 800 } },
                  { type: "text", props: { content: "The proposal keeps Roavio's raw metrics but adds a decision layer, shortlist state and persistent compare flow.", size: ".82rem", color: "var(--rv-muted)", lineHeight: 1.55, mt: ".35rem" } }
                ]
              }
            ]
          },
          { type: "slot", props: { name: "explorer" } }
        ]
      },
      footerNode
    ]
  }
});

export default createPage({
  schema: CitiesSchema,
  slots: { explorer: <Explorer /> },
  compiler: { pageId: "roavio-cities", serverFirst: true }
});
