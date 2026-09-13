import { createPage, defineSchema } from "@/engine";
import { Explorer } from "../roavio/Explorer";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { copyFor, type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createCitiesSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).cities;
  return defineSchema({
    meta: { title: locale === "es" ? "Explora ciudades nómadas · Roavio" : "Explore nomad cities · Roavio", description: copy.subtitle },
    theme: roavioTheme,
    root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
      createRoavioNav(locale),
      { type: "section", props: { className: "rv-explore-directory-section", contentMaxWidth: "1240px", px: "1rem", py: { xs: "1.4rem", md: "2rem" } }, children: [
        { type: "slot", props: { name: "explorer" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function CitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const [catalog, locale, params] = await Promise.all([
    loadCityCatalog(),
    getRoavioLocale(),
    searchParams,
  ]);
  const rawSearch = params.search;
  const initialSearch = Array.isArray(rawSearch) ? (rawSearch[0] ?? "") : (rawSearch ?? "");
  const Page = createPage({
    schema: createCitiesSchema(locale),
    slots: { explorer: <Explorer catalog={catalog} locale={locale} initialSearch={initialSearch} /> },
    compiler: { pageId: "roavio-cities", serverFirst: true },
  });
  return <Page />;
}
