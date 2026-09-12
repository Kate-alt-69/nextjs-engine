import { createComponent, defineSchema, type SchemaNode } from "@/engine";
import type { CityContent } from "./cityContent.server";
import type { RoavioLocale } from "./i18n";
import { createRoavioNav, roavioTheme } from "./theme";
import { CityThumb } from "./CityThumb";
import { CityDossierBackdrop } from "./CityDossierBackdrop";

function metricValue(value: string | number | boolean | null, locale: RoavioLocale, suffix = ""): string {
  if (value === null) return locale === "es" ? "Sin dato" : "Not available";
  if (typeof value === "boolean") return value ? (locale === "es" ? "Sí" : "Yes") : "No";
  return `${value}${suffix}`;
}

function localCurrency(cost: string | null): string {
  if (!cost) return "—";
  const match = cost.trim().match(/^([A-Z]{3})\b/);
  return match?.[1] ?? "—";
}

function monthlyCostSummary(cost: string | null): string {
  if (!cost) return "—";
  return cost.replace(/\/mo$/i, "");
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

function officialCityFooter(locale: RoavioLocale): SchemaNode {
  const es = locale === "es";
  return {
    type: "section",
    props: {
      className: "rv-official-footer",
      contentMaxWidth: "1240px",
      px: "1rem",
      py: { xs: ".85rem", md: "1rem" },
      borderTop: "1px solid var(--rv-line)",
    },
    children: [
      {
        type: "stack",
        props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", gap: ".4rem" },
        children: [
          {
            type: "text",
            props: {
              content: es
                ? "Roavio · Datos de coste, internet, seguridad y calidad de vida basados en Numbeo y Speedtest Global Index (Ookla) · Actualizado 2026"
                : "Roavio · Cost, internet, safety, and quality of life data based on Numbeo and the Speedtest Global Index (Ookla) · Updated 2026",
              color: "var(--rv-muted)",
              size: ".72rem",
              lineHeight: 1.45,
            },
          },
          { type: "link", props: { href: "https://www.roavio.es/feedback", target: "_blank", content: es ? "Feedback" : "Feedback", size: ".72rem", color: "var(--rv-muted)" } },
        ],
      },
    ],
  };
}

export function createCityDossier(city: CityContent, locale: RoavioLocale) {
  const es = locale === "es";
  const labels = {
    monthlyCost: es ? "Coste/mes" : "Cost/mo",
    internet: "Internet",
    safety: es ? "Seguridad" : "Safety",
    quality: es ? "Calidad de vida" : "Quality of life",
    beach: es ? "Playa" : "Beach",
    region: es ? "Región" : "Region",
    about: es ? `Sobre ${city.name}` : `About ${city.name}`,
    highlighted: es ? "Datos destacados" : "Highlighted data",
    strengths: es ? "✓ Puntos fuertes" : "✓ Strengths",
    cautions: es ? "A tener en cuenta" : "Worth considering",
    summary: es ? "Resumen" : "Summary",
    continent: es ? "Continente" : "Continent",
    currency: es ? "Moneda local" : "Local currency",
    compare: es ? "Comparar con otra ciudad →" : "Compare with another city →",
    allCities: es ? "Ver todas las ciudades" : "See all cities",
    noStrengths: es ? "Sin datos destacados por encima de la media." : "No standout data above the average.",
    noCautions: es ? "Sin datos por debajo de la media." : "No data below the average.",
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
    [labels.continent, continentLabel(city.continent, locale)],
    [labels.currency, localCurrency(city.metrics.cost)],
    [es ? "Coste mensual" : "Monthly cost", monthlyCostSummary(city.metrics.cost)],
    [labels.internet, metricValue(city.metrics.internet, locale, " Mbps")],
    [labels.safety, metricValue(city.metrics.safety, locale, "/10")],
    [labels.quality, metricValue(city.metrics.quality, locale, "/10")],
  ];

  const schema = defineSchema({
    meta: {
      title: es ? `${city.name}, ${city.country} para nómadas digitales · Roavio` : `${city.name}, ${city.country} for digital nomads · Roavio`,
      description: city.summary || (es ? `Datos para trabajar en remoto desde ${city.name}.` : `Data for working remotely from ${city.name}.`),
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: {
        className: "rv-dossier-page",
        color: "var(--rv-ink)",
        minH: "100svh",
      },
      children: [
        { type: "slot", props: { name: "pageBackdrop" } },
        createRoavioNav(locale),
        {
          type: "section",
          props: {
            className: "rv-dossier-intro",
            contentMaxWidth: "1240px",
            px: "1rem",
            py: { xs: "1.2rem", md: "1.8rem" },
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
                    { type: "heading", props: { level: 1, content: city.name, size: { xs: "2.65rem", md: "4rem" }, color: "#fff", lineHeight: .96, style: { margin: ".3rem 0 0" } } },
                  ],
                },
                { type: "slot", props: { name: "heroImage" } },
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
                        { type: "text", props: { content: city.summary || (es ? "Sin resumen disponible." : "No summary available."), size: ".88rem", lineHeight: 1.65, color: "var(--rv-muted)" } },
                      ],
                    },
                    {
                      type: "box",
                      props: { className: "rv-dossier-highlighted" },
                      children: [
                        { type: "heading", props: { level: 2, content: labels.highlighted, size: "1rem", style: { margin: "0 0 .55rem" } } },
                        {
                          type: "box",
                          props: { className: "rv-dossier-insights" },
                          children: [
                            insightColumn(labels.strengths, "var(--rv-green)", city.strengths, labels.noStrengths),
                            insightColumn(labels.cautions, "var(--rv-peach)", city.considerations, labels.noCautions),
                          ],
                        },
                      ],
                    },
                    ...(city.editorialAvailable
                      ? [{
                          type: "box",
                          props: { className: "rv-dossier-section" },
                          children: [
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
                        } as SchemaNode]
                      : []),
                  ],
                },
                {
                  type: "box",
                  props: { className: "rv-dossier-summary" },
                  children: [
                    { type: "heading", props: { level: 3, content: labels.summary, size: ".95rem", style: { margin: 0 } } },
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
                        { type: "button", props: { href: `/compare?cities=${city.slug}`, label: labels.compare, variant: "elevated", accentColor: "var(--rv-lime)", color: "#10231f" } },
                        { type: "button", props: { href: "/cities", label: labels.allCities, variant: "outline", accentColor: "var(--rv-ink)" } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        officialCityFooter(locale),
      ],
    },
  });

  return createComponent({
    schema,
    slots: {
      pageBackdrop: <CityDossierBackdrop city={city.name} country={city.country} />,
      heroImage: (
        <div className="rv-dossier-hero__image">
          <CityThumb slug={city.slug} city={city.name} country={city.country} eager />
        </div>
      ),
    },
    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },
  });
}
