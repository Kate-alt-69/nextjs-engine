"use client";

import { EngineImage, useEngineSchedule, useEngineViewport } from "@/engine";
import { ROAVIO_MEDIA_VERSION } from "./mediaVersion";
import { cityInitials } from "./visuals";

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
    // Phones wait until the media actually reaches the viewport. Desktop gets
    // a small prefetch runway so scrolling still feels instant.
    nearMargin: mobile ? "0px" : "96px 0px",
    visibleThreshold: mobile ? 0.03 : 0.02,
    releaseWhenFar: false,
  });
  const active = eager || schedule.near || schedule.visible;
  const source = `/city-media/${encodeURIComponent(slug)}-${slot}.jpg?v=${ROAVIO_MEDIA_VERSION}`;
  const sizes = compact
    ? "(max-width: 700px) 44vw, 260px"
    : "(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 400px";

  return (
    <div
      ref={schedule.ref}
      className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}`}
      data-city-slug={slug}
      aria-hidden
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="rv-city-thumb__fallback">
        <span>{cityInitials(city)}</span>
        <small>{country}</small>
      </div>
      {active ? (
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
          className="rv-city-thumb__engine"
        />
      ) : null}
    </div>
  );
}
