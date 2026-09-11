import { createPage, defineSchema } from "@/engine";
import { FavoritesBoard } from "../roavio/ClientWidgets";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { copyFor, type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createFavoritesSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).favorites;
  return defineSchema({
    meta: { title: locale === "es" ? "Favoritos · Roavio" : "Favorites · Roavio", description: copy.subtitle },
    theme: roavioTheme,
    root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
      createRoavioNav(locale),
      { type: "section", props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } }, children: [
        { type: "text", props: { content: copy.eyebrow, variant: "overline", color: "var(--rv-green)", weight: 800 } },
        { type: "heading", props: { level: 1, content: copy.title, size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: ".7rem 0 .8rem" } } },
        { type: "text", props: { content: copy.subtitle, color: "var(--rv-muted)", lineHeight: 1.65, maxW: "760px", mb: "1.5rem" } },
        { type: "slot", props: { name: "favorites-board" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function FavoritesPage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({ schema: createFavoritesSchema(locale), slots: { "favorites-board": <FavoritesBoard catalog={catalog} locale={locale} /> }, compiler: { pageId: "roavio-favorites", serverFirst: true } });
  return <Page />;
}
