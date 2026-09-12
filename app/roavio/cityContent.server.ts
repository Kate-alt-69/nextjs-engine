import { promises as fs } from "fs";
import path from "path";
import { cities, citySlug } from "./cities";
import type { CityCatalogEntry } from "./catalog";
import type { RoavioLocale } from "./i18n";

export interface CityMetrics {
  cost: string | null;
  quality: number | null;
  safety: number | null;
  internet: number | null;
  beach: boolean | null;
}

export interface CityContent {
  slug: string;
  name: string;
  country: string;
  continent: string;
  summary: string;
  strengths: string[];
  considerations: string[];
  sourceUrl: string | null;
  sourceTitle: string | null;
  hasDeepGuide: boolean;
  editorialAvailable: boolean;
  guide: string;
  metrics: CityMetrics;
}

interface ScrapedProfile {
  slug: string;
  name: string;
  country: string;
  continent: string;
  summary?: string;
  strengths?: string[];
  considerations?: string[];
  sourceUrl?: string;
  sourceTitle?: string;
  hasDeepGuide?: boolean;
  scrapedMetrics?: Partial<CityMetrics>;
}

const contentRoot = path.join(process.cwd(), "content", "cities");
const metricBySlug = new Map(cities.map((city) => [citySlug(city.city), city] as const));
let catalogPromise: Promise<CityCatalogEntry[]> | null = null;

async function readableDirectories(): Promise<string[]> {
  try {
    const entries = await fs.readdir(contentRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readProfileFile(slug: string, fileName: string): Promise<ScrapedProfile | null> {
  const source = await readText(path.join(contentRoot, slug, fileName));
  if (!source) return null;
  try {
    return JSON.parse(source) as ScrapedProfile;
  } catch (error) {
    throw new Error(`[roavio] invalid ${fileName} for ${slug}: ${(error as Error).message}`);
  }
}

async function readProfile(slug: string, locale: RoavioLocale = "es"): Promise<ScrapedProfile | null> {
  if (locale === "en") {
    const english = await readProfileFile(slug, "city.en.json");
    if (english) return english;
  }
  return readProfileFile(slug, "city.json");
}

function mergeMetrics(profile: ScrapedProfile | null, slug: string): CityMetrics {
  const metricCity = metricBySlug.get(slug);
  const scraped = profile?.scrapedMetrics ?? {};
  return {
    cost: scraped.cost ?? metricCity?.cost ?? null,
    quality: scraped.quality ?? metricCity?.quality ?? null,
    safety: scraped.safety ?? metricCity?.safety ?? null,
    internet: scraped.internet ?? metricCity?.internet ?? null,
    beach: scraped.beach ?? metricCity?.beach ?? null,
  };
}

function catalogEntry(slug: string, profile: ScrapedProfile | null): CityCatalogEntry | null {
  const metricCity = metricBySlug.get(slug);
  if (!profile && !metricCity) return null;
  const metrics = mergeMetrics(profile, slug);
  return {
    slug,
    city: profile?.name ?? metricCity!.city,
    country: profile?.country ?? metricCity!.country,
    continent: profile?.continent ?? metricCity!.continent,
    cost: metrics.cost,
    quality: metrics.quality,
    safety: metrics.safety,
    internet: metrics.internet,
    beach: metrics.beach,
    hasDeepGuide: profile?.hasDeepGuide === true,
  };
}

async function loadCatalogEntries(slugs: readonly string[]): Promise<CityCatalogEntry[]> {
  const profiles = await Promise.all(slugs.map((slug) => readProfile(slug, "es")));
  return slugs
    .map((slug, index) => catalogEntry(slug, profiles[index] ?? null))
    .filter((city): city is CityCatalogEntry => city !== null)
    .sort((a, b) => a.city.localeCompare(b.city, "es"));
}

export async function getCitySlugs(): Promise<string[]> {
  const contentSlugs = await readableDirectories();
  return Array.from(new Set([...contentSlugs, ...metricBySlug.keys()])).sort();
}

export async function loadCityContent(slug: string, locale: RoavioLocale = "es"): Promise<CityContent | null> {
  const profile = await readProfile(slug, locale);
  const metricCity = metricBySlug.get(slug);
  if (!profile && !metricCity) return null;

  const localizedGuide = await readText(path.join(contentRoot, slug, `guide.${locale}.md`));
  const fallbackGuide = localizedGuide ?? await readText(path.join(contentRoot, slug, "guide.md"));
  const guide = fallbackGuide?.trim() ?? "";
  const metrics = mergeMetrics(profile, slug);

  return {
    slug,
    name: profile?.name ?? metricCity!.city,
    country: profile?.country ?? metricCity!.country,
    continent: profile?.continent ?? metricCity!.continent,
    summary: profile?.summary?.trim() ?? "",
    strengths: Array.isArray(profile?.strengths) ? profile.strengths : [],
    considerations: Array.isArray(profile?.considerations) ? profile.considerations : [],
    sourceUrl: profile?.sourceUrl ?? null,
    sourceTitle: profile?.sourceTitle ?? null,
    hasDeepGuide: profile?.hasDeepGuide === true,
    editorialAvailable: guide.length > 0,
    guide,
    metrics,
  };
}

export async function loadCityCatalogForSlugs(slugs: readonly string[]): Promise<CityCatalogEntry[]> {
  return loadCatalogEntries(Array.from(new Set(slugs)));
}

export async function loadCityCatalog(): Promise<CityCatalogEntry[]> {
  if (!catalogPromise) {
    catalogPromise = getCitySlugs().then((slugs) => loadCatalogEntries(slugs));
  }
  return catalogPromise;
}
