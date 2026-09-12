"use client";

import { EngineImage } from "@/engine";
import { useEffect, useState, type ComponentProps } from "react";
import { getRoavioCityImage } from "./cityImages";

type EngineImageProps = ComponentProps<typeof EngineImage>;

/**
 * The only Roavio city-photo renderer.
 *
 * `cityImages.ts` contains the exact Unsplash URLs copied from the official
 * Roavio scrape. We deliberately do not search for, generate, proxy, or guess
 * replacement photography here. If an official image cannot load, the caller's
 * existing CSS/initials fallback remains visible instead.
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [slug]);

  const src = getRoavioCityImage(slug);
  if (!src || failed) return null;

  return (
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
  );
}
