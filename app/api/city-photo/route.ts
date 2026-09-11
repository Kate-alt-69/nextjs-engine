import { NextRequest } from "next/server";

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

// Arbitrary Commons search turned out to be much too loose for a destination
// product: a city name can appear on portraits, sporting events, maps, etc.
// Only media attached to the city's own Wikipedia article is considered now.
const REJECT_MEDIA_TITLE = /\b(flag|map|locator|location|seal|coat[ _-]?of[ _-]?arms|logo|icon|diagram|route|metro|subway|districts?|boroughs?|portrait|player|athlete|politician|mayor|president|football|rugby|cricket|marathon|runner|race|team|jersey|medal|election|signature)\b/i;
const CITY_MEDIA_HINT = /\b(skyline|cityscape|panorama|panoramic|aerial|downtown|waterfront|harbou?r|corniche|street|avenue|boulevard|old[ _-]?town|centre|center|architecture|tower|towers|landmark|mosque|cathedral|temple|palace|square|plaza|bay|beach|marina|river|bridge|night|city|urban)\b/i;

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

function clampWidth(raw: string | null): number {
  const parsed = Number(raw ?? 960);
  if (!Number.isFinite(parsed)) return 960;
  return Math.max(48, Math.min(1600, Math.round(parsed)));
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

function mediaTitleScore(title: string, city: string): number {
  if (REJECT_MEDIA_TITLE.test(title)) return -1000;
  const normalized = folded(title);
  const normalizedCity = folded(city);
  let score = CITY_MEDIA_HINT.test(normalized) ? 8 : 0;
  if (normalized.includes(normalizedCity)) score += 12;
  if (/\b(skyline|cityscape|panorama|aerial|downtown|waterfront|harbou?r|corniche)\b/i.test(normalized)) score += 8;
  if (/\b(street|architecture|landmark|square|plaza|marina|bridge|old town)\b/i.test(normalized)) score += 4;
  return score;
}

function isUsefulAspect(width?: number, height?: number): boolean {
  if (!width || !height) return true;
  const ratio = width / height;
  // Destination cards are landscape. Reject obvious portraits and very wide
  // diagrams/banners even when their filename looks innocent.
  return ratio >= 1.08 && ratio <= 3.25;
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
    headers: {
      Accept: "application/json",
      "User-Agent": "RoavioProposal/1.0 (exact city article photo resolver)",
    },
  });
  if (!response.ok) return null;

  const data = await response.json() as { query?: { pages?: ArticlePage[] } };
  const page = data.query?.pages?.find((candidate) => !candidate.missing && candidate.ns === 0);
  return page ?? null;
}

async function imageInfo(titles: string[], width: number): Promise<Map<string, CommonsImageInfo>> {
  const result = new Map<string, CommonsImageInfo>();
  if (!titles.length) return result;

  // MediaWiki's titles parameter is intentionally chunked below its API limit.
  for (let start = 0; start < titles.length; start += 40) {
    const batch = titles.slice(start, start + 40);
    const params = new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url|mime|size",
      iiurlwidth: String(width),
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      next: { revalidate: CACHE_SECONDS },
      headers: {
        Accept: "application/json",
        "User-Agent": "RoavioProposal/1.0 (city article media resolver)",
      },
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

async function articleMedia(page: ArticlePage, city: string, width: number): Promise<string[]> {
  const scored = (page.images ?? [])
    .map((image) => ({ title: image.title, score: mediaTitleScore(image.title, city) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const infos = await imageInfo(scored.map((item) => item.title), width);
  const urls: string[] = [];
  for (const item of scored) {
    const info = infos.get(item.title);
    if (!info) continue;
    if (info.mime && !/^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime)) continue;
    if (!isUsefulAspect(info.thumbwidth ?? info.width, info.thumbheight ?? info.height)) continue;
    const url = info.thumburl ?? info.url;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

async function resolveFromArticle(page: ArticlePage, city: string, width: number, slot: number): Promise<string | null> {
  const pageImageSafe = page.pageimage
    ? !REJECT_MEDIA_TITLE.test(page.pageimage) && !/\.svg(?:\?|$)/i.test(page.pageimage)
    : false;
  const thumbnailSafe = Boolean(
    pageImageSafe &&
    page.thumbnail?.source &&
    isUsefulAspect(page.thumbnail.width, page.thumbnail.height),
  );
  const lead = thumbnailSafe ? page.thumbnail!.source! : null;
  const media = await articleMedia(page, city, width);

  if (slot === 0) return lead ?? media[0] ?? null;

  // A second city image is only used when it comes from the same city article.
  // If no trustworthy second image exists, reusing the verified lead image is
  // intentionally better than displaying unrelated search-result media.
  const secondary = media.find((url) => url !== lead);
  return secondary ?? lead ?? media[0] ?? null;
}

async function resolveImage(city: string, width: number, slot: number): Promise<{ source: string; article: string } | null> {
  // The catalog uses Spanish-facing city names, so Spanish Wikipedia is the
  // most reliable exact-title source. English is a safe exact-title fallback.
  for (const language of ["es", "en"] as const) {
    try {
      const page = await exactArticle(language, city, width);
      if (!page) continue;
      const source = await resolveFromArticle(page, city, width, slot);
      if (source) return { source, article: `${language}:${page.title ?? city}` };
    } catch {
      // Try the next exact-language article; never fall back to arbitrary search.
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return new Response("Missing city", { status: 400 });

  const width = clampWidth(request.nextUrl.searchParams.get("width"));
  const slot = normalizedSlot(request.nextUrl.searchParams.get("slot"));
  const resolved = await resolveImage(city, width, slot);
  if (!resolved) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  try {
    const upstream = await fetch(resolved.source, {
      next: { revalidate: CACHE_SECONDS },
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.7",
        "User-Agent": "RoavioProposal/1.0 (cached verified city photo proxy)",
      },
    });
    if (!upstream.ok) return new Response(null, { status: 404 });

    const length = Number(upstream.headers.get("content-length") ?? 0);
    if (length > MAX_SOURCE_BYTES) return new Response(null, { status: 413 });
    const type = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return new Response(null, { status: 415 });

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_SOURCE_BYTES) return new Response(null, { status: 413 });

    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": `public, max-age=${BROWSER_CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 3}`,
        "CDN-Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        "X-Roavio-Image-Source": "Wikipedia exact city article",
        "X-Roavio-Image-Article": resolved.article,
      },
    });
  } catch {
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" },
    });
  }
}
