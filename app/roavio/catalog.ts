export interface CityCatalogEntry {
  slug: string;
  city: string;
  country: string;
  continent: string;
  cost: string | null;
  quality: number | null;
  safety: number | null;
  internet: number | null;
  beach: boolean | null;
  hasDeepGuide: boolean;
}

export function catalogFitScore(city: Pick<CityCatalogEntry, "quality" | "safety" | "internet">): number | null {
  if (city.quality === null || city.safety === null || city.internet === null) return null;
  const internetScore = Math.min(city.internet / 40, 10);
  return Math.round((city.quality * 0.45 + city.safety * 0.3 + internetScore * 0.25) * 10) / 10;
}

export function catalogMetric(value: string | number | null, suffix = ""): string {
  return value === null ? "—" : `${value}${suffix}`;
}
