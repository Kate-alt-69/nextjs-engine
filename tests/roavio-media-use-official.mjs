import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const officialPath = path.resolve(process.cwd(), "app/roavio/official-city-images.generated.json");

const [manifest, official] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(officialPath, "utf8").then(JSON.parse),
]);

const entries = Object.entries(manifest.cities || {});
if (!entries.length) throw new Error("City media manifest is empty");

for (const [slug, entry] of entries) {
  const officialPrimary = official.cities?.[slug];
  if (typeof officialPrimary !== "string" || !officialPrimary.startsWith("https://images.unsplash.com/")) {
    throw new Error(`Missing official Roavio primary image for ${slug}`);
  }

  const secondaryRemote = typeof entry.secondarySource === "string" && entry.secondarySource.startsWith("https://")
    ? entry.secondarySource
    : typeof entry.secondary === "string" && entry.secondary.startsWith("https://")
      ? entry.secondary
      : null;
  if (!secondaryRemote) throw new Error(`Missing remote secondary image source for ${slug}`);

  entry.primary = officialPrimary;
  entry.primaryTitle = "Roavio official city image";
  entry.secondary = secondaryRemote;
  delete entry.primaryBytes;
  delete entry.secondaryBytes;
}

manifest.version = 5;
manifest.generatedAt = new Date().toISOString();
manifest.qualityPolicy = "roavio-official-primary+destination-secondary-v1";
delete manifest.bundledAt;
delete manifest.delivery;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Applied ${entries.length} official Roavio primary images; preserved audited secondary scenes. ✅`);
