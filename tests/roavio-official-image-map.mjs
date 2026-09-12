import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const mapPath = path.join(root, "app", "roavio", "cityImages.ts");
const source = await readFile(mapPath, "utf8");
const imagePattern = /"([^"]+)"\s*:\s*"(https:\/\/images\.unsplash\.com\/photo-[^"]+)"/g;
const entries = new Map();

for (const match of source.matchAll(imagePattern)) {
  const [, slug, url] = match;
  if (entries.has(slug)) throw new Error(`Duplicate Roavio city image slug: ${slug}`);
  entries.set(slug, url);
}

if (entries.size !== 95) {
  throw new Error(`Expected 95 hand-mapped official Roavio images, found ${entries.size}.`);
}

const expectedAbuDhabi = "https://images.unsplash.com/photo-1741204472540-e213116cb3ef?w=800&q=80";
if (entries.get("abu-dabi") !== expectedAbuDhabi) {
  throw new Error("Abu Dabi no longer points at the exact URL from the official Roavio scrape.");
}

for (const [slug, url] of entries) {
  if (!url.startsWith("https://images.unsplash.com/photo-")) {
    throw new Error(`Non-Unsplash source in official image map for ${slug}: ${url}`);
  }
  if (!url.includes("?w=800&q=80")) {
    throw new Error(`Official Roavio URL parameters changed for ${slug}: ${url}`);
  }
}

const contentRoot = path.join(root, "content", "cities");
const cityDirs = (await readdir(contentRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

const missing = cityDirs.filter((slug) => !entries.has(slug));
if (missing.length) {
  throw new Error(`Cities missing an official Roavio image URL: ${missing.join(", ")}`);
}

const runtimeFiles = [
  "app/roavio/OfficialCityImage.tsx",
  "app/roavio/CityThumb.tsx",
  "app/roavio/CityDossierBackdrop.tsx",
  "app/roavio/CityShowcase.tsx",
];
const banned = ["/city-media/", "/api/city-photo", "/api/city-image", "from \"next/image\""];

for (const relative of runtimeFiles) {
  const text = await readFile(path.join(root, relative), "utf8");
  for (const token of banned) {
    if (text.includes(token)) {
      throw new Error(`${relative} still depends on retired image plumbing: ${token}`);
    }
  }
}

console.log(`Roavio official image map OK: ${entries.size} exact static Unsplash URLs; ${cityDirs.length} content cities covered.`);
