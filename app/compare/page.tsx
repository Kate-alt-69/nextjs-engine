import { createPage, defineSchema } from "@/engine";
import { CompareBoard } from "../roavio/ClientWidgets";
import { footerNode, roavioNav, roavioTheme } from "../roavio/theme";

const CompareSchema = defineSchema({
  meta: {
    title: "Compare cities · Roavio",
    description: "Compare up to three nomad destinations side by side."
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
          { type: "text", props: { content: "COMPARE", variant: "overline", color: "var(--rv-green)", weight: 800 } },
          { type: "heading", props: { level: 1, content: "Three cities. One decision surface.", size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: ".7rem 0 .8rem", maxWidth: "850px" } } },
          { type: "text", props: { content: "Swap any destination instantly. The best value in each metric is highlighted instead of making you scan a wall of numbers.", color: "var(--rv-muted)", lineHeight: 1.65, maxW: "760px", mb: "1.5rem" } },
          { type: "slot", props: { name: "compare-board" } }
        ]
      },
      footerNode
    ]
  }
});

export default createPage({
  schema: CompareSchema,
  slots: { "compare-board": <CompareBoard /> },
  compiler: { pageId: "roavio-compare", serverFirst: true }
});
