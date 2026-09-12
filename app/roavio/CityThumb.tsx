"use client";

import { OfficialCityImage } from "./OfficialCityImage";
import { cityInitials } from "./visuals";

export function CityThumb({
  slug,
  city,
  country,
  compact = false,
  slot = 0,
  eager = false,
}: {
  slug: string;
  city: string;
  country: string;
  compact?: boolean;
  /** Kept for call-site compatibility. Official Roavio provides one canonical image per city. */
  slot?: 0 | 1;
  eager?: boolean;
}) {
  // The old image system had two generated/local slots. Do not use that value to
  // construct a path anymore; cityImages.ts is now the single source of truth.
  void slot;

  const sizes = compact
    ? "(max-width: 700px) 44vw, 260px"
    : "(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 400px";

  return (
    <div
      className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}`}
      data-city-slug={slug}
      data-roavio-city-image
      aria-hidden
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="rv-city-thumb__fallback">
        <span>{cityInitials(city)}</span>
        <small>{country}</small>
      </div>

      <OfficialCityImage
        slug={slug}
        className="rv-city-thumb__engine"
        priority={eager}
        sizes={sizes}
      />
    </div>
  );
}
