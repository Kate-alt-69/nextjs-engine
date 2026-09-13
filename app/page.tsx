import { createPage, defineSchema, type SchemaNode } from "@/engine";
import { CityShowcase } from "./roavio/CityShowcase";
import { HeroSearch } from "./roavio/ClientWidgets";
import { loadCityCatalogForSlugs } from "./roavio/cityContent.server";
import { HOME_CITY_SLUGS } from "./roavio/homeCities";
import { HomeHeroDeck } from "./roavio/HomeHeroDeck";
import { copyFor, type RoavioLocale } from "./roavio/i18n";
import { getRoavioLocale } from "./roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "./roavio/theme";

function revealProps(index: number) {
  return {
    effect: "pop",
    replay: true,
    renderMargin: 1200,
    motionMargin: 120,
    duration: 330,
    delay: Math.min(index % 4, 3) * 18,
    scaleFrom: 0.86,
    overshoot: 1.018,
    releaseWhenFar: true,
  };
}

function statCards(locale: RoavioLocale): SchemaNode[] {
  const es = locale === "es";
  const stats = [
    ["95", es ? "ciudades mapeadas" : "mapped cities", "var(--rv-lime)"],
    ["407 Mbps", es ? "conexión más rápida" : "fastest connection", "var(--rv-blue)"],
    ["8.9/10", es ? "mejor seguridad" : "top safety score", "var(--rv-peach)"],
    ["6", es ? "continentes" : "continents", "var(--rv-yellow)"],
  ] as const;

  return stats.map(([value, label, accent], index) => ({
    type: "reveal",
    key: label,
    props: revealProps(index),
    children: [{
      type: "card",
      props: { variant: "flat", innerPadding: "1rem", bg: "var(--rv-card)", border: "1px solid var(--rv-line)", borderRadius: "20px", style: { height: "100%" } },
      children: [
        { type: "box", props: { w: "2rem", h: ".35rem", borderRadius: "99px", bg: accent } },
        { type: "text", props: { content: value, size: { xs: "1.55rem", md: "2rem" }, weight: 800, mt: ".8rem", fontFamily: "Manrope" } },
        { type: "text", props: { content: label, size: ".78rem", color: "var(--rv-muted)" } },
      ],
    }],
  }));
}

function decisionCards(locale: RoavioLocale): SchemaNode[] {
  const es = locale === "es";
  const cards = [
    ["01", es ? "Elige lo que importa" : "Choose what matters", es ? "Presupuesto, seguridad, velocidad, playa y calidad siguen filtrables." : "Budget, safety, speed, beach and quality stay filterable."],
    ["02", es ? "Compara con contexto" : "Compare in context", es ? "Hasta tres destinos con ganadores por métrica." : "Up to three destinations with metric winners."],
    ["03", es ? "Lee menos, entiende más" : "Read less, know more", es ? "Las guías largas se convierten en dossiers navegables." : "Long guides become navigable dossiers."],
    ["04", es ? "Confía en los números" : "Trust the numbers", es ? "Los datos ausentes no se rellenan con ficción." : "Missing data stays missing instead of becoming fiction."],
  ] as const;

  return cards.map(([number, title, body], index) => ({
    type: "reveal",
    key: number,
    props: revealProps(index),
    children: [{
      type: "card",
      props: { variant: "flat", innerPadding: "1rem", bg: "var(--rv-card)", border: "1px solid var(--rv-line)", borderRadius: "20px", style: { height: "100%" } },
      children: [
        { type: "text", props: { content: number, variant: "overline", color: "var(--rv-green)", weight: 800 } },
        { type: "text", props: { content: title, size: "1.05rem", weight: 800, mt: ".65rem", fontFamily: "Manrope" } },
        { type: "text", props: { content: body, size: ".82rem", color: "var(--rv-muted)", lineHeight: 1.6, mt: ".4rem" } },
      ],
    }],
  }));
}

function createHomeSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).home;
  const es = locale === "es";
  const stats = statCards(locale);
  const decisions = decisionCards(locale);

  return defineSchema({
    meta: {
      title: es ? "Roavio — Encuentra tu próxima ciudad nómada" : "Roavio — Find your next nomad city",
      description: copy.subtitle,
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: { display: "flex", flexDir: "column", bg: "var(--rv-paper)", color: "var(--rv-ink)" },
      children: [
        createRoavioNav(locale),
        {
          type: "hero",
          props: { variant: "split", fullViewport: false, contentMaxWidth: "1240px", px: "1rem", py: { xs: "3.4rem", md: "5rem" }, style: { alignItems: "center" } },
          children: [
            {
              type: "stack",
              props: { direction: "vertical", gap: "1.35rem", align: "flex-start", justify: "center" },
              children: [
                { type: "text", props: { as: "span", className: "rv-kicker", content: `● ${copy.kicker}` } },
                { type: "heading", props: { level: 1, content: copy.title, size: { xs: "3rem", md: "5rem" }, lineHeight: .93, className: "rv-display-serif", style: { margin: 0, maxWidth: "790px" } } },
                { type: "text", props: { content: copy.subtitle, size: { xs: "1rem", md: "1.08rem" }, color: "var(--rv-muted)", lineHeight: 1.7, maxW: "720px" } },
                { type: "slot", props: { name: "hero-search" } },
                { type: "stack", props: { direction: "horizontal", gap: ".7rem", wrap: true }, children: [
                  { type: "text", props: { content: es ? "Sin paywall para explorar" : "No paywall to explore", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "•", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: es ? "Fuentes visibles" : "Sources stay visible", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: "•", size: ".78rem", color: "var(--rv-muted)" } },
                  { type: "text", props: { content: es ? "Compara antes de decidir" : "Compare before you commit", size: ".78rem", color: "var(--rv-muted)" } },
                ] },
              ],
            },
            {
              type: "box",
              props: { className: "rv-hero-art" },
              children: [{ type: "slot", props: { name: "hero-deck" } }],
            },
          ],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1rem", md: "2rem" } },
          children: [{ type: "grid", props: { columns: { xs: 2, md: 4 }, gap: ".8rem" }, children: stats }],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } },
          children: [
            { type: "stack", props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", align: "flex-end", gap: "1rem", mb: "1.5rem" }, children: [
              { type: "stack", props: { direction: "vertical", gap: ".45rem" }, children: [
                { type: "text", props: { content: es ? "POPULAR + ALTA CALIDAD DE VIDA" : "POPULAR + HIGH-QOL PICKS", variant: "overline", color: "var(--rv-green)", weight: 800, fontFamily: "Manrope" } },
                { type: "heading", props: { level: 2, content: es ? "Treinta ciudades en movimiento." : "Thirty cities, moving with you.", size: { xs: "2rem", md: "3rem" }, className: "rv-home-section-title", style: { margin: 0 } } },
                { type: "text", props: { content: es ? "Déjala moverse o agárrala y desplázala tú. Al soltarla, la selección sigue viajando." : "Let it drift or grab the rail and scroll it yourself. Release it and the city stream keeps moving.", color: "var(--rv-muted)", maxW: "680px", lineHeight: 1.6 } },
              ] },
              { type: "button", props: { href: "/cities", label: es ? "Ver las 95 ciudades →" : "Explore all 95 cities →", variant: "outline", accentColor: "var(--rv-ink)" } },
            ] },
            { type: "slot", props: { name: "city-showcase" } },
          ],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "3rem", md: "4.5rem" } },
          children: [{
            type: "grid",
            props: { columns: { xs: 1, md: 2 }, gap: "1rem" },
            children: [
              {
                type: "reveal",
                props: { ...revealProps(0), renderMargin: 900 },
                children: [{
                  type: "card",
                  props: { variant: "flat", innerPadding: "1.5rem", bg: "var(--rv-ink)", color: "var(--rv-paper)", borderRadius: "26px", style: { minHeight: "320px", height: "100%" } },
                  children: [
                    { type: "text", props: { content: "DECISION LAYER", variant: "overline", color: "var(--rv-lime)", weight: 800, fontFamily: "Manrope" } },
                    { type: "heading", props: { level: 2, content: es ? "Los rankings explican por qué, no solo quién gana." : "Rankings explain why — not just who won.", size: { xs: "2rem", md: "2.8rem" }, color: "#f3faf6", className: "rv-display-serif", style: { margin: ".8rem 0" } } },
                    { type: "text", props: { content: es ? "El encaje Roavio combina señales útiles mientras las métricas originales siguen visibles y comparables." : "Roavio Fit combines useful signals while the original source metrics stay visible and comparable.", color: "var(--rv-muted)", lineHeight: 1.7 } },
                    { type: "button", props: { href: "/compare", label: es ? "Abrir comparación" : "Open comparison", variant: "elevated", accentColor: "var(--rv-lime)", color: "#10231f", mt: "1.4rem" } },
                  ],
                }],
              },
              { type: "grid", props: { columns: 2, gap: ".8rem" }, children: decisions },
            ],
          }],
        },
        createFooterNode(locale),
      ],
    },
  });
}

export default async function HomePage() {
  const [catalog, locale] = await Promise.all([loadCityCatalogForSlugs(HOME_CITY_SLUGS), getRoavioLocale()]);
  const Page = createPage({
    schema: createHomeSchema(locale),
    slots: {
      "hero-search": <HeroSearch locale={locale} />,
      "hero-deck": <HomeHeroDeck catalog={catalog} locale={locale} />,
      "city-showcase": <CityShowcase catalog={catalog} locale={locale} />,
    },
    compiler: { pageId: "roavio-home", serverFirst: true },
  });
  return <Page />;
}
