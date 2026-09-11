import { createPage, defineSchema } from "@/engine";
import { MatchQuiz } from "../roavio/MatchQuiz";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { footerNode, roavioNav, roavioTheme } from "../roavio/theme";

const MatchSchema = defineSchema({
  meta: { title: "¿Cuál es tu ciudad nómada ideal? · Roavio", description: "Responde 4 preguntas rápidas y descubre qué destinos encajan mejor contigo." },
  theme: roavioTheme,
  root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
    roavioNav,
    { type: "section", props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } }, children: [
      { type: "text", props: { content: "CITY MATCH", variant: "overline", color: "var(--rv-green)", weight: 800 } },
      { type: "heading", props: { level: 1, content: "¿Cuál es tu ciudad nómada ideal?", size: { xs: "2.5rem", md: "4rem" }, lineHeight: 1, style: { margin: ".7rem 0 .8rem", maxWidth: "900px" } } },
      { type: "text", props: { content: "Responde 4 preguntas rápidas y te mostramos qué ciudades encajan mejor contigo usando el mismo catálogo estructurado del explorador.", color: "var(--rv-muted)", lineHeight: 1.65, maxW: "760px", mb: "1.5rem" } },
      { type: "slot", props: { name: "match-quiz" } },
    ] },
    footerNode,
  ] },
});

export default async function MatchPage() {
  const catalog = await loadCityCatalog();
  const Page = createPage({ schema: MatchSchema, slots: { "match-quiz": <MatchQuiz catalog={catalog} /> }, compiler: { pageId: "roavio-match", serverFirst: true } });
  return <Page />;
}
