"use client";

import type { RoavioCityAccent } from "./cityAccent";
import { OfficialCityImage } from "./OfficialCityImage";
import { cityInitials } from "./visuals";

export function CityThumb({
  slug,
  city,
  country,
  compact = false,
  slot = 0,
  eager = false,
  onAccent,
}: {
  slug: string;
  city: string;
  country: string;
  compact?: boolean;
  /** Kept for call-site compatibility. Official Roavio provides one canonical image per city. */
  slot?: 0 | 1;
  eager?: boolean;
  /** Receives the automatically extracted, UI-safe accent from OfficialCityImage. */
  onAccent?: (accent: RoavioCityAccent) => void;
}) {
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
        onAccent={onAccent}
      />
    </div>
  );
}
