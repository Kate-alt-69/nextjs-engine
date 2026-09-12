import { NextRequest } from "next/server";
import { fetchCityPhotoSource, getMaterializedCityPhoto } from "@/app/roavio/cityMedia.server";

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

// Transparent 1x1 PNG. Returning an actual image instead of a 404 lets the
// existing card/dossier gradient remain visible without triggering broken image
// retries or Next Image runtime failures. The response header tells us which
// destinations still need a curated photo later.
const TRANSPARENT_PNG = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 8, 29, 99, 248, 207, 192, 0, 0,
  3, 1, 1, 0, 24, 221, 141, 184, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130,
]);

const REJECT_MEDIA_TITLE = /\b(flag|map|locator|location|seal|coat[ _-]?of[ _-]?arms|logo|icon|diagram|route|metro|subway|districts?|boroughs?|portrait|player|athlete|politician|mayor|president|football|rugby|cricket|marathon|runner|race|team|jersey|medal|election|signature)\b/i;
const CITY_MEDIA_HINT = /\b(skyline|cityscape|panorama|panoramic|aerial|downtown|waterfront|harbou?r|corniche|street|avenue|boulevard|old[ _-]?town|centre|center|architecture|tower|towers|landmark|mosque|cathedral|temple|palace|square|plaza|bay|beach|marina|river|bridge|night|city|urban)\b/i;
const LANDMARK_MEDIA_HINT = /\b(landmark|monument|tower|towers|mosque|cathedral|church|temple|palace|castle|fort|museum|square|plaza|bridge|gate|old[ _-]?town|historic|heritage|waterfront|marina|corniche|avenue|boulevard|promenade|market|bazaar|garden|park)\b/i;

// Roavio stores display names in Spanish. English Wikipedia does not consistently
// redirect those names, so try the exact supplied title first and then a known
// canonical article title. This stays deterministic; it is not a broad image search.
const CITY_ARTICLE_ALIASES: Record<string, string> = {
  "abu dabi": "Abu Dhabi",
  "aman": "Amman",
  "atenas": "Athens",
  "belgrado": "Belgrade",
  "ciudad de mexico": "Mexico City",
  "ciudad del cabo": "Cape Town",
  "copenhague": "Copenhagen",
  "cracovia": "Kraków",
  "dubai": "Dubai",
  "el cairo": "Cairo",
  "estambul": "Istanbul",
  "florencia": "Florence",
  "hanoi": "Hanoi",
  "ho chi minh": "Ho Chi Minh City",
  "liubliana": "Ljubljana",
  "londres": "London",
  "mascate": "Muscat",
  "milan": "Milan",
  "munich": "Munich",
  "oporto": "Porto",
  "pekin": "Beijing",
  "praga": "Prague",
  "roma": "Rome",
  "seul": "Seoul",
  "sevilla": "Seville",
  "shanghai": "Shanghai",
  "sidney": "Sydney",
  "singapur": "Singapore",
  "sofia": "Sofia",
  "taipei": "Taipei",
  "tallin": "Tallinn",
  "tiflis": "Tbilisi",
  "tokio": "Tokyo",
  "varsovia": "Warsaw",
  "viena": "Vienna",
};

// Verified cityscape files from Wikimedia Commons. These are deliberately narrow
// fallbacks for destinations that were returning transparent fallback images.
const CURATED_COMMONS_FILES: Record<string, string> = {
  "taipei": "File:2026 Taipei Skyline.jpg",
  "wellington": "File:Wellington Skyline (34319401232).jpg",
  "oporto": "File:Porto skyline.jpg",
};

type ArticleImage = { title: string };
type ArticlePage = {
  pageid?: number;
  ns?: number;
  title?: string;
  missing?: boolean;
  pageimage?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
  images?: ArticleImage[];
};
type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
  width?: number;
  height?: number;
  thumbwidth?: number;
  thumbheight?: number;
};
type CommonsImagePage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};
type RankedMedia = {
  source: string;
  score: number;
};
type ResolvedCandidate = {
  source: string;
  article: string;
};

function clampDimension(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(48, Math.min(max, Math.round(parsed)));
}

function normalizedSlot(raw: string | null): number {
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? 1 : 0;
}

