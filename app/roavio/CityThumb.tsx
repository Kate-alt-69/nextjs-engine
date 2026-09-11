"use client";

import { EngineImage } from "@/engine";
import { useEffect, useRef, useState } from "react";
import { cityImage, cityInitials } from "./visuals";

export function CityThumb({ slug, city, country, compact = false }: { slug: string; city: string; country: string; compact?: boolean }) {
  const staticSource = cityImage(slug);
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [remoteSource, setRemoteSource] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(Boolean(staticSource));
  const source = staticSource ?? remoteSource;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setActive(true);
        observer.disconnect();
      }
    }, {
      rootMargin: mobile ? "0px" : "420px 0px",
      threshold: mobile ? 0.04 : 0.01,
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active || staticSource || lookupDone) return;
    let cancelled = false;
    const params = new URLSearchParams({ city, country });
    fetch(`/api/city-image?${params.toString()}`, { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { image?: string | null }) => {
        if (!cancelled && data.image) setRemoteSource(data.image);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLookupDone(true); });
    return () => { cancelled = true; };
  }, [active, city, country, lookupDone, staticSource]);

  return (
    <div ref={hostRef} className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}`} aria-hidden>
      {source && active ? (
        <EngineImage
          src={source}
          alt=""
          width={720}
          height={405}
          aspectRatio="16 / 9"
          sizes={compact ? "(max-width: 700px) 45vw, 220px" : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"}
          qualityPreset="performance"
          qualityMobile={54}
          qualityDesktop={70}
          objectFit="cover"
          className="rv-city-thumb__engine"
        />
      ) : (
        <div className="rv-city-thumb__fallback">
          <span>{cityInitials(city)}</span>
          <small>{active && !lookupDone ? "…" : country}</small>
        </div>
      )}
    </div>
  );
}
