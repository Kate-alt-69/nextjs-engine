"use client";

import { CityThumb } from "./CityThumb";

export function CityDossierMedia({ slug, city, country }: { slug: string; city: string; country: string }) {
  return (
    <div className="rv-dossier-media" aria-hidden onDragStart={(event) => event.preventDefault()}>
      <div className="rv-dossier-media__primary">
        <CityThumb slug={slug} city={city} country={country} slot={0} eager />
      </div>
    </div>
  );
}
