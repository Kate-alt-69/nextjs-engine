import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "content/cities");
const outPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const userAgent = "RoavioProposal/1.0 (https://github.com/Kate-alt-69/nextjs-engine; public city media materializer)";
const pauseMs = Math.max(100, Number(process.env.ROAVIO_MEDIA_PAUSE_MS || 180));
const retryLimit = Math.max(2, Number(process.env.ROAVIO_MEDIA_RETRIES || 5));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// These are poor destination-card subjects even when the filename contains the city name.
// Prefer failing a slot over shipping a stadium, food plate, biological specimen or diagram.
const rejectMedia = /\b(flag|map|locator|location|seal|coat[ _-]?of[ _-]?arms|logo|icon|diagram|route|metro[ _-]?map|subway[ _-]?map|districts?|boroughs?|portrait|player|athlete|politician|mayor|president|football|soccer|rugby|cricket|baseball|basketball|tennis|golf|marathon|runner|race|team|jersey|medal|election|signature|stadium|arena|sports?|sporting|food|dish|meal|cuisine|soup|stew|noodles?|rice|soto|dessert|cake|sandwich|plate|drawing|sketch|illustration|painting|engraving|lithograph|poster|manuscript|stamp|coin|banknote|satellite|airport|runway|aircraft|airplane|helicopter|species|specimen|shell|mollusc|mollusk|insect|bird|fish|animal|plant|flower|fossil|herbarium|botanical|zoological|beetle|butterfly)\b/i;
const weakMedia = /\b(bus|taxi|car|vehicle|parking|terminal|road[ _-]?sign|signage)\b/i;
const primaryHint = /\b(skyline|cityscape|panorama|panoramic|aerial|downtown|waterfront|harbou?r|corniche|bay|city|urban|old[ _-]?town|historic[ _-]?centre|historic[ _-]?center)\b/i;
const secondaryHint = /\b(street|avenue|boulevard|architecture|landmark|monument|tower|mosque|cathedral|church|temple|palace|castle|fort|museum|square|plaza|bridge|gate|old[ _-]?town|historic|heritage|waterfront|marina|corniche|promenade|market|bazaar|garden|park|beach)\b/i;

const aliases = {
  "abu dabi": "Abu Dhabi",
  "addis abeba": "Addis Ababa",
  aman: "Amman",
  amsterdam: "Amsterdam",
  atenas: "Athens",
  belgrado: "Belgrade",
  "ciudad de mexico": "Mexico City",
  "ciudad del cabo": "Cape Town",
  copenhague: "Copenhagen",
  cracovia: "Kraków",
  dubai: "Dubai",
  dublin: "Dublin",
  "el cairo": "Cairo",
  estambul: "Istanbul",
  florencia: "Florence",
  hanoi: "Hanoi",
  "ho chi minh": "Ho Chi Minh City",
  liubliana: "Ljubljana",
  londres: "London",
  mascate: "Muscat",
  milan: "Milan",
  munich: "Munich",
  oporto: "Porto",
  panama: "Panama City",
  pekin: "Beijing",
  praga: "Prague",
  "rio de janeiro": "Rio de Janeiro",
  roma: "Rome",
  seul: "Seoul",
  sevilla: "Seville",
  shanghai: "Shanghai",
  sidney: "Sydney",
  singapur: "Singapore",
  sofia: "Sofia",
  taipei: "Taipei",
  tallin: "Tallinn",
  tiflis: "Tbilisi",
  tokio: "Tokyo",
  varsovia: "Warsaw",
  viena: "Vienna",
  yakarta: "Jakarta",
  zanzibar: "Zanzibar City",
};

function folded(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
}

function canonicalCity(city) {
  return aliases[folded(city)] || city;
}

async function fetchJson(url, attempt = 0) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent },
    });
  } catch (error) {
    if (attempt >= retryLimit) throw error;
    await sleep(Math.min(8000, 500 * (2 ** attempt)));
    return fetchJson(url, attempt + 1);
  }

  if ((response.status === 429 || response.status >= 500) && attempt < retryLimit) {
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    const wait = Math.max(retryAfter, Math.min(8000, 500 * (2 ** attempt)));
    console.log(`  upstream ${response.status}; retrying in ${wait}ms`);
    await sleep(wait);
    return fetchJson(url, attempt + 1);
  }

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const json = await response.json();
  await sleep(pauseMs);
  return json;
}

