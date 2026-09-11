const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// The route list and section grammar come from the user-supplied 94-page Roavio scrape.
// We fetch the public pages during this one-time import so the repo does not need to
// carry a huge opaque compressed payload. Once imported, runtime uses only Markdown/JSON.
const CITY_SLUGS = [
  "valencia","lisboa","bali","bangkok","chiang-mai","medellin","abu-dabi","accra","addis-abeba","almaty","aman","amsterdam","atenas","auckland","barcelona","belgrado","berlin","bogota","braga","budapest","buenos-aires","ciudad-de-mexico","panama","ciudad-del-cabo","colombo","copenhague","cracovia","cusco","da-nang","doha","dubai","dublin","el-cairo","estambul","florencia","guadalajara","hanoi","ho-chi-minh","hong-kong","kigali","kuala-lumpur","lagos","lima","ljubljana","londres","madrid","manila","marrakech","mascate","melbourne","miami","milan","montevideo","munich","nairobi","osaka","oslo","paris","pekin","perth","playa-del-carmen","praga","riga","rio-de-janeiro","roma","san-francisco","santiago","seattle","seul","sevilla","shanghai","shenzhen","sidney","singapur","sofia","split","suva","taipei","tallin","tiflis","tirana","tokio","toronto","vancouver","varsovia","viena","wellington","yakarta","zanzibar"
];

const outputDir = path.join(process.cwd(), "content", "cities");
const force = process.argv.includes("--force");

function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
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
      if (current === "Resumen") break;
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
    else if (node.tag === "h3") out.push(`### ${node.content}`);
    else if (node.tag === "list") {
      node.items.forEach((item, index) => out.push(node.ordered ? `${index + 1}. ${item}` : `- ${item}`));
    }
  }
  return out.join("\n\n").trim();
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
  const currency = text.match(/\b(EUR|USD|GBP|AUD|CAD|NZD|GHS|JOD|QAR|OMR|EGP|CNY|JPY|KES|PEN|UYU|CLP|THB|IDR)\s*([\d.,]+)\s*\/(?:mes|mo)/i);
  const euro = text.match(/([\d.,]+)\s*€\s*\/mes/i);
  return {
    cost: currency ? `${currency[1].toUpperCase()} ${currency[2]}/mo` : euro ? `EUR ${euro[1]}/mo` : null,
    internet: numberMatch(text, /(\d+(?:[.,]\d+)?)\s*Mbps/i),
    safety: numberMatch(text, /(?:seguridad[^0-9]{0,30}|Índice de seguridad\s*)(\d+(?:[.,]\d+)?)\s*\/10/i),
    quality: numberMatch(text, /calidad de vida[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s*\/10/i),
    beach: strengths.some((value) => /playa/i.test(value) && /(acceso|cuenta)/i.test(value)) ? true : null,
  };
}

async function importCity(slug) {
  const sourceUrl = `https://www.roavio.es/cities/${slug}`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": "Roavio-NE-Proposal-Importer/1.0" } });
  if (!response.ok) throw new Error(`${slug}: HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const nodes = orderedContent($);
  const h1Index = nodes.findIndex((node) => node.tag === "h1");
  if (h1Index < 0) throw new Error(`${slug}: no city h1 found`);

  const name = nodes[h1Index].content;
  const locationNode = [...nodes.slice(0, h1Index)].reverse().find((node) => node.tag === "p" && node.content.includes(" · "));
  const [country = "", continent = ""] = locationNode ? locationNode.content.split(" · ", 2).map(clean) : ["", ""];
  const sections = sectionMap(nodes, h1Index);
  const aboutName = [...sections.keys()].find((title) => title.startsWith("Sobre "));
  const summary = aboutName ? sections.get(aboutName).find((node) => node.tag === "p")?.content ?? "" : "";
  const { strengths, considerations } = extractHighlights(sections.get("Datos destacados") ?? []);

  const guideSections = [...sections.entries()].filter(([title]) => title !== "Datos destacados");
  const guide = guideSections.map(([title, body]) => `## ${title}\n\n${nodesToMarkdown(body)}`.trim()).join("\n\n").trim();
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
    hasDeepGuide: ["Visado y fiscalidad", "Sanidad y seguro médico", "Barrios y coworkings"].every((title) => sections.has(title)),
    scrapedMetrics: scrapedMetrics(strengths, considerations),
  };

  const cityDir = path.join(outputDir, slug);
  fs.mkdirSync(cityDir, { recursive: true });
  const cityFile = path.join(cityDir, "city.json");
  const guideFile = path.join(cityDir, "guide.md");
  if (force || !fs.existsSync(cityFile)) fs.writeFileSync(cityFile, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  if (force || !fs.existsSync(guideFile)) fs.writeFileSync(guideFile, `${guide}\n`, "utf8");
  return { slug, deep: profile.hasDeepGuide, guideBytes: Buffer.byteLength(guide) };
}

(async () => {
  const results = [];
  for (const slug of CITY_SLUGS) {
    const result = await importCity(slug);
    results.push(result);
    console.log(`[roavio] ${slug}: ${result.guideBytes} guide bytes${result.deep ? " · deep" : ""}`);
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  console.log(`[roavio] imported ${results.length} city detail pages into Markdown + JSON.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
