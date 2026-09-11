import { createPage, defineSchema } from "@/engine";
import { CompareBoard } from "../roavio/ClientWidgets";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { copyFor, type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createCompareSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).compare;
  return defineSchema({
    meta: { title: locale === "es" ? "Comparar ciudades · Roavio" : "Compare cities · Roavio", description: copy.subtitle },
    theme: roavioTheme,
    root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
      createRoavioNav(locale),
      { type: "section", props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1.5rem", md: "2.2rem" } }, children: [
        { type: "box", props: { className: "rv-compare-intro", mb: "1rem" }, children: [
          { type: "grid", props: { columns: { xs: 1, md: "1.35fr .65fr" }, gap: "1.2rem", align: "center" }, children: [
            { type: "stack", props: { direction: "vertical", gap: ".5rem" }, children: [
              { type: "text", props: { content: copy.eyebrow, variant: "overline", color: "var(--rv-green)", weight: 800 } },
              { type: "heading", props: { level: 1, content: copy.title, size: { xs: "2.35rem", md: "3.55rem" }, lineHeight: .98, style: { margin: 0, maxWidth: "760px" } } },
              { type: "text", props: { content: copy.subtitle, color: "var(--rv-muted)", lineHeight: 1.55, maxW: "760px", size: ".9rem" } },
            ] },
            { type: "box", props: { className: "rv-compare-intro__aside" }, children: [
              { type: "text", props: { content: copy.visualEyebrow, variant: "overline", color: "var(--rv-green)", weight: 800 } },
              { type: "heading", props: { level: 2, content: copy.visualTitle, className: "rv-display-serif", size: { xs: "1.55rem", md: "1.95rem" }, style: { margin: ".35rem 0 .25rem" } } },
              { type: "text", props: { content: copy.visualBody, color: "var(--rv-muted)", size: ".78rem", lineHeight: 1.5 } },
            ] },
          ] },
        ] },
        { type: "slot", props: { name: "compare-board" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function ComparePage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({ schema: createCompareSchema(locale), slots: { "compare-board": <CompareBoard catalog={catalog} locale={locale} /> }, compiler: { pageId: "roavio-compare", serverFirst: true } });
  return <Page />;
}
