const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Exact city-route map recovered from the user's correctly tokenized 96-document
// Roavio corpus: 90 city detail routes + 6 non-city routes. The importer only
// materializes those 90 known city routes and never discovers extra pages.
const CITY_SLUGS = ["lisboa", "bangkok", "barcelona", "chiang-mai", "bali", "abu-dabi", "medellin", "auckland", "valencia", "belgrado", "almaty", "aman", "berlin", "bogota", "addis-abeba", "accra", "amsterdam", "atenas", "budapest", "braga", "ciudad-de-mexico", "buenos-aires", "el-cairo", "doha", "cusco", "dublin", "da-nang", "colombo", "panama", "copenhague", "cracovia", "hanoi", "estambul", "ciudad-del-cabo", "dubai", "ho-chi-minh", "marrakech", "hong-kong", "florencia", "guadalajara", "lima", "munich", "ljubljana", "londres", "milan", "kigali", "manila", "lagos", "montevideo", "madrid", "kuala-lumpur", "seattle", "santiago", "nairobi", "osaka", "rio-de-janeiro", "melbourne", "san-francisco", "perth", "mascate", "oslo", "paris", "praga", "playa-del-carmen", "miami", "roma", "riga", "sidney", "singapur", "suva", "pekin", "seul", "tirana", "varsovia", "oporto", "shenzhen", "sevilla", "split", "shanghai", "toronto", "taipei", "vancouver", "sofia", "tiflis", "viena", "wellington", "tallin", "tokio", "zanzibar", "yakarta"];

if (CITY_SLUGS.length !== 90 || new Set(CITY_SLUGS).size !== 90) {
  throw new Error(`[roavio] expected exactly 90 unique mapped city routes; got ${CITY_SLUGS.length}`);
}

const outputDir = path.join(process.cwd(), "content", "cities");
const force = process.argv.includes("--force");
const DEEP_SECTIONS = ["Visado y fiscalidad", "Sanidad y seguro médico", "Barrios y coworkings"];

function clean(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function orderedContent($) {
  const scope = $("main").first().length ? $("main").first() : $("body");
  const result = [];
  scope.find("h1,h2,h3,p,ul,ol").each((_, element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      const items = $(element).children("li").map((__, li) => clean($(li).text())).get().filter(Boolean);
      if (items.length) result.push({ tag: "list", ordered: tag === "ol", items });
      return;
    }
    const content = clean($(element).text());
    if (content) result.push({ tag, content });
  });
  return result.filter((node, index, array) => {
    const previous = array[index - 1];
    return !previous || JSON.stringify(previous) !== JSON.stringify(node);
  });
}

function sectionMap(nodes, h1Index) {
  const sections = new Map();
  let current = null;
  for (let index = h1Index + 1; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.tag === "h2") {
      current = node.content;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(node);
  }
  return sections;
}

function nodesToMarkdown(nodes) {
  const out = [];
  for (const node of nodes) {
    if (node.tag === "p") out.push(node.content);
    else if (node.tag === "h3" && node.content !== "Resumen") out.push(`### ${node.content}`);
    else if (node.tag === "list") {
      const lines = node.items.map((item, index) => node.ordered ? `${index + 1}. ${item}` : `- ${item}`);
      if (lines.length) out.push(lines.join("\n"));
    }
  }
  return out.filter(Boolean).join("\n\n").trim();
}

function extractHighlights(nodes) {
  const strengths = [];
  const considerations = [];
  let target = null;
  for (const node of nodes) {
    if (node.tag === "h3") {
      if (node.content.includes("Puntos fuertes")) target = strengths;
      else if (node.content.includes("A tener en cuenta")) target = considerations;
      else target = null;
      continue;
    }
    if (!target) continue;
    const values = node.tag === "list" ? node.items : node.tag === "p" ? [node.content] : [];
    for (const value of values) {
      if (!/^Sin datos/i.test(value)) target.push(value);
    }
  }
  return { strengths, considerations };
}