function usefulAspect(width, height) {
  if (!width || !height) return true;
  const ratio = width / height;
  return ratio >= 0.9 && ratio <= 3.4;
}

function usableInfo(info) {
  if (!info) return false;
  if (info.mime && !/^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime)) return false;
  const width = info.thumbwidth || info.width || 0;
  const height = info.thumbheight || info.height || 0;
  if (width && width < 480) return false;
  if (height && height < 260) return false;
  if (!usefulAspect(width, height)) return false;
  return Boolean(info.thumburl || info.url);
}

function sourceOf(item) {
  return item?.thumburl || item?.url || item?.source || null;
}

async function exactArticle(language, title) {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    redirects: "1",
    prop: "pageimages|images",
    piprop: "thumbnail|name",
    pithumbsize: "1600",
    imlimit: "100",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const data = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${params}`);
  return data.query?.pages?.find((page) => !page.missing && page.ns === 0) || null;
}

async function searchArticles(language, query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "5",
    prop: "pageimages|images",
    piprop: "thumbnail|name",
    pithumbsize: "1600",
    imlimit: "80",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const data = await fetchJson(`https://${language}.wikipedia.org/w/api.php?${params}`);
  return data.query?.pages || [];
}

async function commonsInfo(titles) {
  const output = [];
  const uniqueTitles = [...new Set(titles)].filter(Boolean);
  for (let start = 0; start < uniqueTitles.length; start += 40) {
    const batch = uniqueTitles.slice(start, start + 40);
    const params = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url|mime|size",
      iiurlwidth: "1600",
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    for (const page of data.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (page.title && usableInfo(info)) output.push({ title: page.title, ...info });
    }
  }
  return output;
}

async function commonsSearch(query, limit = 18) {
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
    .map((page) => ({ title: page.title, ...(page.imageinfo?.[0] || {}) }))
    .filter((item) => usableInfo(item));
}

function titleScore(item, city, slot) {
  const title = item.title || "";
  if (rejectMedia.test(title) || /\.svg(?:$|\?)/i.test(title)) return -1000;

  const normalized = folded(title);
  const normalizedCity = folded(city);
  let score = 0;
  if (normalized.includes(normalizedCity)) score += 24;
  if (slot === 0 && primaryHint.test(normalized)) score += 18;
  if (slot === 1 && secondaryHint.test(normalized)) score += 22;
  if (slot === 1 && primaryHint.test(normalized)) score += 3;
  if (weakMedia.test(normalized)) score -= 28;

  const width = item.thumbwidth || item.width || 0;
  const height = item.thumbheight || item.height || 0;
  if (width >= 1200) score += 4;
  if (width && height && width / height >= 1.15 && width / height <= 2.5) score += 5;
  return score;
}

function uniqueMedia(items) {
  const output = [];
  const seen = new Set();
  for (const item of items) {
    const source = sourceOf(item);
    if (!source || seen.has(source)) continue;
    if (rejectMedia.test(item.title || "") || /\.svg(?:$|\?)/i.test(item.title || "")) continue;
    seen.add(source);
    output.push(item);
  }
  return output;
}

