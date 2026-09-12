"use client";

import { EngineImage } from "@/engine";
import type { ImageLoader } from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cityImage, cityInitials } from "./visuals";

const CITY_PHOTO_VERSION = "12";
const CARD_ASPECT = 16 / 9;

function targetHeight(width: number): number {
  return Math.max(1, Math.round(width / CARD_ASPECT));
}

function cityProxySource(city: string, country: string, slot: number, width: number): string {
  const params = new URLSearchParams({
    city,
    country,
    slot: String(slot),
    width: String(width),
    height: String(targetHeight(width)),
    v: CITY_PHOTO_VERSION,
  });
  return `/api/city-photo?${params.toString()}`;
}

const responsiveCityLoader: ImageLoader = ({ src, width, quality }) => {
  const height = targetHeight(width);

  if (src.startsWith("/api/city-photo?")) {
    const url = new URL(src, "http://roavio.local");
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("v", CITY_PHOTO_VERSION);
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  if (src.includes("images.unsplash.com")) {
    try {
      const url = new URL(src);
      url.searchParams.set("w", String(width));
      url.searchParams.set("h", String(height));
      url.searchParams.set("q", String(quality ?? 72));
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("crop", "entropy");
      return url.toString();
    } catch {
      return src;
    }
  }

  return src;
};

function lowResSource(source: string): string | null {
  if (source.includes("images.unsplash.com")) {
    try {
      const url = new URL(source);
      url.searchParams.set("w", "64");
      url.searchParams.set("h", "36");
      url.searchParams.set("q", "20");
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("crop", "entropy");
      return url.toString();
    } catch {
      return source;
    }
  }
  return null;
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
  const source = useMemo(
    () => staticSource ?? cityProxySource(city, country, slot, 960),
    [city, country, slot, staticSource],
  );
  const preview = useMemo(() => lowResSource(source), [source]);
  const proxyBacked = source.startsWith("/api/city-photo?");
  const sizes = compact
    ? "(max-width: 700px) 44vw, 260px"
    : "(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 400px";

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
      rootMargin: mobile ? "0px" : "64px 0px",
      threshold: mobile ? 0.03 : 0.01,
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div
      ref={hostRef}
      className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}`}
      aria-hidden
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="rv-city-thumb__fallback">
        <span>{cityInitials(city)}</span>
        <small>{country}</small>
      </div>
      {active ? (
        proxyBacked ? (
          <img
            className="rv-city-thumb__native"
            src={cityProxySource(city, country, slot, 960)}
            srcSet={`${cityProxySource(city, country, slot, 480)} 480w, ${cityProxySource(city, country, slot, 720)} 720w, ${cityProxySource(city, country, slot, 960)} 960w, ${cityProxySource(city, country, slot, 1280)} 1280w`}
            sizes={sizes}
            alt=""
            draggable={false}
            decoding="async"
            loading={eager ? "eager" : "lazy"}
          />
        ) : (
          <EngineImage
            src={source}
            alt=""
            width={720}
            height={405}
            aspectRatio="16 / 9"
            sizes={sizes}
            qualityPreset="balanced"
            qualityMobile={58}
            qualityDesktop={72}
            objectFit="cover"
            priority={eager}
            loader={responsiveCityLoader}
            blurDataURL={preview ?? undefined}
            className="rv-city-thumb__engine"
          />
        )
      ) : null}
    </div>
  );
}
