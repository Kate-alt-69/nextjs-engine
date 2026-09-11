import { promises as fs } from "fs";
import path from "path";
import { cities, citySlug } from "./cities";

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

async function readProfile(slug: string): Promise<ScrapedProfile | null> {
  const source = await readText(path.join(contentRoot, slug, "city.json"));
  if (!source) return null;
  try {
    return JSON.parse(source) as ScrapedProfile;
  } catch (error) {
    throw new Error(`[roavio] invalid city.json for ${slug}: ${(error as Error).message}`);
  }
}

export async function getCitySlugs(): Promise<string[]> {
  const contentSlugs = await readableDirectories();
  const metricSlugs = cities.map((city) => citySlug(city.city));
  return Array.from(new Set([...contentSlugs, ...metricSlugs])).sort();
}

export async function loadCityContent(slug: string): Promise<CityContent | null> {
  const profile = await readProfile(slug);
  const metricCity = cities.find((city) => citySlug(city.city) === slug);
  if (!profile && !metricCity) return null;

  const guide = (await readText(path.join(contentRoot, slug, "guide.md")))?.trim() ?? "";
  const scraped = profile?.scrapedMetrics ?? {};
  const metrics: CityMetrics = {
    cost: metricCity?.cost ?? scraped.cost ?? null,
    quality: metricCity?.quality ?? scraped.quality ?? null,
    safety: metricCity?.safety ?? scraped.safety ?? null,
    internet: metricCity?.internet ?? scraped.internet ?? null,
    beach: metricCity?.beach ?? scraped.beach ?? null,
  };

  return {
    slug,
    name: profile?.name ?? metricCity!.city,
    country: profile?.country ?? metricCity!.country,
    continent: profile?.continent ?? metricCity!.continent,
    summary: profile?.summary?.trim() ?? "",
    strengths: Array.isArray(profile?.strengths) ? profile!.strengths! : [],
    considerations: Array.isArray(profile?.considerations) ? profile!.considerations! : [],
    sourceUrl: profile?.sourceUrl ?? null,
    sourceTitle: profile?.sourceTitle ?? null,
    hasDeepGuide: profile?.hasDeepGuide === true,
    editorialAvailable: guide.length > 0,
    guide,
    metrics,
  };
}
