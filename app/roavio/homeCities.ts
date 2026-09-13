export const HOME_HERO_DECK_SLUGS = [
  "valencia", "singapur", "tokio", "copenhague", "dubai",
] as const;

export const HOME_RAIL_SLUGS = [
  "singapur", "tokio", "copenhague", "amsterdam", "viena", "oslo",
  "sidney", "melbourne", "auckland", "seattle", "vancouver", "toronto",
  "madrid", "barcelona", "valencia", "lisboa", "oporto", "paris",
  "berlin", "munich", "praga", "budapest", "dubai", "taipei", "seul",
  "osaka", "bangkok", "chiang-mai", "bali", "kuala-lumpur",
] as const;

export const HOME_CITY_SLUGS = Array.from(new Set<string>([
  ...HOME_HERO_DECK_SLUGS,
  ...HOME_RAIL_SLUGS,
]));
