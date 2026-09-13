function safeCitySlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "city";
}

/** Destination surface: Roavio's full viewport photo #2 backdrop. */
export function cityTransitionSurfaceId(slug: string): string {
  return `rv-city-surface-${safeCitySlug(slug)}`;
}

/** Source surface: the photo portion of a card, not the whole card shell. */
export function cityTransitionImageId(slug: string): string {
  return `rv-city-image-${safeCitySlug(slug)}`;
}

export const CITY_EXPAND_DURATION = 460;
export const CITY_HANDOFF_DURATION = 260;