function numberMatch(text, expression) {
  const match = text.match(expression);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function scrapedMetrics(strengths, considerations) {
  const text = [...strengths, ...considerations].join(" ");
  const currency = text.match(/\b([A-Z]{3})\s*([\d.,]+)\s*\/(?:mes|mo)/i);
  const euro = text.match(/([\d.,]+)\s*€\s*\/mes/i);
  return {
    cost: currency ? `${currency[1].toUpperCase()} ${currency[2]}/mo` : euro ? `EUR ${euro[1]}/mo` : null,
    internet: numberMatch(text, /(?:Internet rápido|Internet por debajo de la media)\s*(\d+(?:[.,]\d+)?)\s*Mbps/i),
    safety: numberMatch(text, /Índice de seguridad\s*(\d+(?:[.,]\d+)?)\s*\/10/i),
    quality: numberMatch(text, /(?:Alta calidad de vida|Calidad de vida por debajo de la media)\s*(\d+(?:[.,]\d+)?)\s*\/10/i),
    beach: strengths.some((value) => /Acceso a playa/i.test(value) && /cuenta con playa/i.test(value)) ? true : null,
  };
}

async function importCity(slug) {
  const sourceUrl = `https://www.roavio.es/cities/${slug}`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": "Roavio-NE-Proposal-Importer/2.0" } });
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const nodes = orderedContent($);
  const h1Index = nodes.findIndex((node) => node.tag === "h1");
  if (h1Index < 0) throw new Error(`${slug}: no city h1 found`);

  const name = nodes[h1Index].content;
  const locationNode = [...nodes.slice(0, h1Index)].reverse().find((node) => node.tag === "p" && node.content.includes(" · "));
  const [country = "", continent = ""] = locationNode ? locationNode.content.split(" · ", 2).map(clean) : ["", ""];
  if (!name || !country || !continent) throw new Error(`${slug}: city identity could not be mapped`);

  const sections = sectionMap(nodes, h1Index);
  const aboutName = [...sections.keys()].find((title) => title.startsWith("Sobre "));
  const summary = aboutName ? sections.get(aboutName).find((node) => node.tag === "p")?.content ?? "" : "";
  const { strengths, considerations } = extractHighlights(sections.get("Datos destacados") ?? []);

  const guideSections = [...sections.entries()].filter(([title]) =>
    title !== "Datos destacados" && !title.startsWith("Sobre ")
  );
  const guide = guideSections
    .map(([title, body]) => {
      const markdown = nodesToMarkdown(body);
      return markdown ? `## ${title}\n\n${markdown}` : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!guide) throw new Error(`${slug}: no editorial guide sections found`);

  const profile = {
    schemaVersion: 1,
    slug,
    name,
    country,
    continent,
    summary,
    strengths,
    considerations,
    sourceUrl,
    sourceTitle: clean($("title").first().text()) || null,
    hasDeepGuide: DEEP_SECTIONS.every((title) => sections.has(title)),
    scrapedMetrics: scrapedMetrics(strengths, considerations),
  };

  const cityDir = path.join(outputDir, slug);
  fs.mkdirSync(cityDir, { recursive: true });
  const cityFile = path.join(cityDir, "city.json");
  const guideFile = path.join(cityDir, "guide.md");
  if (force || !fs.existsSync(cityFile)) fs.writeFileSync(cityFile, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  if (force || !fs.existsSync(guideFile)) fs.writeFileSync(guideFile, `${guide}\n`, "utf8");
  return { slug, deep: profile.hasDeepGuide, guideBytes: Buffer.byteLength(guide), metrics: profile.scrapedMetrics };
}

(async () => {
  const results = [];
  for (const slug of CITY_SLUGS) {
    const result = await importCity(slug);
    results.push(result);
    console.log(`[roavio] ${slug}: ${result.guideBytes} guide bytes${result.deep ? " · deep" : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 75));
  }

  const counts = {
    cost: results.filter((r) => r.metrics.cost !== null).length,
    quality: results.filter((r) => r.metrics.quality !== null).length,
    safety: results.filter((r) => r.metrics.safety !== null).length,
    internet: results.filter((r) => r.metrics.internet !== null).length,
    beach: results.filter((r) => r.metrics.beach === true).length,
    deep: results.filter((r) => r.deep).length,
  };

  console.log(`[roavio] materialized ${results.length} mapped city routes.`);
  console.log(`[roavio] explicit metrics: ${counts.cost} cost · ${counts.quality} quality · ${counts.safety} safety · ${counts.internet} internet · ${counts.beach} beach.`);
  console.log(`[roavio] deep editorial guides: ${counts.deep}.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
