import { createPage, defineSchema } from "@/engine";
import { notFound } from "next/navigation";
import { cities, citySlug, featuredImages, findCity, nomadScore } from "../../roavio/cities";
import { footerNode, roavioNav, roavioTheme } from "../../roavio/theme";

export function generateStaticParams() {
  return cities.map((city) => ({ slug: citySlug(city.city) }));
}

const average = {
  quality: cities.reduce((sum, city) => sum + city.quality, 0) / cities.length,
  safety: cities.reduce((sum, city) => sum + city.safety, 0) / cities.length,
  internet: cities.reduce((sum, city) => sum + city.internet, 0) / cities.length
};

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = findCity(slug);
  if (!city) notFound();

  const image = featuredImages[slug];
  const strengths = [
    city.quality >= average.quality ? `Quality of life ${city.quality}/10 is above the Roavio dataset average.` : null,
    city.safety >= average.safety ? `Safety ${city.safety}/10 performs above the dataset average.` : null,
    city.internet >= average.internet ? `${city.internet} Mbps fixed internet is above the dataset average.` : null,
    city.beach ? "Coastal / beach access is available." : null
  ].filter((value): value is string => Boolean(value));

  const considerations = [
    city.quality < average.quality ? `Quality of life ${city.quality}/10 is below the dataset average.` : null,
    city.safety < average.safety ? `Safety ${city.safety}/10 is below the dataset average.` : null,
    city.internet < average.internet ? `${city.internet} Mbps internet is below the dataset average.` : null,
    !city.beach ? "No direct beach access in the city profile." : null
  ].filter((value): value is string => Boolean(value));

  const CitySchema = defineSchema({
    meta: {
      title: `${city.city}, ${city.country} for digital nomads · Roavio`,
      description: `Cost, internet, safety, quality of life and relocation context for ${city.city}.`
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
            { type: "heading", props: { level: 1, content: city.city, size: { xs: "3rem", md: "5rem" }, lineHeight: .95, style: { margin: ".55rem 0 1.25rem" } } },
            {
              type: "grid",
              props: { columns: { xs: 1, md: "1.15fr .85fr" }, gap: "1rem" },
              children: [
                {
                  type: "box",
                  props: {
                    className: "rv-detail-photo",
                    background: image ? `linear-gradient(180deg,transparent,rgba(9,27,22,.18)),url(${image}) center/cover` : "linear-gradient(145deg,#1b493b,#9ccf9b)",
                    p: "1.2rem"
                  },
                  children: [
                    { type: "box", props: { position: "absolute", left: "1.2rem", bottom: "1.2rem", zIndex: 2, className: "rv-floating-card" }, children: [
                      { type: "text", props: { content: `Roavio fit ${nomadScore(city).toFixed(1)}/10`, weight: 800 } },
                      { type: "text", props: { content: "Composite proposal score" } }
                    ] }
                  ]
                },
                {
                  type: "grid",
                  props: { columns: 2, gap: ".8rem" },
                  children: [
                    ["Monthly cost", city.cost],
                    ["Internet", `${city.internet} Mbps`],
                    ["Safety", `${city.safety}/10`],
                    ["Quality of life", `${city.quality}/10`],
                    ["Beach", city.beach ? "Yes" : "No"],
                    ["Region", city.continent]
                  ].map(([label, value]) => ({
                    type: "box",
                    key: label,
                    props: { className: "rv-stat-card" },
                    children: [
                      { type: "text", props: { content: label, size: ".76rem", color: "var(--rv-muted)" } },
                      { type: "text", props: { content: value, size: "1.2rem", weight: 800, mt: ".15rem", fontFamily: "Manrope" } }
                    ]
                  }))
                }
              ]
            }
          ]
        },
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "2.5rem", md: "4rem" } },
          children: [
            {
              type: "grid",
              props: { columns: { xs: 1, md: "1fr 320px" }, gap: "1.4rem", align: "start" },
              children: [
                {
                  type: "stack",
                  props: { direction: "vertical", gap: "1rem" },
                  children: [
                    {
                      type: "box",
                      props: { className: "rv-panel", p: { xs: "1.2rem", md: "1.5rem" } },
                      children: [
                        { type: "text", props: { content: "AT A GLANCE", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                        { type: "heading", props: { level: 2, content: `Why ${city.city}?`, size: "2rem", style: { margin: ".55rem 0" } } },
                        { type: "text", props: { content: `${city.city} is evaluated for remote work using Roavio's core signals: cost, connectivity, safety, quality of life and location context. The redesign surfaces the decision first, then lets the deeper guide explain the trade-offs.`, color: "var(--rv-muted)", lineHeight: 1.75 } }
                      ]
                    },
                    {
                      type: "grid",
                      props: { columns: { xs: 1, md: 2 }, gap: "1rem" },
                      children: [
                        {
                          type: "box",
                          props: { className: "rv-panel", p: "1.25rem" },
                          children: [
                            { type: "text", props: { content: "✓ STRONG FIT", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                            ...(strengths.length ? strengths : ["No core metric currently sits above the dataset average."]).map((item) => ({ type: "text", key: item, props: { content: `• ${item}`, size: ".88rem", lineHeight: 1.55, mt: ".65rem" } }))
                          ]
                        },
                        {
                          type: "box",
                          props: { className: "rv-panel", p: "1.25rem" },
                          children: [
                            { type: "text", props: { content: "CONSIDER", variant: "overline", color: "#9a5c35", weight: 800 } },
                            ...(considerations.length ? considerations : ["No core metric currently sits below the dataset average."]).map((item) => ({ type: "text", key: item, props: { content: `• ${item}`, size: ".88rem", lineHeight: 1.55, mt: ".65rem" } }))
                          ]
                        }
                      ]
                    },
                    ...[
                      ["Visa & tax", `Use Roavio's existing relocation content here, but present it as a structured checklist: eligibility, stay length, income threshold, registration, tax-residency trigger and official links.`],
                      ["Healthcare", `Surface public/private coverage, insurance requirements and emergency-access context for ${city.country} without making users hunt through long paragraphs.`],
                      ["Neighborhoods & coworking", `Turn Roavio's local area notes into a compact neighborhood matrix with vibe, typical rent band, transit and coworking density.`],
                      ["Internet & eSIM", `Keep ${city.internet} Mbps as the headline connectivity signal, then attach mobile-data and eSIM recommendations as a practical arrival checklist.`]
                    ].map(([title, body]) => ({
                      type: "box",
                      key: title,
                      props: { className: "rv-panel", p: { xs: "1.2rem", md: "1.5rem" } },
                      children: [
                        { type: "heading", props: { level: 2, content: title, size: "1.45rem", style: { margin: 0 } } },
                        { type: "text", props: { content: body, color: "var(--rv-muted)", lineHeight: 1.7, mt: ".6rem" } }
                      ]
                    }))
                  ]
                },
                {
                  type: "box",
                  props: { className: "rv-sidecard" },
                  children: [
                    { type: "text", props: { content: "DATA CONFIDENCE", variant: "overline", color: "var(--rv-green)", weight: 800 } },
                    { type: "text", props: { content: "Cost · Numbeo", weight: 800, mt: ".9rem" } },
                    { type: "text", props: { content: "Cost-of-living index excluding rent; methodology remains visible beside the metric.", size: ".78rem", color: "var(--rv-muted)", lineHeight: 1.5, mt: ".25rem" } },
                    { type: "divider", props: { my: ".9rem" } },
                    { type: "text", props: { content: "Internet · Ookla", weight: 800 } },
                    { type: "text", props: { content: "Fixed broadband country/region speed signal.", size: ".78rem", color: "var(--rv-muted)", lineHeight: 1.5, mt: ".25rem" } },
                    { type: "divider", props: { my: ".9rem" } },
                    { type: "text", props: { content: "Safety & QoL · Numbeo", weight: 800 } },
                    { type: "text", props: { content: "Scores are presented on Roavio's /10 scale with source context kept close to the number.", size: ".78rem", color: "var(--rv-muted)", lineHeight: 1.5, mt: ".25rem" } },
                    { type: "button", props: { href: `/compare?cities=${slug}`, label: "Compare this city →", variant: "elevated", accentColor: "var(--rv-ink)", mt: "1rem" } }
                  ]
                }
              ]
            }
          ]
        },
        footerNode
      ]
    }
  });

  const Page = createPage({ schema: CitySchema, compiler: { pageId: `roavio-city-${slug}`, serverFirst: true } });
  return <Page />;
}
