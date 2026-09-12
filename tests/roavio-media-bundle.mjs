import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), "app/roavio/city-media.generated.json");
const outputDir = path.resolve(process.cwd(), "public/city-media");
const userAgent = "RoavioProposal/1.0 (https://github.com/Kate-alt-69/nextjs-engine; city media bundler)";
const pauseMs = Math.max(80, Number(process.env.ROAVIO_BUNDLE_PAUSE_MS || 140));
const retryLimit = Math.max(3, Number(process.env.ROAVIO_BUNDLE_RETRIES || 7));
const maxBytes = 6 * 1024 * 1024;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resizedWikimediaUrl(source, width) {
  const url = new URL(source);
  url.search = "";
  const parts = url.pathname.split("/");
  const last = parts.at(-1) || "";

  if (url.pathname.includes("/thumb/") && /^\d+px-/.test(last)) {
    parts[parts.length - 1] = last.replace(/^\d+px-/, `${width}px-`);
    url.pathname = parts.join("/");
    return url.toString();
  }

  const commonsIndex = parts.indexOf("commons");
  if (commonsIndex >= 0 && !url.pathname.includes("/thumb/") && parts.length >= commonsIndex + 4) {
    const filename = parts.at(-1);
    if (filename && !/\.svg$/i.test(filename)) {
      const prefix = parts.slice(0, commonsIndex + 1);
      const relative = parts.slice(commonsIndex + 1);
      url.hostname = "upload.wikimedia.org";
      url.pathname = [...prefix, "thumb", ...relative, `${width}px-${filename}`].join("/");
      return url.toString();
    }
  }

  return url.toString();
}

function extensionFor(type, source) {
  const normalized = (type || "").split(";")[0].trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/avif") return "avif";
  const pathname = new URL(source).pathname.toLowerCase();
  if (/\.jpe?g$/.test(pathname)) return "jpg";
  if (/\.png$/.test(pathname)) return "png";
  if (/\.webp$/.test(pathname)) return "webp";
  if (/\.avif$/.test(pathname)) return "avif";
  return "jpg";
}

async function fetchImage(source, width, attempt = 0) {
  const preferred = resizedWikimediaUrl(source, width);
  const candidates = preferred === source ? [preferred] : [preferred, source];
  let lastError;

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: "image/avif,image/webp,image/*,*/*;q=0.7",
          "User-Agent": userAgent,
        },
        redirect: "follow",
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) {
        lastError = new Error(`invalid content-type ${type || "<missing>"}`);
        continue;
      }

      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > maxBytes) {
        lastError = new Error(`declared image too large: ${declared}`);
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 500) {
        lastError = new Error(`image too small: ${bytes.byteLength}`);
        continue;
      }
      if (bytes.byteLength > maxBytes) {
        lastError = new Error(`image too large: ${bytes.byteLength}`);
        continue;
      }

      await sleep(pauseMs);
      return { bytes, type, source: candidate };
    } catch (error) {
      lastError = error;
    }
  }

  if (attempt >= retryLimit) throw lastError || new Error("download failed");
  const wait = Math.min(12_000, 700 * (2 ** attempt));
  console.log(`      retry ${attempt + 1}/${retryLimit} in ${wait}ms (${lastError?.message || "download failed"})`);
  await sleep(wait);
  return fetchImage(source, width, attempt + 1);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entries = Object.entries(manifest.cities || {});
if (entries.length !== 90) throw new Error(`Expected 90 media entries, found ${entries.length}`);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (let index = 0; index < entries.length; index += 1) {
  const [slug, entry] = entries[index];
  console.log(`${String(index + 1).padStart(2, "0")}/90 ${slug}`);

  for (const [slot, key, width] of [[0, "primary", 1280], [1, "secondary", 960]]) {
    const remote = entry[key];
    if (typeof remote !== "string" || !/^https:\/\//.test(remote)) {
      throw new Error(`${slug} ${key} is not a remote source: ${String(remote)}`);
    }

    const image = await fetchImage(remote, width);
    const extension = extensionFor(image.type, image.source);
    const filename = `${slug}-${slot}.${extension}`;
    await writeFile(path.join(outputDir, filename), image.bytes);

    entry[`${key}Source`] = remote;
    entry[key] = `/city-media/${filename}`;
    entry[`${key}Bytes`] = image.bytes.byteLength;
    console.log(`    slot ${slot}: ${filename} ${Math.round(image.bytes.byteLength / 1024)} KiB`);
  }
}

manifest.bundledAt = new Date().toISOString();
manifest.delivery = "local-static";
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`\nBundled ${entries.length * 2} city images into public/city-media. ✅`);
