import { createPage, defineSchema } from "@/engine";
import { CompareBoard } from "../roavio/ClientWidgets";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createCompareSchema(locale: RoavioLocale) {
  return defineSchema({
    meta: {
      title: locale === "es" ? "Comparar ciudades · Roavio" : "Compare cities · Roavio",
      description: locale === "es" ? "Compara hasta tres destinos de Roavio." : "Compare up to three Roavio destinations.",
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: { bg: "var(--rv-paper)", minH: "100svh" },
      children: [
        createRoavioNav(locale),
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1rem", md: "1.35rem" } },
          children: [{ type: "slot", props: { name: "compare-board" } }],
        },
        createFooterNode(locale),
      ],
    },
  });
}

export default async function ComparePage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({
    schema: createCompareSchema(locale),
    slots: { "compare-board": <CompareBoard catalog={catalog} locale={locale} /> },
    compiler: { pageId: "roavio-compare", serverFirst: true },
  });
  return <Page />;
}
