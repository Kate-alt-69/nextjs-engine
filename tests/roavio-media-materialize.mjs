import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "content/cities");
const outPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const officialPath = path.resolve(process.cwd(), "app/roavio/official-city-images.generated.json");
const pauseMs = Math.max(100, Number(process.env.ROAVIO_MEDIA_PAUSE_MS || 180));
const retryLimit = Math.max(2, Number(process.env.ROAVIO_MEDIA_RETRIES || 5));
const userAgent = "RoavioProposal/1.0 (secondary destination media resolver)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rejectMedia = /\b(flag|map|locator|seal|logo|icon|diagram|portrait|football|soccer|rugby|cricket|baseball|basketball|tennis|golf|stadium|arena|olympics?|sports?|food|dish|meal|cuisine|soup|stew|noodles?|rice|dessert|cake|sandwich|plate|drawing|sketch|illustration|painting|engraving|poster|manuscript|stamp|coin|banknote|satellite|airport|runway|aircraft|airplane|helicopter|species|specimen|shell|insect|bird|fish|animal|plant|flower|fossil|war|battle|military|army|navy|fighter|soldiers?|troops?|airshow|dead|death|outbreak|epidemic|pandemic|covid|riot|protest|disaster|wildfire|flood|earthquake|crash|accident|cruise[ _-]?ship|wildlife)\b/i;
const weakMedia = /\b(bus|taxi|car|vehicle|parking|terminal|road[ _-]?sign|signage|bike|bicycle|smog|dusty)\b/i;
const goodSecondary = /\b(skyline|cityscape|panorama|panoramic|aerial|downtown|waterfront|harbou?r|bay|urban|old[ _-]?town|historic|river|canal|coast|beach|street|avenue|architecture|landmark|monument|tower|mosque|cathedral|church|temple|palace|castle|fort|museum|square|plaza|bridge|gate|heritage|marina|promenade|market|bazaar|garden|park)\b/i;

function folded(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
}

function sourceOf(item) {
  return item?.thumburl || item?.url || null;
}

function usableInfo(info) {
  if (!info) return false;
  if (info.mime && !/^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime)) return false;
  const width = info.thumbwidth || info.width || 0;
  const height = info.thumbheight || info.height || 0;
  if (width && width < 640) return false;
  if (height && height < 320) return false;
  if (width && height) {
    const ratio = width / height;
    if (ratio < 0.95 || ratio > 3.2) return false;
  }
  return Boolean(info.thumburl || info.url);
}

async function fetchJson(url, attempt = 0) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < retryLimit) {
      const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
      await sleep(Math.max(retryAfter, Math.min(10_000, 600 * (2 ** attempt))));
      return fetchJson(url, attempt + 1);
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const json = await response.json();
    await sleep(pauseMs);
    return json;
  } catch (error) {
    if (attempt >= retryLimit) throw error;
    await sleep(Math.min(10_000, 600 * (2 ** attempt)));
    return fetchJson(url, attempt + 1);
  }
}

async function commonsSearch(query, limit = 24) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|mime|size",
    iiurlwidth: "1600",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  return (data.query?.pages || [])
    .map((page) => ({ title: page.title || "", ...(page.imageinfo?.[0] || {}) }))
    .filter((item) => usableInfo(item));
}

function score(item, city) {
  const title = item.title || "";
  if (rejectMedia.test(title) || /\.svg(?:$|\?)/i.test(title)) return -1000;
  const normalized = folded(title);
  let value = 0;
  if (normalized.includes(folded(city))) value += 30;
  if (goodSecondary.test(normalized)) value += 20;
  if (weakMedia.test(normalized)) value -= 32;
  const width = item.thumbwidth || item.width || 0;
  const height = item.thumbheight || item.height || 0;
  if (width >= 1200) value += 5;
  if (width && height && width / height >= 1.15 && width / height <= 2.5) value += 5;
  return value;
}

async function resolveSecondary(city, country) {
  const queries = [
    `${city} ${country} skyline cityscape panorama waterfront architecture`,
    `${city} ${country} landmark street square historic park`,
    `${city} ${country}`,
  ];
  const seen = new Set();
  const candidates = [];

  for (const query of queries) {
    const items = await commonsSearch(query);
    for (const item of items) {
      const source = sourceOf(item);
      if (!source || seen.has(source) || rejectMedia.test(item.title || "")) continue;
      seen.add(source);
      candidates.push(item);
    }
    const best = candidates
      .map((item) => ({ item, score: score(item, city) }))
      .filter((entry) => entry.score >= 20)
      .sort((a, b) => b.score - a.score)[0]?.item;
    if (best) return best;
  }
  return null;
}

const [official, previous] = await Promise.all([
  readFile(officialPath, "utf8").then(JSON.parse),
  readFile(outPath, "utf8").then(JSON.parse).catch(() => ({ cities: {} })),
]);

const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== "_template" && !entry.name.startsWith("."))
  .map((entry) => entry.name)
  .sort();
const expected = Object.keys(official.cities || {}).length;
if (!expected || entries.length !== expected) {
  throw new Error(`Catalog/source mismatch: ${entries.length} city directories vs ${expected} official image entries`);
}

const manifest = {
  version: 5,
  generatedAt: new Date().toISOString(),
  qualityPolicy: "roavio-official-primary+audited-secondary-v2",
  cities: {},
};

for (let index = 0; index < entries.length; index += 1) {
  const slug = entries[index];
  const profile = JSON.parse(await readFile(path.join(root, slug, "city.json"), "utf8"));
  const primary = official.cities?.[slug];
  if (typeof primary !== "string" || !primary.startsWith("https://images.unsplash.com/")) {
    throw new Error(`Missing official Roavio primary image for ${slug}`);
  }

  const old = previous.cities?.[slug];
  let secondary = typeof old?.secondarySource === "string" && old.secondarySource.startsWith("https://")
    ? { source: old.secondarySource, title: old.secondaryTitle || "Audited destination scene" }
    : typeof old?.secondary === "string" && old.secondary.startsWith("https://")
      ? { source: old.secondary, title: old.secondaryTitle || "Audited destination scene" }
      : null;

  if (!secondary) {
    console.log(`${String(index + 1).padStart(2, "0")}/${expected} ${slug}: resolving secondary scene`);
    const resolved = await resolveSecondary(profile.name, profile.country);
    if (!resolved) throw new Error(`Unable to resolve secondary city scene for ${slug}`);
    secondary = { source: sourceOf(resolved), title: resolved.title || "Destination scene" };
  } else {
    console.log(`${String(index + 1).padStart(2, "0")}/${expected} ${slug}: reusing audited secondary`);
  }

  manifest.cities[slug] = {
    city: profile.name,
    country: profile.country,
    primary,
    secondary: secondary.source,
    primaryTitle: "Roavio official city image",
    secondaryTitle: secondary.title,
  };
}

await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nMaterialized ${expected} cities / ${expected * 2} photo slots using Roavio primary images. ✅`);
