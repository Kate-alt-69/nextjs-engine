import { NextRequest } from "next/server";

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

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

function mediaTitleScore(title: string, city: string): number {
  if (REJECT_MEDIA_TITLE.test(title) || /\.svg(?:\?|$)/i.test(title)) return -1000;
  const normalized = folded(title);
  const normalizedCity = folded(city);
  let score = CITY_MEDIA_HINT.test(normalized) ? 8 : 0;
  if (normalized.includes(normalizedCity)) score += 12;
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

async function articleMedia(page: ArticlePage, city: string, width: number, height: number): Promise<RankedMedia[]> {
  const scored = (page.images ?? [])
    .map((image) => ({ title: image.title, score: mediaTitleScore(image.title, city) }))
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
  const pages: Array<{ language: "es" | "en"; page: ArticlePage }> = [];

  for (const language of ["es", "en"] as const) {
    try {
      const page = await exactArticle(language, city, width);
      if (!page) continue;
      pages.push({ language, page });
      const lead = safeLead(page);
      if (slot === 0 && lead) return { source: lead, article: `${language}:${page.title ?? city}` };
    } catch {
      // Try the next exact-language article only.
    }
  }

  if (slot === 0) {
    let best: { source: string; score: number; article: string } | null = null;
    for (const { language, page } of pages) {
      try {
        for (const item of await articleMedia(page, city, width, height)) {
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
      for (const item of await articleMedia(page, city, width, height)) {
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
    "X-Roavio-Image-Source": "Wikipedia exact city article",
    "X-Roavio-Image-Article": article,
    "X-Roavio-Image-Target": `${width}x${height}`,
  });
  if (length !== null) headers.set("Content-Length", String(length));
  return headers;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return new Response("Missing city", { status: 400 });

  const width = clampDimension(request.nextUrl.searchParams.get("width"), 960, 1600);
  const height = clampDimension(request.nextUrl.searchParams.get("height"), Math.round(width * 9 / 16), 1200);
  const slot = normalizedSlot(request.nextUrl.searchParams.get("slot"));
  const resolved = await resolveImage(city, width, height, slot);
  if (!resolved) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  try {
    const upstream = await fetch(resolved.source, {
      next: { revalidate: CACHE_SECONDS },
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.7", "User-Agent": "RoavioProposal/1.0 (cached verified city photo proxy)" },
    });
    if (!upstream.ok) return new Response(null, { status: 404 });

    const rawLength = upstream.headers.get("content-length");
    const length = rawLength ? Number(rawLength) : null;
    if (length !== null && Number.isFinite(length) && length > MAX_SOURCE_BYTES) {
      return new Response(null, { status: 413 });
    }

    const type = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return new Response(null, { status: 415 });

    // Width-bounded Wikimedia thumbnails normally expose Content-Length. Stream
    // those directly so cards can start decoding while the remaining bytes are
    // still arriving instead of waiting for an ArrayBuffer of the whole image.
    if (upstream.body && length !== null && Number.isFinite(length)) {
      return new Response(upstream.body, {
        headers: responseHeaders(type, length, resolved.article, width, height),
      });
    }

    // Unknown-length responses retain the hard byte ceiling before they are
    // returned. This path is uncommon but keeps the proxy bounded defensively.
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_SOURCE_BYTES) return new Response(null, { status: 413 });
    return new Response(bytes, {
      headers: responseHeaders(type, bytes.byteLength, resolved.article, width, height),
    });
  } catch {
    return new Response(null, { status: 502, headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" } });
  }
}
