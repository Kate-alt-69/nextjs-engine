import { createPage, defineSchema } from "@/engine";
import { MatchQuiz } from "../roavio/MatchQuiz";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { copyFor, type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createMatchSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).match;
  return defineSchema({
    meta: { title: `${copy.title} · Roavio`, description: copy.subtitle },
    theme: roavioTheme,
    root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
      createRoavioNav(locale),
      { type: "section", props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4rem" } }, children: [
        { type: "text", props: { content: copy.eyebrow, variant: "overline", color: "var(--rv-green)", weight: 800 } },
        { type: "heading", props: { level: 1, content: copy.title, size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: ".7rem 0 .8rem", maxWidth: "900px" } } },
        { type: "text", props: { content: copy.subtitle, color: "var(--rv-muted)", lineHeight: 1.65, maxW: "760px", mb: "1.5rem" } },
        { type: "slot", props: { name: "match-quiz" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function MatchPage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({ schema: createMatchSchema(locale), slots: { "match-quiz": <MatchQuiz catalog={catalog} locale={locale} /> }, compiler: { pageId: "roavio-match", serverFirst: true } });
  return <Page />;
}
