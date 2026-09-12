"use client";

import { useEngineSchedule, useEngineViewport } from "@/engine";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getRoavioCityImage } from "./cityImages";
import { ROAVIO_MEDIA_VERSION } from "./mediaVersion";
import { cityInitials } from "./visuals";

function bundledPhoto(slug: string, slot: 0 | 1): string {
  return `/city-media/${encodeURIComponent(slug)}-${slot}.jpg?v=${ROAVIO_MEDIA_VERSION}`;
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
  const viewport = useEngineViewport();
  const mobile = viewport.layoutWidth === 0 || viewport.layoutWidth <= 700;
  const schedule = useEngineSchedule<HTMLDivElement>({
    priority: eager,
    nearMargin: mobile ? "0px" : "96px 0px",
    visibleThreshold: mobile ? 0.03 : 0.02,
    releaseWhenFar: false,
  });
  const active = eager || schedule.near || schedule.visible;

  const candidates = useMemo(() => {
    const original = getRoavioCityImage(slug);
    const primaryFallback = bundledPhoto(slug, slot);
    const secondaryFallback = bundledPhoto(slug, slot === 0 ? 1 : 0);
    return original
      ? [original, primaryFallback, secondaryFallback]
      : [primaryFallback, secondaryFallback];
  }, [slug, slot]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setFailed(false);
  }, [slug, slot]);

  const source = candidates[Math.min(activeIndex, candidates.length - 1)];
  const sizes = compact
    ? "(max-width: 700px) 44vw, 260px"
    : "(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 400px";

  return (
    <div
      ref={schedule.ref}
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

      {active && !failed ? (
        <div className="rv-city-thumb__engine" style={{ position: "relative" }}>
          <Image
            key={`${slug}-${activeIndex}`}
            src={source}
            alt=""
            fill
            sizes={sizes}
            quality={eager ? 75 : 72}
            priority={eager}
            draggable={false}
            onError={() => {
              setActiveIndex((current) => {
                if (current >= candidates.length - 1) {
                  setFailed(true);
                  return current;
                }
                return current + 1;
              });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
