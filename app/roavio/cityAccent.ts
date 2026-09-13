"use client";

import { EngineBrowser, EngineScheduler } from "@/engine";
import { getRoavioCityImage } from "./cityImages";

export interface RoavioCityAccent {
  /** Space-separated RGB channel values, ready for `rgb(var(--x) / alpha)`. */
  rgb: string;
  hex: string;
}

const ACCENT_CACHE_KEY = "roavio-proposal-city-accents-v1";
const SAMPLE_SIZE = 28;
const memoryCache = new Map<string, RoavioCityAccent>();
const inflight = new Map<string, Promise<RoavioCityAccent>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function necessaryConsentEnabled(): boolean {
  if (typeof document === "undefined") return false;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rv_consent="));
  if (!raw) return false;
  try {
    const decoded = decodeURIComponent(raw.slice("rv_consent=".length));
    return (JSON.parse(decoded) as { necessary?: boolean }).necessary === true;
  } catch {
    return false;
  }
}

function readPersistentCache(): Record<string, RoavioCityAccent> {
  if (typeof window === "undefined" || !necessaryConsentEnabled()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCENT_CACHE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, RoavioCityAccent> : {};
  } catch {
    return {};
  }
}

function persistAccent(slug: string, accent: RoavioCityAccent): void {
  if (typeof window === "undefined" || !necessaryConsentEnabled()) return;
  try {
    const cache = readPersistentCache();
    cache[slug] = accent;
    window.localStorage.setItem(ACCENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Accent persistence is an optimization only; rendering must never depend on storage.
  }
}

export function peekRoavioCityAccent(slug: string): RoavioCityAccent | null {
  const memory = memoryCache.get(slug);
  if (memory) return memory;
  const persisted = readPersistentCache()[slug];
  if (!persisted || typeof persisted.rgb !== "string" || typeof persisted.hex !== "string") return null;
  memoryCache.set(slug, persisted);
  return persisted;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return [hue, saturation, lightness];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (segment < 1) [rp, gp, bp] = [chroma, x, 0];
  else if (segment < 2) [rp, gp, bp] = [x, chroma, 0];
  else if (segment < 3) [rp, gp, bp] = [0, chroma, x];
  else if (segment < 4) [rp, gp, bp] = [0, x, chroma];
  else if (segment < 5) [rp, gp, bp] = [x, 0, chroma];
  else [rp, gp, bp] = [chroma, 0, x];
  const m = l - chroma / 2;
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

function toAccent(r: number, g: number, b: number): RoavioCityAccent {
  const [h, s, l] = rgbToHsl(r, g, b);
  // Keep the hue from the photograph, but normalize saturation/lightness so the
  // accent remains tasteful and readable in both Roavio themes.
  const [rr, gg, bb] = hslToRgb(h, clamp(s * 1.08, 0.42, 0.76), clamp(l, 0.42, 0.62));
  const hex = `#${[rr, gg, bb].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return { rgb: `${rr} ${gg} ${bb}`, hex };
}

function fallbackAccent(slug: string): RoavioCityAccent {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((hash >>> 0) % 96) + 142; // green → cyan → blue fallback family
  const [r, g, b] = hslToRgb(hue, 0.48, 0.48);
  return toAccent(r, g, b);
}

function analyzePixels(data: Uint8ClampedArray, slug: string): RoavioCityAccent {
  const buckets = Array.from({ length: 24 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 210) continue;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const [hue, saturation, lightness] = rgbToHsl(r, g, b);
    if (saturation < 0.16 || lightness < 0.09 || lightness > 0.92) continue;

    // Saturated mid-tones make better UI accents than sky-white highlights,
    // charcoal shadows, or large gray buildings.
    const midtone = 1 - Math.min(1, Math.abs(lightness - 0.5) / 0.5);
    const weight = (0.25 + saturation * 1.8) * (0.45 + midtone * 0.9);
    const bucket = buckets[Math.floor(hue / 15) % buckets.length];
    bucket.weight += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
  }

  const best = buckets.reduce((winner, candidate) => candidate.weight > winner.weight ? candidate : winner, buckets[0]);
  if (!best || best.weight <= 0) return fallbackAccent(slug);
  return toAccent(best.r / best.weight, best.g / best.weight, best.b / best.weight);
}

function samplingUrl(src: string): string {
  try {
    const url = new URL(src);
    // This is intentionally tiny. The full city image has already been requested
    // by EngineImage; the palette probe only needs enough pixels to find a hue.
    url.searchParams.set("w", "72");
    url.searchParams.set("q", "45");
    url.searchParams.set("fm", "jpg");
    return url.toString();
  } catch {
    return src;
  }
}

async function decodeToPixels(src: string): Promise<Uint8ClampedArray> {
  const response = await fetch(samplingUrl(src), {
    mode: "cors",
    credentials: "omit",
    cache: "force-cache",
  });
  if (!response.ok) throw new Error(`Accent sample request failed (${response.status})`);
  const blob = await response.blob();
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D unavailable");

  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(blob);
    try {
      context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    } finally {
      bitmap.close();
    }
  } else {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Accent image decode failed"));
      });
      context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
}

function networkAllowsSampling(): boolean {
  const network = EngineBrowser.network.status();
  if (!network.online || network.saveData) return false;
  if (network.type === "slow-2g" || network.type === "2g") return false;
  return true;
}

export function resolveRoavioCityAccent(slug: string): Promise<RoavioCityAccent> {
  const cached = peekRoavioCityAccent(slug);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(slug);
  if (existing) return existing;

  const src = getRoavioCityImage(slug);
  if (!src || typeof window === "undefined" || !networkAllowsSampling()) {
    return Promise.resolve(fallbackAccent(slug));
  }

  const promise = new Promise<RoavioCityAccent>((resolve) => {
    EngineScheduler.runWhenIdle(() => {
      void decodeToPixels(src)
        .then((pixels) => analyzePixels(pixels, slug))
        .catch(() => fallbackAccent(slug))
        .then((accent) => {
          memoryCache.set(slug, accent);
          persistAccent(slug, accent);
          resolve(accent);
        })
        .finally(() => inflight.delete(slug));
    }, 900);
  });

  inflight.set(slug, promise);
  return promise;
}
