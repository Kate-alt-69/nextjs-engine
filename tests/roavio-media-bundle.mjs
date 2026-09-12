import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const officialPath = path.resolve(process.cwd(), "app/roavio/official-city-images.generated.json");
const outputDir = path.resolve(process.cwd(), "public/city-media");
const userAgent = "RoavioProposal/1.0 (local city media bundler)";
const pauseMs = Math.max(80, Number(process.env.ROAVIO_BUNDLE_PAUSE_MS || 140));
const retryLimit = Math.max(3, Number(process.env.ROAVIO_BUNDLE_RETRIES || 7));
const maxBytes = 6 * 1024 * 1024;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function preferredJpegUrl(source, width) {
  const url = new URL(source);

  if (url.hostname === "images.unsplash.com") {
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", "80");
    url.searchParams.set("fm", "jpg");
    url.searchParams.set("fit", "max");
    return url.toString();
  }

  url.search = "";
  const parts = url.pathname.split("/");
  const last = parts.at(-1) || "";
  if (url.hostname.includes("wikimedia.org") && url.pathname.includes("/thumb/") && /^\d+px-/.test(last)) {
    parts[parts.length - 1] = last.replace(/^\d+px-/, `${width}px-`);
    url.pathname = parts.join("/");
  }
  return url.toString();
}

async function fetchImage(source, width, attempt = 0) {
  const preferred = preferredJpegUrl(source, width);
  let lastError;

  try {
    const response = await fetch(preferred, {
      headers: {
        Accept: "image/jpeg,image/*;q=0.8,*/*;q=0.5",
        "User-Agent": userAgent,
      },
      redirect: "follow",
    });

    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type !== "image/jpeg") throw new Error(`expected image/jpeg, got ${type || "<missing>"}`);

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error(`declared image too large: ${declared}`);

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 500) throw new Error(`image too small: ${bytes.byteLength}`);
    if (bytes.byteLength > maxBytes) throw new Error(`image too large: ${bytes.byteLength}`);

    await sleep(pauseMs);
    return { bytes, source: preferred };
  } catch (error) {
    lastError = error;
  }

  if (attempt >= retryLimit) throw lastError || new Error("download failed");
  const wait = Math.min(12_000, 700 * (2 ** attempt));
  console.log(`      retry ${attempt + 1}/${retryLimit} in ${wait}ms (${lastError?.message || "download failed"})`);
  await sleep(wait);
  return fetchImage(source, width, attempt + 1);
}

const [manifest, official] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(officialPath, "utf8").then(JSON.parse),
]);
const entries = Object.entries(manifest.cities || {});
const expected = Object.keys(official.cities || {}).length;
if (!expected || entries.length !== expected) {
  throw new Error(`Media/source mismatch: ${entries.length} manifest entries vs ${expected} official city images`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (let index = 0; index < entries.length; index += 1) {
  const [slug, entry] = entries[index];
  console.log(`${String(index + 1).padStart(2, "0")}/${expected} ${slug}`);

  for (const [slot, key, width] of [[0, "primary", 1280], [1, "secondary", 960]]) {
    const remote = entry[key];
    if (typeof remote !== "string" || !/^https:\/\//.test(remote)) {
      throw new Error(`${slug} ${key} is not a remote source: ${String(remote)}`);
    }

    const image = await fetchImage(remote, width);
    const filename = `${slug}-${slot}.jpg`;
    await writeFile(path.join(outputDir, filename), image.bytes);

    entry[`${key}Source`] = remote;
    entry[key] = `/city-media/${filename}`;
    entry[`${key}Bytes`] = image.bytes.byteLength;
    console.log(`    slot ${slot}: ${filename} ${Math.round(image.bytes.byteLength / 1024)} KiB`);
  }
}

manifest.bundledAt = new Date().toISOString();
manifest.delivery = "local-static-jpeg";
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nBundled ${entries.length * 2} JPEG city images into public/city-media. ✅`);
