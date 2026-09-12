"use client";

import { OfficialCityImage } from "./OfficialCityImage";

export function CityDossierBackdrop({ slug }: { slug: string }) {
  return (
    <div
      className="rv-dossier-backdrop rv-dossier-backdrop--fallback"
      data-roavio-city-image
      aria-hidden="true"
    >
      <OfficialCityImage
        slug={slug}
        className="rv-dossier-backdrop__full"
        sizes="100vw"
        style={{ position: "absolute", inset: 0 }}
      />
      <span className="rv-dossier-backdrop__veil" />
    </div>
  );
}
