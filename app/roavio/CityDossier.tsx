import { createComponent, defineSchema, type SchemaNode } from "@/engine";
import { featuredImages } from "./cities";
import type { CityContent } from "./cityContent.server";
import { footerNode, roavioNav, roavioTheme } from "./theme";

function metricValue(value: string | number | boolean | null, suffix = ""): string {
  if (value === null) return "Not captured";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return `${value}${suffix}`;
}

function fitScore(city: CityContent): number | null {
  const { quality, safety, internet } = city.metrics;
  if (quality === null || safety === null || internet === null) return null;
  const internetScore = Math.min(internet / 40, 10);
  return Math.round((quality * 0.45 + safety * 0.3 + internetScore * 0.25) * 10) / 10;
}

function insightCard(title: string, tone: string, items: string[], fallback: string): SchemaNode {
  return {
    type: "box",
    props: { className: "rv-panel", p: "1.25rem" },
    children: [
      { type: "text", props: { content: title, variant: "overline", color: tone, weight: 800 } },
      ...(items.length ? items : [fallback]).map((item) => ({
        type: "text",
        key: item,
        props: { content: `• ${item}`, size: ".9rem", lineHeight: 1.55, mt: ".65rem" },
      })),
    ],
  };
}

export function createCityDossier(city: CityContent) {
  const image = featuredImages[city.slug];
  const score = fitScore(city);
  const stats = [
    ["Monthly cost", metricValue(city.metrics.cost)],
    ["Internet", metricValue(city.metrics.internet, " Mbps")],
    ["Safety", metricValue(city.metrics.safety, "/10")],
    ["Quality of life", metricValue(city.metrics.quality, "/10")],
    ["Beach", metricValue(city.metrics.beach)],
    ["Region", city.continent],
  ];

  const schema = defineSchema({
    meta: {
      title: `${city.name}, ${city.country} para nómadas digitales · Roavio`,
      description: city.summary || `Datos y guía para trabajar en remoto desde ${city.name}.`,
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: { bg: "var(--rv-paper)", minH: "100svh" },
      children: [
        roavioNav,
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "2.2rem", md: "3.5rem" } },
          children: [
            { type: "text", props: { content: `${city.country} · ${city.continent}`, variant: "overline", color: "var(--rv-green)", weight: 800 } },
            { type: "heading", props: { level: 1, content: city.name, size: { xs: "3rem", md: "5rem" }, lineHeight: .95, style: { margin: ".55rem 0 .8rem" } } },
            ...(city.summary ? [{ type: "text", props: { content: city.summary, size: { xs: "1rem", md: "1.1rem" }, color: "var(--rv-muted)", lineHeight: 1.7, maxW: "820px", mb: "1.4rem" } } as SchemaNode] : []),
            {
              type: "grid",
              props: { columns: { xs: 1, md: "1.15fr .85fr" }, gap: "1rem" },
              children: [
                {
                  type: "box",
                  props: {
                    className: "rv-detail-photo",
                    background: image ? `linear-gradient(180deg,transparent,rgba(9,27,22,.18)),url(${image}) center/cover` : "linear-gradient(145deg,#173d31,#8bc598)",
                    p: "1.2rem",
                  },
                  children: [
                    {
                      type: "box",
                      props: { position: "absolute", left: "1.2rem", bottom: "1.2rem", zIndex: 2, className: "rv-floating-card" },
                      children: [
                        { type: "text", props: { content: score === null ? "Roavio profile" : `Roavio fit ${score.toFixed(1)}/10`, weight: 800 } },
                        { type: "text", props: { content: score === null ? "Score waits for complete metrics" : "Composite proposal score" } },
                      ],
                    },
                  ],
                },
                {
                  type: "grid",
                  props: { columns: 2, gap: ".8rem" },
                  children: stats.map(([label, value]) => ({
                    type: "box",
                    key: label,
                    props: { className: "rv-stat-card" },
                    children: [
                      { type: "text", props: { content: label, size: ".76rem", color: "var(--rv-muted)" } },
                      { type: "text", props: { content: value, size: "1.15rem", weight: 800, mt: ".15rem", fontFamily: "Manrope" } },
                    ],
                  })),
                },
              ],
            },
          ],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1rem", md: "2rem" } },
          children: [
            {
              type: "grid",
              props: { columns: { xs: 1, md: 2 }, gap: "1rem" },
              children: [
                insightCard("✓ PUNTOS FUERTES", "var(--rv-green)", city.strengths, "Sin datos destacados por encima de la media en la ficha scrapeada."),
                insightCard("A TENER EN CUENTA", "#9a5c35", city.considerations, "Sin datos por debajo de la media en la ficha scrapeada."),
              ],
            },
          ],
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "2rem", md: "3rem" } },
          children: [
            {
              type: "grid",
              props: { columns: { xs: 1, md: "1fr 320px" }, gap: "1.4rem", align: "start" },
              children: [
                city.editorialAvailable
                  ? {
                      type: "box",
                      props: { className: "rv-panel", p: { xs: "1.2rem", md: "1.8rem" } },
                      children: [
                        {
                          type: "markdown",
                          props: {
                            className: "rv-prose",
                            content: city.guide,
                            headingColor: "var(--rv-ink)",
                            textColor: "#33443f",
                            linkColor: "var(--rv-green)",
                            bodyLineHeight: 1.8,
                            headingIdPrefix: city.slug,
                          },
                        },
                      ],
                    }
                  : {
                      type: "box",
                      props: { className: "rv-panel", p: { xs: "1.2rem", md: "1.8rem" } },
                      children: [
                        { type: "text", props: { content: "EDITORIAL GUIDE", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                        { type: "heading", props: { level: 2, content: "Metrics available, guide not present in the supplied scrape", size: "1.55rem", style: { margin: ".55rem 0" } } },
                        { type: "text", props: { content: `The supplied Roavio scrape did not contain a city-detail editorial page for ${city.name}, so this proposal deliberately does not invent visa, healthcare or neighborhood copy.`, color: "var(--rv-muted)", lineHeight: 1.7 } },
                      ],
                    },
                {
                  type: "box",
                  props: { className: "rv-sidecard" },
                  children: [
                    { type: "text", props: { content: "CONTENT + DATA", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                    { type: "text", props: { content: city.hasDeepGuide ? "Deep guide captured" : city.editorialAvailable ? "Core guide captured" : "No scraped guide", weight: 800, mt: ".8rem" } },
                    { type: "text", props: { content: "Long-form copy is Markdown. Metrics stay structured so filters, ranking, comparison and APIs do not need to parse prose.", size: ".8rem", color: "var(--rv-muted)", lineHeight: 1.55, mt: ".3rem" } },
                    { type: "divider", props: { my: ".9rem" } },
                    { type: "text", props: { content: "Sources in the scraped guide", weight: 800 } },
                    { type: "text", props: { content: "Numbeo · Ookla · official / relocation sources where Roavio supplied them.", size: ".78rem", color: "var(--rv-muted)", lineHeight: 1.5, mt: ".25rem" } },
                    ...(city.sourceUrl ? [{ type: "link", props: { href: city.sourceUrl, target: "_blank", content: "Open original Roavio page ↗", color: "var(--rv-green)", weight: 800, mt: ".8rem" } } as SchemaNode] : []),
                    { type: "button", props: { href: `/compare?cities=${city.slug}`, label: "Compare this city →", variant: "elevated", accentColor: "var(--rv-ink)", mt: "1rem" } },
                  ],
                },
              ],
            },
          ],
        },
        footerNode,
      ],
    },
  });

  return createComponent({ schema, compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true } });
}
