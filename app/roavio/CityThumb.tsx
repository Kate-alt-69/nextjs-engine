"use client";

import { EngineImage } from "@/engine";
import { useEffect, useRef, useState } from "react";
import { cityImage, cityInitials } from "./visuals";

export function CityThumb({ slug, city, country, compact = false }: { slug: string; city: string; country: string; compact?: boolean }) {
  const source = cityImage(slug);
  const hostRef = useRef<HTMLDivElement>(null);
  const [allowImage, setAllowImage] = useState(false);

  useEffect(() => {
    if (!source) return;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    if (!mobile) {
      setAllowImage(true);
      return;
    }

    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setAllowImage(true);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setAllowImage(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px", threshold: 0.01 });
    observer.observe(host);
    return () => observer.disconnect();
  }, [source]);

  return (
    <div ref={hostRef} className={`rv-city-thumb${compact ? " rv-city-thumb--compact" : ""}`} aria-hidden>
      {source && allowImage ? (
        <EngineImage
          src={source}
          alt=""
          width={720}
          height={405}
          aspectRatio="16 / 9"
          sizes={compact ? "(max-width: 700px) 45vw, 220px" : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"}
          qualityPreset="performance"
          qualityMobile={56}
          qualityDesktop={72}
          objectFit="cover"
          className="rv-city-thumb__engine"
        />
      ) : (
        <div className="rv-city-thumb__fallback">
          <span>{cityInitials(city)}</span>
          <small>{country}</small>
        </div>
      )}
    </div>
  );
}
