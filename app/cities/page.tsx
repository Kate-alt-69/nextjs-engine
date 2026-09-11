import { createPage, defineSchema } from "@/engine";
import { Explorer } from "../roavio/ClientWidgets";
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
      { type: "section", props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } }, children: [
        { type: "grid", props: { columns: { xs: 1, md: "1.2fr .8fr" }, gap: "2rem", align: "end", mb: "1.4rem" }, children: [
          { type: "stack", props: { direction: "vertical", gap: ".7rem" }, children: [
            { type: "text", props: { content: copy.eyebrow, variant: "overline", color: "var(--rv-green)", weight: 800 } },
            { type: "heading", props: { level: 1, content: copy.title, size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: 0 } } },
            { type: "text", props: { content: copy.subtitle, color: "var(--rv-muted)", lineHeight: 1.65, maxW: "720px" } },
          ] },
          { type: "box", props: { className: "rv-soft", p: "1rem" }, children: [
            { type: "text", props: { content: locale === "es" ? "90 destinos mapeados" : "90 mapped destinations", weight: 800 } },
            { type: "text", props: { content: locale === "es" ? "El directorio y cada dossier leen del mismo catálogo. Añadir una ciudad ya no significa escribir otra página React." : "The directory and every dossier read from one catalog. Adding another city no longer means writing another React page.", size: ".82rem", color: "var(--rv-muted)", lineHeight: 1.55, mt: ".35rem" } },
          ] },
        ] },
        { type: "slot", props: { name: "explorer" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function CitiesPage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({ schema: createCitiesSchema(locale), slots: { explorer: <Explorer catalog={catalog} locale={locale} /> }, compiler: { pageId: "roavio-cities", serverFirst: true } });
  return <Page />;
}
