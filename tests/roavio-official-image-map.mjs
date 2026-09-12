import { access, readdir, readFile } from "node:fs/promises";
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

async function sourceFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...await sourceFiles(absolute));
    } else if (/\.(?:ts|tsx|js|jsx|css)$/.test(entry.name)) {
      output.push(absolute);
    }
  }
  return output;
}

const roavioRoot = path.join(root, "app", "roavio");
const retiredTokens = [
  "/city-media/",
  "/api/city-photo",
  "/api/city-image",
  "cityMedia.server",
  "ROAVIO_MEDIA_VERSION",
  "from \"next/image\"",
  "from 'next/image'",
];

for (const absolute of await sourceFiles(roavioRoot)) {
  const text = await readFile(absolute, "utf8");
  for (const token of retiredTokens) {
    if (text.includes(token)) {
      throw new Error(`${path.relative(root, absolute)} still depends on retired image plumbing: ${token}`);
    }
  }
}

const retiredPaths = [
  "app/api/city-photo",
  "app/api/city-image",
  "app/roavio/cityMedia.server.ts",
  "app/roavio/city-media.generated.json",
  "app/roavio/official-city-images.generated.json",
  "public/city-media",
];

for (const relative of retiredPaths) {
  try {
    await access(path.join(root, relative));
    throw new Error(`Retired Roavio image path still exists: ${relative}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Retired Roavio image path")) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(`Roavio official image map OK: ${entries.size} exact static Unsplash URLs; ${cityDirs.length} content cities covered; retired media pipeline absent.`);
