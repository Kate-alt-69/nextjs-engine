const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = process.cwd();
const snapshotDir = path.join(root, "content", "cities", ".scrape");
const outputDir = path.join(root, "content", "cities");
const force = process.argv.includes("--force");

function readSnapshot() {
  const parts = fs.readdirSync(snapshotDir)
    .filter((name) => /^part-\d+\.b64$/.test(name))
    .sort();
  if (!parts.length) throw new Error("Roavio scrape snapshot parts were not found.");
  const encoded = parts.map((name) => fs.readFileSync(path.join(snapshotDir, name), "utf8").trim()).join("");
  return JSON.parse(zlib.gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
}

function writeUnlessPresent(filePath, content) {
  if (!force && fs.existsSync(filePath)) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

const profiles = readSnapshot();
let filesWritten = 0;
for (const profile of profiles) {
  const cityDir = path.join(outputDir, profile.slug);
  fs.mkdirSync(cityDir, { recursive: true });
  const { guide, ...structured } = profile;
  const cityJson = `${JSON.stringify({ schemaVersion: 1, ...structured }, null, 2)}\n`;
  if (writeUnlessPresent(path.join(cityDir, "city.json"), cityJson)) filesWritten += 1;
  if (writeUnlessPresent(path.join(cityDir, "guide.md"), `${String(guide ?? "").trim()}\n`)) filesWritten += 1;
}

console.log(`[roavio] materialized ${profiles.length} scraped city profiles (${filesWritten} files written).`);