function folded(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function articleNamesForCity(city: string): string[] {
  const alias = CITY_ARTICLE_ALIASES[folded(city)];
  return alias && folded(alias) !== folded(city) ? [city, alias] : [city];
}

function mediaTitleScore(title: string, city: string, slot: number): number {
  if (REJECT_MEDIA_TITLE.test(title) || /\.svg(?:\?|$)/i.test(title)) return -1000;
  const normalized = folded(title);
  const normalizedCity = folded(city);
  let score = CITY_MEDIA_HINT.test(normalized) ? 8 : 0;
  if (normalized.includes(normalizedCity)) score += 12;

  if (slot === 1) {
    if (LANDMARK_MEDIA_HINT.test(normalized)) score += 30;
    if (/\b(street|architecture|old town|waterfront|marina|bridge|market|garden|park)\b/i.test(normalized)) score += 10;
    if (/\b(skyline|cityscape|panorama|aerial|downtown)\b/i.test(normalized)) score += 3;
    return score;
  }

  if (/\b(skyline|cityscape|panorama|aerial|downtown|waterfront|harbou?r|corniche)\b/i.test(normalized)) score += 16;
  if (/\b(street|architecture|landmark|square|plaza|marina|bridge|old town)\b/i.test(normalized)) score += 7;
  return score;
}

function isUsefulAspect(width?: number, height?: number): boolean {
  if (!width || !height) return true;
  const ratio = width / height;
  return ratio >= 1.08 && ratio <= 3.25;
}

function safeLead(page: ArticlePage): string | null {
  if (!page.pageimage || !page.thumbnail?.source) return null;
  if (REJECT_MEDIA_TITLE.test(page.pageimage) || /\.svg(?:\?|$)/i.test(page.pageimage)) return null;
  if (!isUsefulAspect(page.thumbnail.width, page.thumbnail.height)) return null;
  return page.thumbnail.source;
}

async function exactArticle(language: "es" | "en", city: string, width: number): Promise<ArticlePage | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: city,
    redirects: "1",
    prop: "pageimages|images",
    piprop: "thumbnail|name",
    pithumbsize: String(width),
    imlimit: "100",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`, {
    next: { revalidate: CACHE_SECONDS },
    headers: { Accept: "application/json", "User-Agent": "RoavioProposal/1.0 (exact city article photo resolver)" },
  });
  if (!response.ok) return null;
  const data = await response.json() as { query?: { pages?: ArticlePage[] } };
  return data.query?.pages?.find((candidate) => !candidate.missing && candidate.ns === 0) ?? null;
}

async function imageInfo(titles: string[], width: number, height: number): Promise<Map<string, CommonsImageInfo>> {
  const result = new Map<string, CommonsImageInfo>();
  if (!titles.length) return result;
  for (let start = 0; start < titles.length; start += 40) {
    const batch = titles.slice(start, start + 40);
    const params = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url|mime|size",
      iiurlwidth: String(width),
      iiurlheight: String(height),
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      next: { revalidate: CACHE_SECONDS },
      headers: { Accept: "application/json", "User-Agent": "RoavioProposal/1.0 (city article media resolver)" },
    });
    if (!response.ok) continue;
    const data = await response.json() as { query?: { pages?: CommonsImagePage[] } };
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (page.title && info) result.set(page.title, info);
    }
  }
  return result;
}

async function articleMedia(page: ArticlePage, city: string, width: number, height: number, slot: number): Promise<RankedMedia[]> {
  const scored = (page.images ?? [])
    .map((image) => ({ title: image.title, score: mediaTitleScore(image.title, city, slot) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  const infos = await imageInfo(scored.map((item) => item.title), width, height);
  const media: RankedMedia[] = [];
  for (const item of scored) {
    const info = infos.get(item.title);
    if (!info) continue;
    if (info.mime && !/^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime)) continue;
    if (!isUsefulAspect(info.thumbwidth ?? info.width, info.thumbheight ?? info.height)) continue;
    const source = info.thumburl ?? info.url;
    if (!source || media.some((entry) => entry.source === source)) continue;
    media.push({ source, score: item.score });
  }
  return media;
}

async function resolveImage(city: string, width: number, height: number, slot: number): Promise<ResolvedCandidate | null> {
  if (slot === 0) {
    const curatedTitle = CURATED_COMMONS_FILES[folded(city)];
    if (curatedTitle) {
      try {
        const infos = await imageInfo([curatedTitle], width, height);
        const info = infos.get(curatedTitle) ?? infos.values().next().value;
        const source = info?.thumburl ?? info?.url;
        if (source && (!info?.mime || /^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime))) {
          return { source, article: `commons:${curatedTitle}` };
        }
      } catch {
        // Fall through to the exact article resolver.
      }
    }
  }

  const pages: Array<{ language: "es" | "en"; page: ArticlePage }> = [];
  const seenPageIds = new Set<string>();

  for (const language of ["es", "en"] as const) {
    for (const articleName of articleNamesForCity(city)) {
      try {
        const page = await exactArticle(language, articleName, width);
        if (!page) continue;
        const pageKey = `${language}:${page.pageid ?? page.title ?? articleName}`;
        if (seenPageIds.has(pageKey)) continue;
        seenPageIds.add(pageKey);
        pages.push({ language, page });
        const lead = safeLead(page);
        if (slot === 0 && lead) return { source: lead, article: `${language}:${page.title ?? articleName}` };
      } catch {
        // Try the next deterministic article candidate.
      }
    }
  }

  if (slot === 0) {
    let best: { source: string; score: number; article: string } | null = null;
    for (const { language, page } of pages) {
      try {
        for (const item of await articleMedia(page, city, width, height, 0)) {
          if (!best || item.score > best.score) best = { source: item.source, score: item.score, article: `${language}:${page.title ?? city}` };
        }
      } catch {
        // Keep looking in the other exact article.
      }
    }
    return best ? { source: best.source, article: best.article } : null;
  }

  let secondary: { source: string; score: number; article: string } | null = null;
  let fallbackLead: ResolvedCandidate | null = null;
  for (const { language, page } of pages) {
    const lead = safeLead(page);
    if (!fallbackLead && lead) fallbackLead = { source: lead, article: `${language}:${page.title ?? city}` };
    try {
      for (const item of await articleMedia(page, city, width, height, 1)) {
        if (item.source === lead) continue;
        if (!secondary || item.score > secondary.score) secondary = { source: item.source, score: item.score, article: `${language}:${page.title ?? city}` };
      }
    } catch {
      // The safe lead below remains available as fallback.
    }
  }
  return secondary ? { source: secondary.source, article: secondary.article } : fallbackLead;
}

function responseHeaders(type: string, length: number | null, article: string, width: number, height: number): Headers {
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": `public, max-age=${BROWSER_CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 3}`,
    "CDN-Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    "X-Roavio-Image-Source": article.startsWith("manifest:") ? "materialized media manifest" : "Wikipedia exact city article",
    "X-Roavio-Image-Article": article,
    "X-Roavio-Image-Target": `${width}x${height}`,
  });
  if (length !== null) headers.set("Content-Length", String(length));
  return headers;
}

function fallbackImage(reason: string, width: number, height: number): Response {
  return new Response(TRANSPARENT_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PNG.byteLength),
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      "X-Roavio-Image-Source": "fallback",
      "X-Roavio-Image-Fallback": reason,
      "X-Roavio-Image-Target": `${width}x${height}`,
    },
  });
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return new Response("Missing city", { status: 400 });
  const country = request.nextUrl.searchParams.get("country")?.trim() ?? "";

  const width = clampDimension(request.nextUrl.searchParams.get("width"), 960, 1600);
  const height = clampDimension(request.nextUrl.searchParams.get("height"), Math.round(width * 9 / 16), 1200);
  const slot = normalizedSlot(request.nextUrl.searchParams.get("slot"));
  const resolved = getMaterializedCityPhoto(city, country, slot, width) ?? await resolveImage(city, width, height, slot);
  if (!resolved) return fallbackImage("unresolved-city", width, height);

  try {
    const upstream = await fetchCityPhotoSource(resolved.source);
    if (!upstream.ok) return fallbackImage(`upstream-${upstream.status}`, width, height);

    const rawLength = upstream.headers.get("content-length");
    const length = rawLength ? Number(rawLength) : null;
    if (length !== null && Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
      return fallbackImage("source-too-large", width, height);
    }

    const type = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return fallbackImage("invalid-content-type", width, height);

    if (upstream.body && length !== null && Number.isFinite(length)) {
      return new Response(upstream.body, {
        headers: responseHeaders(type, length, resolved.article, width, height),
      });
    }

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_SOURCE_BYTES) return fallbackImage("source-too-large", width, height);
    return new Response(bytes, {
      headers: responseHeaders(type, bytes.byteLength, resolved.article, width, height),
    });
  } catch {
    return fallbackImage("upstream-error", width, height);
  }
}
