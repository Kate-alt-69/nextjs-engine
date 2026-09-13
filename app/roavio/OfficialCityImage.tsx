"use client";

import { EngineImage, EngineScheduler } from "@/engine";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { getRoavioCityImage } from "./cityImages";

type EngineImageProps = ComponentProps<typeof EngineImage>;

/**
 * The only Roavio city-photo renderer.
 *
 * `cityImages.ts` contains the exact Unsplash URLs copied from the official
 * Roavio scrape. We deliberately do not search for, generate, proxy, or guess
 * replacement photography here.
 *
 * A tiny scheduler probe stays in the media box while the real EngineImage is
 * completely unmounted when the box is far from the viewport. The photo starts
 * warming before the card entrance animation so image decode/network work does
 * not compete with the transform/opacity animation on mobile Firefox.
 */
export function OfficialCityImage({
  slug,
  alt = "",
  className,
  priority = false,
  sizes = "100vw",
  objectFit = "cover",
  style,
}: {
  slug: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  objectFit?: EngineImageProps["objectFit"];
  style?: EngineImageProps["style"];
}) {
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const [nearViewport, setNearViewport] = useState(priority);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    setNearViewport(priority);
  }, [priority, slug]);

  useEffect(() => {
    if (priority) return;
    const probe = probeRef.current;
    if (!probe) return;

    return EngineScheduler.observe(probe, (snapshot) => {
      setNearViewport(snapshot.near || snapshot.visible);
    }, {
      // Pre-warm the real photo well before the 96px card-pop boundary.
      nearMargin: "640px 0px",
      visibleThreshold: 0.01,
      releaseWhenFar: true,
    });
  }, [priority, slug]);

  const src = getRoavioCityImage(slug);

  return (
    <>
      <span
        ref={probeRef}
        className="rv-city-image-probe"
        data-rv-image-state={nearViewport ? "near" : "sleeping"}
        aria-hidden="true"
      />
      {src && !failed && nearViewport ? (
        <EngineImage
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          quality={72}
          objectFit={objectFit}
          className={className}
          style={style}
          onError={() => setFailed(true)}
        />
      ) : null}
    </>
  );
}
