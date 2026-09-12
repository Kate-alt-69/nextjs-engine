import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.ROAVIO_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const contentRoot = path.resolve(process.cwd(), "content/cities");
const mediaManifestPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const concurrency = Math.max(1, Math.min(6, Number(process.env.ROAVIO_SWEEP_CONCURRENCY || 3)));
const timeoutMs = Math.max(5_000, Number(process.env.ROAVIO_SWEEP_TIMEOUT_MS || 18_000));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, { attempts = 2 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
      clearTimeout(timer);
      return { response, ms: Date.now() - started, attempt };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts) await sleep(250 * attempt);
    }
  }
  throw lastError;
}

async function loadCities() {
  const entries = await readdir(contentRoot, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "_template" && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  const mediaManifest = JSON.parse(await readFile(mediaManifestPath, "utf8"));
  const mediaCities = mediaManifest?.cities ?? {};

  const cities = [];
  for (const slug of slugs) {
    const raw = await readFile(path.join(contentRoot, slug, "city.json"), "utf8");
    const city = JSON.parse(raw);
    const media = mediaCities[slug];
    if (!media?.primary || !media?.secondary) {
      throw new Error(`Missing bundled media manifest entry for ${slug}`);
    }

    const expectedPrimary = `/city-media/${slug}-0.jpg`;
    const expectedSecondary = `/city-media/${slug}-1.jpg`;
    if (media.primary !== expectedPrimary || media.secondary !== expectedSecondary) {
      throw new Error(`UI/bundle media path mismatch for ${slug}: expected ${expectedPrimary} + ${expectedSecondary}, got ${media.primary} + ${media.secondary}`);
    }

    cities.push({ slug, city: city.name, country: city.country, primary: media.primary, secondary: media.secondary });
  }
  return cities;
}

function apiPhotoUrl(city, slot) {
  const params = new URLSearchParams({ city: city.city, country: city.country, slot: String(slot), width: "960", height: "540", v: "sweep-api" });
  return `${baseUrl}/api/city-photo?${params.toString()}`;
}

function staticPhotoUrl(city, slot) {
  const source = slot > 0 ? city.secondary : city.primary;
  return `${baseUrl}${source}?v=sweep-browser`;
}

function optimizerPhotoUrl(city) {
  const params = new URLSearchParams({ url: `${city.primary}?v=sweep-browser`, w: "640", q: "58" });
  return `${baseUrl}/_next/image?${params.toString()}`;
}

async function drainPrefix(response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  try { await reader.read(); } finally { await reader.cancel().catch(() => {}); }
}

function validateImageResponse(response, { kind, city, ms, attempt, source = "", fallback = "", article = "" }) {
  const type = response.headers.get("content-type") || "";
  const lengthHeader = response.headers.get("content-length");
  const declaredLength = lengthHeader ? Number(lengthHeader) : null;
  if (!response.ok) return { ok: false, kind, city, reason: `HTTP ${response.status}`, ms, attempt, source, fallback, article };
  if (!type.startsWith("image/")) return { ok: false, kind, city, reason: `invalid content-type ${type || "<missing>"}`, ms, attempt, source, fallback, article };
  if (source === "fallback" || fallback) return { ok: false, kind, city, reason: `fallback:${fallback || "unknown"}`, ms, attempt, source, fallback, article };
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength < 500) return { ok: false, kind, city, reason: `suspiciously small image (${declaredLength} bytes)`, ms, attempt, source, fallback, article };
  return { ok: true, kind, city, ms, attempt, source, article };
}

async function inspectApiPhoto(city, slot) {
  const { response, ms, attempt } = await request(apiPhotoUrl(city, slot), { attempts: 2 });
  const source = response.headers.get("x-roavio-image-source") || "";
  const fallback = response.headers.get("x-roavio-image-fallback") || "";
  const article = response.headers.get("x-roavio-image-article") || "";
  const result = validateImageResponse(response, { kind: `api-photo-${slot}`, city, ms, attempt, source, fallback, article });
  if (result.ok) await drainPrefix(response);
  return result;
}

async function inspectStaticPhoto(city, slot) {
  const { response, ms, attempt } = await request(staticPhotoUrl(city, slot), { attempts: 2 });
  const result = validateImageResponse(response, { kind: `static-photo-${slot}`, city, ms, attempt, article: slot > 0 ? city.secondary : city.primary });
  if (result.ok) await drainPrefix(response);
  return result;
}

async function inspectOptimizerPhoto(city) {
  const { response, ms, attempt } = await request(optimizerPhotoUrl(city), { attempts: 2 });
  const result = validateImageResponse(response, { kind: "optimizer-photo-0", city, ms, attempt, article: city.primary });
  if (result.ok) await drainPrefix(response);
  return result;
}

async function inspectCity(city) {
  const route = await request(`${baseUrl}/cities/${encodeURIComponent(city.slug)}`);
  const routeResult = route.response.ok ? { ok: true, kind: "route", city, ms: route.ms, attempt: route.attempt } : { ok: false, kind: "route", city, reason: `HTTP ${route.response.status}`, ms: route.ms, attempt: route.attempt };
  const [apiPrimary, apiSecondary, staticPrimary, staticSecondary, optimizedPrimary] = await Promise.all([
    inspectApiPhoto(city, 0), inspectApiPhoto(city, 1), inspectStaticPhoto(city, 0), inspectStaticPhoto(city, 1), inspectOptimizerPhoto(city),
  ]);
  return [routeResult, apiPrimary, apiSecondary, staticPrimary, staticSecondary, optimizedPrimary];
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

const cities = await loadCities();
if (cities.length !== 95) {
  console.error(`Expected exactly 95 materialized cities, found ${cities.length}.`);
  process.exit(1);
}

console.log(`Sweeping ${cities.length} Roavio routes + API media + static media + optimized primary cards at concurrency ${concurrency}...`);
const nested = await mapLimit(cities, concurrency, async (city, index) => {
  const results = await inspectCity(city);
  const failures = results.filter((item) => !item.ok);
  const slowest = Math.max(...results.map((item) => item.ms || 0));
  console.log(`${String(index + 1).padStart(2, "0")}/95 ${city.slug.padEnd(22)} ${failures.length ? "FAIL" : "ok  "} ${slowest}ms`);
  return results;
});

const results = nested.flat();
const failures = results.filter((item) => !item.ok);
const apiPhotos = results.filter((item) => item.kind.startsWith("api-photo-"));
const staticPhotos = results.filter((item) => item.kind.startsWith("static-photo-"));
const optimizedPhotos = results.filter((item) => item.kind === "optimizer-photo-0");
const slowPhotos = [...apiPhotos, ...optimizedPhotos].filter((item) => item.ok).sort((a, b) => b.ms - a.ms);

if (failures.length) {
  console.error(`\n${failures.length} sweep checks failed:`);
  for (const failure of failures) console.error(`- ${failure.kind} ${failure.city.slug}: ${failure.reason}`);
  process.exit(1);
}

console.log(`\n95 routes + ${apiPhotos.length} API photo checks + ${staticPhotos.length} static photo checks + ${optimizedPhotos.length} optimized primary checks passed. ✅`);
console.log("Slowest image checks:");
for (const item of slowPhotos.slice(0, 12)) console.log(`- ${item.kind} ${item.city.slug}: ${item.ms}ms`);
