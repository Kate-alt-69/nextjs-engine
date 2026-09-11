import { createPage, defineSchema } from "@/engine";
import { FavoritesBoard } from "../roavio/ClientWidgets";
import { footerNode, roavioNav, roavioTheme } from "../roavio/theme";

const FavoritesSchema = defineSchema({
  meta: {
    title: "Favorites · Roavio",
    description: "Your saved nomad destinations."
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
          { type: "text", props: { content: "SHORTLIST", variant: "overline", color: "var(--rv-green)", weight: 800 } },
          { type: "heading", props: { level: 1, content: "Cities you want to remember.", size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: ".7rem 0 .8rem" } } },
          { type: "text", props: { content: "The proposal works without an account first, then Roavio can sync this shortlist to the user's existing account system when they sign in.", color: "var(--rv-muted)", lineHeight: 1.65, maxW: "760px", mb: "1.5rem" } },
          { type: "slot", props: { name: "favorites-board" } }
        ]
      },
      footerNode
    ]
  }
});

export default createPage({
  schema: FavoritesSchema,
  slots: { "favorites-board": <FavoritesBoard /> },
  compiler: { pageId: "roavio-favorites", serverFirst: true }
});
