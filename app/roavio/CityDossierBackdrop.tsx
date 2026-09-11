"use client";

import { useMemo, useState } from "react";

function cityPhotoUrl(city: string, country: string, slot: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: "720",
  });
  return `/api/city-photo?${params.toString()}`;
}

export function CityDossierBackdrop({ city, country }: { city: string; country: string }) {
  const [slot, setSlot] = useState(1);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => cityPhotoUrl(city, country, slot), [city, country, slot]);

  return (
    <div className="rv-dossier-backdrop" aria-hidden="true">
      {!failed ? (
        <img
          key={src}
          className="rv-dossier-backdrop__image"
          src={src}
          alt=""
          width={720}
          height={1080}
          decoding="async"
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
