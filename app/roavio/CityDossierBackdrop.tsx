"use client";

import { useMemo, useState } from "react";

const CITY_PHOTO_VERSION = "5";
const BACKDROP_ASPECT = 16 / 10;

function cityPhotoUrl(city: string, country: string, slot: number, width: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: String(width),
    height: String(Math.max(1, Math.round(width / BACKDROP_ASPECT))),
    v: CITY_PHOTO_VERSION,
  });
  return `/api/city-photo?${params.toString()}`;
}

export function CityDossierBackdrop({ city, country }: { city: string; country: string }) {
  const [slot, setSlot] = useState(1);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => cityPhotoUrl(city, country, slot, 720), [city, country, slot]);
  const srcSet = useMemo(() => [480, 720, 960]
    .map((width) => `${cityPhotoUrl(city, country, slot, width)} ${width}w`)
    .join(", "), [city, country, slot]);

  return (
    <div className="rv-dossier-backdrop" aria-hidden="true">
      {!failed ? (
        <img
          key={`${city}-${slot}-${CITY_PHOTO_VERSION}`}
          className="rv-dossier-backdrop__image"
          src={src}
          srcSet={srcSet}
          sizes="100vw"
          alt=""
          width={720}
          height={450}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onError={() => {
            if (slot === 1) setSlot(0);
            else setFailed(true);
          }}
        />
      ) : null}
      <div className="rv-dossier-backdrop__veil" />
    </div>
  );
}
