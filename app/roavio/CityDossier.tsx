import { createComponent, defineSchema, type SchemaNode } from "@/engine";
import type { CityContent } from "./cityContent.server";
import { copyFor, type RoavioLocale } from "./i18n";
import { createFooterNode, createRoavioNav, roavioTheme } from "./theme";

function metricValue(value: string | number | boolean | null, locale: RoavioLocale, suffix = ""): string {
  if (value === null) return locale === "es" ? "Sin dato" : "Not captured";
  if (typeof value === "boolean") return value ? (locale === "es" ? "Sí" : "Yes") : "No";
  return `${value}${suffix}`;
}

function fitScore(city: CityContent): number | null {
  const { quality, safety, internet } = city.metrics;
  if (quality === null || safety === null || internet === null) return null;
  const internetScore = Math.min(internet / 40, 10);
  return Math.round((quality * 0.45 + safety * 0.3 + internetScore * 0.25) * 10) / 10;
}

function cleanInsight(value: string): string {
  return value
    .replace(/([\p{Ll}])([\p{Lu}])/gu, "$1 · $2")
    .replace(/([\p{L}])(?=\d)/gu, "$1 · ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function continentLabel(value: string, locale: RoavioLocale): string {
  const normalized = value.toLocaleLowerCase("es");
  const labels: Record<string, [string, string]> = {
    europe: ["Europa", "Europe"], europa: ["Europa", "Europe"],
    asia: ["Asia", "Asia"],
    africa: ["África", "Africa"], "áfrica": ["África", "Africa"],
    americas: ["América", "Americas"], america: ["América", "Americas"], "américa": ["América", "Americas"],
    "north america": ["Norteamérica", "North America"], "norteamérica": ["Norteamérica", "North America"], norteamerica: ["Norteamérica", "North America"],
    oceania: ["Oceanía", "Oceania"], "oceanía": ["Oceanía", "Oceania"],
    "middle east": ["Oriente Medio", "Middle East"], "oriente medio": ["Oriente Medio", "Middle East"],
  };
  const match = labels[normalized];
  return match ? match[locale === "es" ? 0 : 1] : value;
}

function insightColumn(title: string, tone: string, items: string[], fallback: string): SchemaNode {
  return {
    type: "box",
    props: { className: "rv-dossier-insight" },
    children: [
      { type: "text", props: { content: title, variant: "overline", color: tone, weight: 800 } },
      ...(items.length ? items.map(cleanInsight) : [fallback]).map((item) => ({
        type: "text",
        key: item,
        props: { content: `• ${item}`, size: ".8rem", lineHeight: 1.5, mt: ".42rem" },
      })),
    ],
  };
}

export function createCityDossier(city: CityContent, locale: RoavioLocale) {
  const es = locale === "es";
  const sourceCopy = copyFor(locale).sourceLanguage;
  const score = fitScore(city);
  const cityBackdrop = `/api/city-photo?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&slot=0&width=960&height=540&v=7`;
  const labels = {
    monthlyCost: es ? "Coste mensual" : "Monthly cost",
    internet: "Internet",
    safety: es ? "Seguridad" : "Safety",
    quality: es ? "Calidad de vida" : "Quality of life",
    beach: es ? "Playa" : "Beach",
    region: es ? "Región" : "Region",
    about: es ? `Sobre ${city.name}` : `About ${city.name}`,
    strengths: es ? "✓ PUNTOS FUERTES" : "✓ STRENGTHS",
    cautions: es ? "A TENER EN CUENTA" : "WORTH CONSIDERING",
    summary: es ? "Resumen" : "Summary",
    compare: es ? "Comparar con otra ciudad →" : "Compare with another city →",
    allCities: es ? "Ver todas las ciudades" : "See all cities",
    original: es ? "Abrir página original de Roavio ↗" : "Open original Roavio page ↗",
    guide: es ? "GUÍA" : "GUIDE",
    coreGuide: es ? "Guía principal capturada" : "Core guide captured",
    deepGuide: es ? "Guía profunda capturada" : "Deep guide captured",
    missingGuide: es ? "La guía editorial no estaba en el scrape suministrado" : "Editorial guide was not present in the supplied scrape",
    noStrengths: es ? "Sin puntos fuertes destacados en la ficha scrapeada." : "No standout strengths were captured in the scraped profile.",
    noCautions: es ? "Sin advertencias destacadas en la ficha scrapeada." : "No standout cautions were captured in the scraped profile.",
  };

  const stats = [
    [labels.monthlyCost, metricValue(city.metrics.cost, locale)],
    [labels.internet, metricValue(city.metrics.internet, locale, " Mbps")],
    [labels.safety, metricValue(city.metrics.safety, locale, "/10")],
    [labels.quality, metricValue(city.metrics.quality, locale, "/10")],
    [labels.beach, metricValue(city.metrics.beach, locale)],
    [labels.region, continentLabel(city.continent, locale)],
  ];

  const summaryRows = [
    [labels.monthlyCost, metricValue(city.metrics.cost, locale)],
    [labels.internet, metricValue(city.metrics.internet, locale, " Mbps")],
    [labels.safety, metricValue(city.metrics.safety, locale, "/10")],
    [labels.quality, metricValue(city.metrics.quality, locale, "/10")],
    [es ? "Encaje Roavio" : "Roavio fit", score === null ? "—" : `${score.toFixed(1)}/10`],
  ];

  const schema = defineSchema({
    meta: {
      title: es ? `${city.name}, ${city.country} para nómadas digitales · Roavio` : `${city.name}, ${city.country} for digital nomads · Roavio`,
      description: city.summary || (es ? `Datos y guía para trabajar en remoto desde ${city.name}.` : `Data and relocation context for working remotely from ${city.name}.`),
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: { className: "rv-dossier-page", bg: "var(--rv-paper)", color: "var(--rv-ink)", minH: "100svh" },
      children: [
        createRoavioNav(locale),
        {
          type: "section",
          props: {
            className: "rv-dossier-intro",
            contentMaxWidth: "1240px",
            px: "1rem",
            py: { xs: "1.2rem", md: "1.8rem" },
            style: {
              backgroundImage: `linear-gradient(90deg, rgba(7,17,14,.78), rgba(7,17,14,.48)), url("${cityBackdrop}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            },
          },
          children: [
            {
              type: "box",
              props: { className: "rv-dossier-hero" },
              children: [
                {
                  type: "box",
                  props: { className: "rv-dossier-hero__copy" },
                  children: [
                    { type: "text", props: { content: `${city.country} · ${continentLabel(city.continent, locale)}`, variant: "overline", color: "var(--rv-lime)", weight: 800 } },
                    { type: "heading", props: { level: 1, content: city.name, size: { xs: "2.65rem", md: "4rem" }, color: "#fff", lineHeight: .96, style: { margin: ".3rem 0 .55rem" } } },
                    ...(city.summary ? [{ type: "text", props: { content: city.summary, size: ".92rem", lineHeight: 1.6, maxW: "650px", color: "rgba(255,255,255,.92)" } } as SchemaNode] : []),
                  ],
                },
              ],
            },
            {
              type: "box",
              props: { className: "rv-dossier-metrics" },
              children: stats.map(([label, value]) => ({
                type: "box",
                key: label,
                props: { className: "rv-dossier-metric" },
                children: [
                  { type: "text", props: { content: label } },
                  { type: "text", props: { content: value, weight: 800 } },
                ],
              })),
            },
          ],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", pb: { xs: "2rem", md: "3rem" } },
          children: [
            {
              type: "box",
              props: { className: "rv-dossier-layout" },
              children: [
                {
                  type: "box",
                  props: { className: "rv-dossier-main" },
                  children: [
                    {
                      type: "box",
                      props: { className: "rv-dossier-section" },
                      children: [
                        { type: "heading", props: { level: 2, content: labels.about, size: "1.15rem", style: { margin: "0 0 .5rem" } } },
                        { type: "text", props: { content: city.summary || (es ? "Roavio no suministró un resumen editorial adicional para esta ficha." : "Roavio did not supply an additional editorial summary for this profile."), size: ".88rem", lineHeight: 1.65, color: "var(--rv-muted)" } },
                      ],
                    },
                    {
                      type: "box",
                      props: { className: "rv-dossier-insights" },
                      children: [
                        insightColumn(labels.strengths, "var(--rv-green)", city.strengths, labels.noStrengths),
                        insightColumn(labels.cautions, "var(--rv-peach)", city.considerations, labels.noCautions),
                      ],
                    },
                    city.editorialAvailable
                      ? {
                          type: "box",
                          props: { className: "rv-dossier-section" },
                          children: [
                            { type: "text", props: { content: labels.guide, variant: "overline", color: "var(--rv-green)", weight: 800 } },
                            ...(locale === "en" ? [{ type: "text", props: { content: sourceCopy, size: ".75rem", color: "var(--rv-muted)", lineHeight: 1.5, mt: ".25rem", mb: ".7rem" } } as SchemaNode] : []),
                            {
                              type: "markdown",
                              props: {
                                className: "rv-prose",
                                content: city.guide,
                                headingColor: "var(--rv-ink)",
                                textColor: "var(--rv-ink)",
                                linkColor: "var(--rv-green)",
                                bodyLineHeight: 1.72,
                                headingIdPrefix: city.slug,
                              },
                            },
                          ],
                        }
                      : {
                          type: "box",
                          props: { className: "rv-dossier-section" },
                          children: [
                            { type: "text", props: { content: labels.guide, variant: "overline", color: "var(--rv-green)", weight: 800 } },
                            { type: "heading", props: { level: 2, content: labels.missingGuide, size: "1.1rem", style: { margin: ".45rem 0" } } },
                            { type: "text", props: { content: sourceCopy, size: ".82rem", color: "var(--rv-muted)", lineHeight: 1.6 } },
                          ],
                        },
                  ],
                },
                {
                  type: "box",
                  props: { className: "rv-dossier-summary" },
                  children: [
                    { type: "text", props: { content: labels.summary.toUpperCase(), variant: "overline", color: "var(--rv-green)", weight: 800 } },
                    { type: "text", props: { content: city.hasDeepGuide ? labels.deepGuide : city.editorialAvailable ? labels.coreGuide : labels.missingGuide, weight: 800, mt: ".45rem" } },
                    {
                      type: "box",
                      props: { className: "rv-dossier-summary__rows" },
                      children: summaryRows.map(([label, value]) => ({
                        type: "box",
                        key: label,
                        props: { className: "rv-dossier-summary__row" },
                        children: [
                          { type: "text", props: { content: label } },
                          { type: "text", props: { content: value, weight: 800 } },
                        ],
                      })),
                    },
                    {
                      type: "box",
                      props: { className: "rv-dossier-summary__actions" },
                      children: [
                        { type: "button", props: { href: `/compare?cities=${city.slug}`, label: labels.compare, variant: "elevated", accentColor: "var(--rv-ink)" } },
                        { type: "button", props: { href: "/cities", label: labels.allCities, variant: "outline", accentColor: "var(--rv-ink)" } },
                        ...(city.sourceUrl ? [{ type: "link", props: { href: city.sourceUrl, target: "_blank", content: labels.original, color: "var(--rv-green)", weight: 800, size: ".76rem", mt: ".3rem" } } as SchemaNode] : []),
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        createFooterNode(locale),
      ],
    },
  });

  return createComponent({
    schema,
    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },
  });
}