function pick(items, city, slot, excluded = new Set()) {
  return items
    .filter((item) => !excluded.has(sourceOf(item)))
    .map((item) => ({ item, score: titleScore(item, city, slot) }))
    .filter((entry) => entry.score >= 8)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

async function buildPool(city, country) {
  const canonical = canonicalCity(city);
  const pages = [];

  for (const language of ["en", "es"]) {
    for (const title of [...new Set([canonical, city])]) {
      try {
        const page = await exactArticle(language, title);
        if (page) pages.push({ language, page });
      } catch (error) {
        console.log(`    ${language}:${title} exact lookup failed: ${error.message}`);
      }
    }
    if (pages.some(({ page }) => page.thumbnail?.source)) break;
  }

  if (!pages.length) {
    for (const language of ["en", "es"]) {
      try {
        const found = await searchArticles(language, `${canonical} ${country}`);
        pages.push(...found.map((page) => ({ language, page })));
      } catch (error) {
        console.log(`    ${language} article search failed: ${error.message}`);
      }
      if (pages.length) break;
    }
  }

  const media = [];
  for (const { page } of pages.slice(0, 4)) {
    if (page.thumbnail?.source && page.pageimage && !rejectMedia.test(page.pageimage) && !/\.svg$/i.test(page.pageimage)) {
      media.push({
        title: page.pageimage,
        source: page.thumbnail.source,
        width: page.thumbnail.width,
        height: page.thumbnail.height,
      });
    }
  }

  const imageTitles = pages
    .slice(0, 3)
    .flatMap(({ page }) => page.images || [])
    .map((image) => image.title)
    .filter(Boolean)
    .filter((title) => !rejectMedia.test(title) && !/\.svg$/i.test(title));
  if (imageTitles.length) {
    try { media.push(...await commonsInfo(imageTitles.slice(0, 80))); }
    catch (error) { console.log(`    Commons imageinfo failed: ${error.message}`); }
  }

  let pool = uniqueMedia(media);

  // Always add a small, deliberately city-shaped Commons set. This costs a little more
  // during the one-time materialization pass but dramatically improves visual relevance.
  try {
    pool = uniqueMedia([
      ...pool,
      ...await commonsSearch(`${canonical} ${country} skyline panorama cityscape downtown waterfront`, 14),
    ]);
  } catch (error) {
    console.log(`    Commons skyline search failed: ${error.message}`);
  }
  try {
    pool = uniqueMedia([
      ...pool,
      ...await commonsSearch(`${canonical} ${country} landmark architecture square street waterfront park`, 14),
    ]);
  } catch (error) {
    console.log(`    Commons landmark search failed: ${error.message}`);
  }

  if (pool.length < 2) {
    try { pool = uniqueMedia([...pool, ...await commonsSearch(`${canonical} ${country}`, 30)]) }
    catch (error) { console.log(`    Commons broad search failed: ${error.message}`); }
  }

  return { canonical, pool };
}

const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== "_template" && !entry.name.startsWith("."))
  .map((entry) => entry.name)
  .sort();

if (entries.length !== 90) throw new Error(`Expected exactly 90 city directories, found ${entries.length}`);

const manifest = { version: 2, generatedAt: new Date().toISOString(), qualityPolicy: "destination-scenes-v2", cities: {} };
const failures = [];

for (let index = 0; index < entries.length; index += 1) {
  const slug = entries[index];
  const cityData = JSON.parse(await readFile(path.join(root, slug, "city.json"), "utf8"));
  const city = cityData.name;
  const country = cityData.country;

  console.log(`${String(index + 1).padStart(2, "0")}/90 ${slug} (${city}, ${country})`);
  const { canonical, pool } = await buildPool(city, country);
  let primary = pick(pool, canonical, 0);
  let secondary = pick(pool, canonical, 1, new Set(primary ? [sourceOf(primary)] : []));

  if (!primary || !secondary) {
    try {
      const extra = await commonsSearch(`${canonical} ${country} landmark street waterfront panorama historic architecture`, 30);
      const expanded = uniqueMedia([...pool, ...extra]);
      primary ||= pick(expanded, canonical, 0);
      secondary ||= pick(expanded, canonical, 1, new Set(primary ? [sourceOf(primary)] : []));
    } catch (error) {
      console.log(`    final Commons fallback failed: ${error.message}`);
    }
  }

  const primarySource = sourceOf(primary);
  const secondarySource = sourceOf(secondary);
  if (!primarySource || !secondarySource || primarySource === secondarySource) {
    failures.push({ slug, city, country, candidates: pool.length, primary: Boolean(primarySource), secondary: Boolean(secondarySource) });
    console.log(`    MISSING — ${pool.length} usable candidates`);
    continue;
  }

  manifest.cities[slug] = {
    city,
    country,
    primary: primarySource,
    secondary: secondarySource,
    primaryTitle: primary.title || null,
    secondaryTitle: secondary.title || null,
  };
  console.log(`    ok — ${primary.title || "primary"} / ${secondary.title || "secondary"}`);
}

if (failures.length) {
  console.error("\nUnable to materialize two distinct destination photos for every city:");
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

if (Object.keys(manifest.cities).length !== 90) throw new Error("Generated media manifest is incomplete");
await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nMaterialized 90 cities / 180 destination-photo slots into ${path.relative(process.cwd(), outPath)}. ✅`);