"use client";

import { EngineImage } from "@/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { cityImage, cityInitials } from "./visuals";

const CITY_PHOTO_VERSION = "3";

function cityProxySource(city: string, country: string, slot: number, width: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: String(width),
    v: CITY_PHOTO_VERSION,
  });
  return `/api/city-photo?${params.toString()}`;
}

function lowResSource(source: string, city: string, country: string, slot: number): string {
  if (source.includes("images.unsplash.com")) {
    try {
      const url = new URL(source);
      url.searchParams.set("w", "64");
      url.searchParams.set("q", "24");
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      return url.toString();
    } catch {
      return source;
    }
  }
  return cityProxySource(city, country, slot, 72);
}

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
  slot?: 0 | 1;
  eager?: boolean;
}) {
  const staticSource = slot === 0 ? cityImage(slug) : null;
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const source = useMemo(
    () => staticSource ?? cityProxySource(city, country, slot, 1080),
    [city, country, slot, staticSource],
  );
  const preview = useMemo(
    () => lowResSource(source, city, country, slot),
    [city, country, slot, source],
  );

  useEffect(() => {
    setLoaded(false);
  }, [source]);

  useEffect(() => {
    if (active) return;
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
      rootMargin: mobile ? "0px" : "240px 0px",
      threshold: mobile ? 0.03 : 0.01,
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={hostRef}
      className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}${loaded ? " rv-city-thumb--loaded" : ""}`}
      aria-hidden
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="rv-city-thumb__fallback">
        <span>{cityInitials(city)}</span>
        <small>{country}</small>
      </div>
      {active ? (
        <>
          <img
            className="rv-city-thumb__blur"
            src={preview}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          <EngineImage
            src={source}
            alt=""
            width={720}
            height={405}
            aspectRatio="16 / 9"
            sizes={compact ? "(max-width: 700px) 45vw, 260px" : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"}
            qualityPreset="balanced"
            qualityMobile={58}
            qualityDesktop={76}
            objectFit="cover"
            priority={eager}
            className="rv-city-thumb__engine"
            onLoad={() => setLoaded(true)}
          />
        </>
      ) : null}
    </div>
  );
}
