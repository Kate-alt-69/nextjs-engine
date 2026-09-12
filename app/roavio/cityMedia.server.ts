import { readFile } from "node:fs/promises";
import path from "node:path";
import { EngineAPIResolver } from "@/engine";
import mediaManifest from "./city-media.generated.json";

type MediaEntry = {
  city: string;
  country: string;
  primary: string;
  secondary: string;
  primaryTitle?: string | null;
  secondaryTitle?: string | null;
};

const mediaResolver = new EngineAPIResolver({
  method: "GET",
  cache: "force-cache",
  auth: { type: "none" },
  headers: {
    Accept: "image/avif,image/webp,image/*,*/*;q=0.7",
    "User-Agent": "RoavioProposal/1.0 (materialized city media via EngineAPIResolver)",
  },
});

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const byCity = new Map<string, [string, MediaEntry]>();
for (const [slug, entry] of Object.entries(mediaManifest.cities as Record<string, MediaEntry>)) {
  byCity.set(`${fold(entry.city)}|${fold(entry.country)}`, [slug, entry]);
  const cityOnly = `${fold(entry.city)}|`;
  if (!byCity.has(cityOnly)) byCity.set(cityOnly, [slug, entry]);
}

function resizedWikimediaThumb(source: string, width: number): string {
  if (!source.includes("wikimedia.org") || !source.includes("/thumb/")) return source;
  const bounded = Math.max(320, Math.min(1600, Math.round(width)));
  return source.replace(/\/\d+px-([^/?]+)(\?.*)?$/, `/${bounded}px-$1$2`);
}

function localMediaType(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

async function readBundledMedia(source: string): Promise<Response> {
  const relative = source.replace(/^\/+/, "");
  if (!relative.startsWith("city-media/")) throw new Error("Unsupported local media path");

  const mediaRoot = path.resolve(process.cwd(), "public", "city-media");
  const absolute = path.resolve(process.cwd(), "public", relative);
  if (absolute !== mediaRoot && !absolute.startsWith(`${mediaRoot}${path.sep}`)) {
    throw new Error("Invalid local media path");
  }

  const bytes = await readFile(absolute);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": localMediaType(absolute),
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export function getMaterializedCityPhoto(
  city: string,
  country: string,
  slot: number,
  width: number,
): { source: string; article: string } | null {
  const found = byCity.get(`${fold(city)}|${fold(country)}`) ?? byCity.get(`${fold(city)}|`);
  if (!found) return null;

  const [slug, entry] = found;
  const source = slot > 0 ? entry.secondary : entry.primary;
  if (!source) return null;

  return {
    source: source.startsWith("/") ? source : resizedWikimediaThumb(source, width),
    article: `manifest:${slug}:${slot > 0 ? "secondary" : "primary"}`,
  };
}

export function fetchCityPhotoSource(source: string): Promise<Response> {
  if (source.startsWith("/city-media/")) return readBundledMedia(source);
  return mediaResolver.resolveRequest({ nodeOverrides: { endpoint: source } });
}
