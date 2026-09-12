import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "content", "cities");
const PAUSE_MS = Number(process.env.ROAVIO_TRANSLATE_PAUSE_MS ?? 180);
const RETRIES = Number(process.env.ROAVIO_TRANSLATE_RETRIES ?? 6);
const translationCache = new Map();
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clean(value = "") {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function sectionKey(heading) {
  return heading
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function splitSections(markdown) {
  const source = clean(markdown);
  const matches = [...source.matchAll(/^##\s+(.+)$/gm)];
  if (!matches.length) return [];
  return matches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? source.length;
    return {
      heading: match[1].trim(),
      body: source.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function unitsFrom(body) {
  return clean(body)
    .split(/(?<=[.!?])\s+|;\s+/u)
    .map((unit) => unit.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .filter((unit) => !/muy pronto añadiremos/i.test(unit));
}

function paragraphsFrom(body) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => clean(paragraph).replace(/^[-*]\s+/, ""))
    .filter(Boolean)
    .filter((paragraph) => !/muy pronto añadiremos/i.test(paragraph));
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== "string" || !value.trim()) return false;
    const key = value.toLocaleLowerCase("es");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstMatching(units, pattern, start = 0) {
  return units.slice(start).find((unit) => pattern.test(unit));
}

function ensurePunctuation(value) {
  const trimmed = value.trim().replace(/[;,]\s*$/, "");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function compactSection(heading, body) {
  const key = sectionKey(heading);
  const units = unitsFrom(body);
  const paragraphs = paragraphsFrom(body);
  let picked = [];

  if (key.includes("visado") || key.includes("fiscal")) {
    picked = unique([
      units[0],
      firstMatching(units, /n[oó]mada|digital|remote|teletrab/i, 1),
      firstMatching([...units].reverse(), /183|fiscal|tribut|impuesto|renta/i),
    ]);
  } else if (key.includes("sanidad") || key.includes("seguro medico")) {
    picked = unique([
      units[0],
      firstMatching(units, /6 meses|seis meses|afili|resident|NHI|seguro nacional/i, 1),
      firstMatching(units, /seguro.*priv|privad|hospital|cobertura/i, 1),
    ]);
  } else if (key.includes("barrios") || key.includes("cowork")) {
    picked = unique([
      units[0],
      units[1],
      units[2],
      firstMatching(units, /cowork|hot desk|oficina/i, 1),
    ]);
  } else if (key.includes("internet") || key.includes("datos moviles")) {
    picked = unique([units[0], units[1]]);
  } else if (key.includes("fuentes")) {
    const sourceParagraphs = paragraphs.filter((paragraph) =>
      /Numbeo|Speedtest|Ookla|coste|seguridad|calidad de vida|banda ancha/i.test(paragraph),
    );
    picked = unique(sourceParagraphs.length ? sourceParagraphs.slice(0, 4) : units.slice(0, 4));
  } else {
    picked = unique(units.slice(0, 3));
  }

  picked = picked.filter(Boolean).slice(0, 4);
  if (!picked.length) return "";
  return picked.map((item) => `- ${ensurePunctuation(item)}`).join("\n");
}

function compactGuide(markdown) {
  const sections = splitSections(markdown);
  return sections
    .map(({ heading, body }) => {
      const compactBody = compactSection(heading, body);
      return compactBody ? `## ${heading}\n\n${compactBody}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < PAUSE_MS) await sleep(PAUSE_MS - elapsed);
  lastRequestAt = Date.now();
}

async function translate(text) {
  const value = clean(text);
  if (!value) return "";
  if (translationCache.has(value)) return translationCache.get(value);

  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      await throttle();
      const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
      endpoint.searchParams.set("client", "gtx");
      endpoint.searchParams.set("sl", "es");
      endpoint.searchParams.set("tl", "en");
      endpoint.searchParams.set("dt", "t");
      endpoint.searchParams.set("q", value);

      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "RoavioProposal/1.0 bilingual content materializer",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translated = Array.isArray(payload?.[0])
        ? payload[0].map((part) => part?.[0] ?? "").join("").trim()
        : "";
      if (!translated) throw new Error("empty translation response");
      translationCache.set(value, translated);
      return translated;
    } catch (error) {
      lastError = error;
      await sleep(Math.min(7000, 650 * attempt * attempt));
    }
  }

  throw new Error(`translation failed after ${RETRIES} attempts: ${lastError?.message ?? lastError}`);
}

async function translateMany(values) {
  const cleanValues = values.map((value) => clean(value));
  const markers = cleanValues.map((_, index) => `__RV_FIELD_${index}__`);
  const packed = cleanValues.map((value, index) => `${markers[index]}\n${value}`).join("\n");
  const translated = await translate(packed);

  const output = [];
  for (let index = 0; index < markers.length; index += 1) {
    const start = translated.indexOf(markers[index]);
    const end = index + 1 < markers.length ? translated.indexOf(markers[index + 1]) : translated.length;
    if (start < 0 || end < 0) {
      return Promise.all(cleanValues.map((value) => translate(value)));
    }
    output.push(translated.slice(start + markers[index].length, end).trim());
  }
  return output;
}

async function buildEnglishProfile(profile) {
  const strengths = Array.isArray(profile.strengths) ? profile.strengths : [];
  const considerations = Array.isArray(profile.considerations) ? profile.considerations : [];
  const values = [
    profile.name ?? "",
    profile.country ?? "",
    profile.continent ?? "",
    profile.summary ?? "",
    ...strengths,
    ...considerations,
  ];
  const translated = await translateMany(values);
  let cursor = 0;
  const name = translated[cursor++];
  const country = translated[cursor++];
  const continent = translated[cursor++];
  const summary = translated[cursor++];
  const translatedStrengths = strengths.map(() => translated[cursor++]);
  const translatedConsiderations = considerations.map(() => translated[cursor++]);

  return {
    ...profile,
    name,
    country,
    continent,
    summary,
    strengths: translatedStrengths,
    considerations: translatedConsiderations,
  };
}

async function main() {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  const cityDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

  if (cityDirs.length !== 90) {
    throw new Error(`expected 90 city directories, found ${cityDirs.length}`);
  }

  let deepGuides = 0;
  for (const [index, slug] of cityDirs.entries()) {
    const dir = path.join(ROOT, slug);
    const [profileSource, guideSource] = await Promise.all([
      fs.readFile(path.join(dir, "city.json"), "utf8"),
      fs.readFile(path.join(dir, "guide.md"), "utf8"),
    ]);
    const profile = JSON.parse(profileSource);
    if (profile.hasDeepGuide === true) deepGuides += 1;

    const conciseEs = compactGuide(guideSource);
    const [conciseEn, englishProfile] = await Promise.all([
      translate(conciseEs),
      buildEnglishProfile(profile),
    ]);

    await Promise.all([
      fs.writeFile(path.join(dir, "guide.es.md"), `${conciseEs.trim()}\n`, "utf8"),
      fs.writeFile(path.join(dir, "guide.en.md"), `${conciseEn.trim()}\n`, "utf8"),
      fs.writeFile(path.join(dir, "city.en.json"), `${JSON.stringify(englishProfile, null, 2)}\n`, "utf8"),
    ]);

    console.log(`[${index + 1}/90] ${slug}: bilingual concise content generated`);
  }

  console.log(`Generated concise ES/EN content for 90 cities; deep guides: ${deepGuides}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
