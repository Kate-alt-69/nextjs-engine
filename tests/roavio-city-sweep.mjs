import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = (process.env.ROAVIO_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const contentRoot = path.resolve(process.cwd(), "content/cities");
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

  const cities = [];
  for (const slug of slugs) {
    const raw = await readFile(path.join(contentRoot, slug, "city.json"), "utf8");
    const city = JSON.parse(raw);
    cities.push({ slug, city: city.name, country: city.country });
  }
  return cities;
}

function photoUrl(city, slot) {
  const params = new URLSearchParams({
    city: city.city,
    country: city.country,
    slot: String(slot),
    width: "960",
    height: "540",
    v: "sweep-1",
  });
  return `${baseUrl}/api/city-photo?${params.toString()}`;
}

async function inspectPhoto(city, slot) {
  const { response, ms, attempt } = await request(photoUrl(city, slot), { attempts: 2 });
  const type = response.headers.get("content-type") || "";
  const source = response.headers.get("x-roavio-image-source") || "";
  const fallback = response.headers.get("x-roavio-image-fallback") || "";
  const article = response.headers.get("x-roavio-image-article") || "";
  const lengthHeader = response.headers.get("content-length");
  const declaredLength = lengthHeader ? Number(lengthHeader) : null;

  if (!response.ok) {
    return { ok: false, kind: `photo-${slot}`, city, reason: `HTTP ${response.status}`, ms, attempt, source, fallback, article };
  }
  if (!type.startsWith("image/")) {
    return { ok: false, kind: `photo-${slot}`, city, reason: `invalid content-type ${type || "<missing>"}`, ms, attempt, source, fallback, article };
  }
  if (source === "fallback" || fallback) {
    return { ok: false, kind: `photo-${slot}`, city, reason: `fallback:${fallback || "unknown"}`, ms, attempt, source, fallback, article };
  }
  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength < 500) {
    return { ok: false, kind: `photo-${slot}`, city, reason: `suspiciously small image (${declaredLength} bytes)`, ms, attempt, source, fallback, article };
  }

  // Drain a tiny prefix so streamed upstream responses are actually exercised without
  // forcing CI to retain 180 full-resolution images in memory.
  const reader = response.body?.getReader();
  if (reader) {
    try { await reader.read(); } finally { await reader.cancel().catch(() => {}); }
  }

  return { ok: true, kind: `photo-${slot}`, city, ms, attempt, source, article };
}

async function inspectCity(city) {
  const route = await request(`${baseUrl}/cities/${encodeURIComponent(city.slug)}`);
  if (!route.response.ok) {
    return [{ ok: false, kind: "route", city, reason: `HTTP ${route.response.status}`, ms: route.ms, attempt: route.attempt }];
  }

  const [primary, secondary] = await Promise.all([
    inspectPhoto(city, 0),
    inspectPhoto(city, 1),
  ]);
  return [
    { ok: true, kind: "route", city, ms: route.ms, attempt: route.attempt },
    primary,
    secondary,
  ];
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
if (cities.length !== 90) {
  console.error(`Expected exactly 90 materialized cities, found ${cities.length}.`);
  process.exit(1);
}

console.log(`Sweeping ${cities.length} Roavio city routes + ${cities.length * 2} photo slots at concurrency ${concurrency}...`);
const nested = await mapLimit(cities, concurrency, async (city, index) => {
  const results = await inspectCity(city);
  const failures = results.filter((item) => !item.ok);
  const slowest = Math.max(...results.map((item) => item.ms || 0));
  console.log(`${String(index + 1).padStart(2, "0")}/90 ${city.slug.padEnd(22)} ${failures.length ? "FAIL" : "ok  "} ${slowest}ms`);
  return results;
});

const results = nested.flat();
const failures = results.filter((item) => !item.ok);
const photoResults = results.filter((item) => item.kind.startsWith("photo-"));
const slowPhotos = photoResults
  .filter((item) => item.ok)
  .sort((a, b) => b.ms - a.ms)
  .slice(0, 12);

console.log(`\nSweep summary: ${results.length - failures.length}/${results.length} checks passed.`);
console.log(`Routes: ${results.filter((item) => item.kind === "route" && item.ok).length}/90`);
console.log(`Photos: ${photoResults.filter((item) => item.ok).length}/180`);

if (slowPhotos.length) {
  console.log("\nSlowest successful photo resolutions:");
  for (const item of slowPhotos) {
    console.log(`  ${item.city.slug} ${item.kind} ${item.ms}ms ${item.article || item.source || ""}`);
  }
}

if (failures.length) {
  console.error("\nFailures:");
  for (const item of failures) {
    console.error(`  ${item.city.slug} (${item.city.city}, ${item.city.country}) ${item.kind}: ${item.reason}${item.article ? ` [${item.article}]` : ""}`);
  }
  process.exit(1);
}

console.log("\nAll 90 city routes and both media slots resolved without fallback images. ✅");
