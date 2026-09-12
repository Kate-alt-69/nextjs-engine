"use client";

import { useMemo, useState } from "react";

const PHOTO_VERSION = "10";

function photoUrl(city: string, country: string, slot: 0 | 1, width: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: String(width),
    height: String(Math.round(width * 0.72)),
    v: PHOTO_VERSION,
  });
  return `/api/city-photo?${params.toString()}`;
}

export function CityDossierBackdrop({ city, country }: { city: string; country: string }) {
  const [slot, setSlot] = useState<0 | 1>(1);
  const [failed, setFailed] = useState(false);

  const sources = useMemo(() => ({
    sm: photoUrl(city, country, slot, 720),
    md: photoUrl(city, country, slot, 1280),
    lg: photoUrl(city, country, slot, 1800),
  }), [city, country, slot]);

  if (failed) return <div className="rv-dossier-backdrop rv-dossier-backdrop--fallback" aria-hidden="true" />;

  return (
    <div className="rv-dossier-backdrop" aria-hidden="true">
      <img
        src={sources.md}
        srcSet={`${sources.sm} 720w, ${sources.md} 1280w, ${sources.lg} 1800w`}
        sizes="100vw"
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority="low"
        onDragStart={(event) => event.preventDefault()}
        onError={() => {
          if (slot === 1) setSlot(0);
          else setFailed(true);
        }}
      />
      <span className="rv-dossier-backdrop__veil" />
    </div>
  );
}
