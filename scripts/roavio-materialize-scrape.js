const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = process.cwd();
const snapshotPath = path.join(root, "content", "cities", ".scrape", "mapped-v2.br.b64");
const outputDir = path.join(root, "content", "cities");
const force = process.argv.includes("--force");

function readSnapshot() {
  const encoded = fs.readFileSync(snapshotPath, "utf8").replace(/\s+/g, "");
  const compressed = Buffer.from(encoded, "base64");
  const json = zlib.brotliDecompressSync(compressed).toString("utf8");
  const entries = JSON.parse(json);

  if (!Array.isArray(entries) || entries.length !== 90) {
    throw new Error(`[roavio] mapped snapshot must contain exactly 90 city profiles; got ${Array.isArray(entries) ? entries.length : "non-array"}`);
  }

  const slugs = new Set();
  for (const entry of entries) {
    const profile = entry?.profile;
    if (!profile || profile.schemaVersion !== 1 || typeof profile.slug !== "string" || !profile.slug) {
      throw new Error("[roavio] invalid mapped city profile in snapshot");
    }
    if (slugs.has(profile.slug)) throw new Error(`[roavio] duplicate city slug: ${profile.slug}`);
    slugs.add(profile.slug);
    if (typeof entry.guide !== "string" || !entry.guide.trim()) {
      throw new Error(`[roavio] ${profile.slug}: mapped guide is missing`);
    }
  }

  return entries;
}

function writeFile(filePath, content) {
  if (!force && fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

const entries = readSnapshot();
let filesWritten = 0;
let deepGuides = 0;

for (const { profile, guide } of entries) {
  const cityDir = path.join(outputDir, profile.slug);
  fs.mkdirSync(cityDir, { recursive: true });

  const cityJson = `${JSON.stringify(profile, null, 2)}\n`;
  const guideMarkdown = `${guide.trim()}\n`;

  if (writeFile(path.join(cityDir, "city.json"), cityJson)) filesWritten += 1;
  if (writeFile(path.join(cityDir, "guide.md"), guideMarkdown)) filesWritten += 1;
  if (profile.hasDeepGuide === true) deepGuides += 1;
}

console.log(`[roavio] verified ${entries.length} mapped city profiles.`);
console.log(`[roavio] ${deepGuides} cities include deep visa/healthcare/neighborhood editorial sections.`);
console.log(`[roavio] wrote ${filesWritten} content files${force ? " (forced refresh)" : ""}.`);
