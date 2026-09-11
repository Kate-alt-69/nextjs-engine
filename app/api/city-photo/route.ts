import { NextRequest } from "next/server";

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const BROWSER_CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const REJECT_TITLE = /\b(flag|map|locator|location|seal|coat of arms|logo|icon|diagram|route|metro|subway|districts?|boroughs?)\b/i;

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string; thumbwidth?: number; thumbheight?: number }>;
};

type WikipediaPage = {
  title?: string;
  thumbnail?: { source?: string };
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

async function commonsImages(city: string, country: string, width: number): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${city} ${country} city skyline architecture`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: String(width),
    format: "json",
    formatversion: "2",
    origin: "*",
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    next: { revalidate: CACHE_SECONDS },
    headers: {
      Accept: "application/json",
      "User-Agent": "RoavioProposal/1.0 (city photo resolver)",
    },
  });
  if (!response.ok) return [];

  const data = await response.json() as { query?: { pages?: CommonsPage[] } };
  const pages = data.query?.pages ?? [];
  return pages
    .filter((page) => !REJECT_TITLE.test(page.title ?? ""))
    .map((page) => page.imageinfo?.[0])
    .filter((info): info is NonNullable<CommonsPage["imageinfo"]>[number] => Boolean(info))
    .filter((info) => !info.mime || /^image\/(?:jpeg|png|webp|avif)$/i.test(info.mime))
    .map((info) => info.thumburl ?? info.url ?? "")
    .filter(Boolean);
}

async function wikipediaImage(city: string, country: string, width: number): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${city} ${country}`,
    gsrnamespace: "0",
    gsrlimit: "3",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: String(width),
    format: "json",
    formatversion: "2",
    origin: "*",
  });

  for (const language of ["en", "es"] as const) {
    const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`, {
      next: { revalidate: CACHE_SECONDS },
      headers: {
        Accept: "application/json",
        "User-Agent": "RoavioProposal/1.0 (city photo resolver)",
      },
    });
    if (!response.ok) continue;
    const data = await response.json() as { query?: { pages?: WikipediaPage[] } };
    const page = (data.query?.pages ?? []).find((candidate) => candidate.thumbnail?.source && !REJECT_TITLE.test(candidate.title ?? ""));
    if (page?.thumbnail?.source) return page.thumbnail.source;
  }
  return null;
}

async function resolveImage(city: string, country: string, width: number, slot: number): Promise<string | null> {
  try {
    const candidates = await commonsImages(city, country, width);
    if (candidates.length > slot) return candidates[slot] ?? null;
    if (candidates.length > 0) return candidates[0] ?? null;
  } catch {
    // Wikipedia remains a deliberately conservative fallback.
  }
  try {
    return await wikipediaImage(city, country, width);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city")?.trim();
  const country = request.nextUrl.searchParams.get("country")?.trim() ?? "";
  if (!city) return new Response("Missing city", { status: 400 });

  const width = clampWidth(request.nextUrl.searchParams.get("width"));
  const slot = normalizedSlot(request.nextUrl.searchParams.get("slot"));
  const source = await resolveImage(city, country, width, slot);
  if (!source) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  try {
    const upstream = await fetch(source, {
      next: { revalidate: CACHE_SECONDS },
      headers: {
        Accept: "image/avif,image/webp,image/*,*/*;q=0.7",
        "User-Agent": "RoavioProposal/1.0 (cached city photo proxy)",
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
        "X-Roavio-Image-Source": "Wikimedia",
      },
    });
  } catch {
    return new Response(null, {
      status: 502,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" },
    });
  }
}
