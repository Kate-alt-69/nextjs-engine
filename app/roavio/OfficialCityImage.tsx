"use client";

import { EngineImage, EngineScheduler } from "@/engine";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { getRoavioCityImage } from "./cityImages";

type EngineImageProps = ComponentProps<typeof EngineImage>;

// These are only request/decode bookkeeping. The image bytes live in the
// browser's normal HTTP memory/disk cache, not in cookies or React state.
const warmedCityImages = new Set<string>();
const warmingCityImages = new Map<string, HTMLImageElement>();

function hasNecessaryConsent(): boolean {
  if (typeof document === "undefined") return false;
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("rv_consent="));
  if (!item) return false;

  try {
    const value = decodeURIComponent(item.slice("rv_consent=".length));
    const choices = JSON.parse(value) as { necessary?: boolean };
    return choices.necessary === true;
  } catch {
    return false;
  }
}

function warmOfficialCityImage(src: string) {
  if (typeof window === "undefined" || !hasNecessaryConsent()) return;
  if (warmedCityImages.has(src) || warmingCityImages.has(src)) return;

  // A detached Image has no layout/paint cost, but still lets the browser fill
  // its HTTP cache. OfficialCityImage later requests this exact URL through NE,
  // so an unmount/remount can be served from cache instead of starting over.
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  warmingCityImages.set(src, image);

  image.onload = () => {
    warmedCityImages.add(src);
    warmingCityImages.delete(src);
    void image.decode().catch(() => undefined);
  };
  image.onerror = () => {
    warmingCityImages.delete(src);
  };
  image.src = src;
}

/**
 * The only Roavio city-photo renderer.
 *
 * `cityImages.ts` contains the exact Unsplash URLs copied from the official
 * Roavio scrape. We deliberately do not search for, generate, proxy, or guess
 * replacement photography here.
 *
 * The real EngineImage stays completely unmounted while the card is far away.
 * Once the user has recorded necessary-cookie consent, a detached low-priority
 * Image may warm the exact official URL farther ahead of the viewport. That
 * fills the browser cache without adding an image node to the card itself.
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
  const warmEligibleRef = useRef(priority);
  const [nearViewport, setNearViewport] = useState(priority);
  const [failed, setFailed] = useState(false);
  const src = getRoavioCityImage(slug);

  useEffect(() => {
    setFailed(false);
    setNearViewport(priority);
    warmEligibleRef.current = priority;
  }, [priority, slug]);

  useEffect(() => {
    if (!src || priority) return;
    const probe = probeRef.current;
    if (!probe) return;

    // Cache-warm well before we create the visible image node. This observer
    // does not cause React state updates and therefore does not make scrolling
    // do extra component work.
    return EngineScheduler.observe(probe, (snapshot) => {
      const eligible = snapshot.near || snapshot.visible;
      warmEligibleRef.current = eligible;
      if (eligible) warmOfficialCityImage(src);
    }, {
      nearMargin: "1600px 0px",
      visibleThreshold: 0.01,
      releaseWhenFar: false,
    });
  }, [priority, src]);

  useEffect(() => {
    if (!src || priority) return;
    const handleConsentChanged = () => {
      // If consent is accepted while a card is already in the warm zone, do
      // not wait for another scroll/observer callback before priming its cache.
      if (warmEligibleRef.current) warmOfficialCityImage(src);
    };
    window.addEventListener("rv:consent-changed", handleConsentChanged);
    return () => window.removeEventListener("rv:consent-changed", handleConsentChanged);
  }, [priority, src]);

  useEffect(() => {
    if (priority) return;
    const probe = probeRef.current;
    if (!probe) return;

    return EngineScheduler.observe(probe, (snapshot) => {
      setNearViewport(snapshot.near || snapshot.visible);
    }, {
      // Keep visible DOM substantially tighter than the cache-warm boundary.
      nearMargin: "640px 0px",
      visibleThreshold: 0.01,
      releaseWhenFar: true,
    });
  }, [priority, slug]);

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
          // Roavio already supplies an explicitly sized/quality-tuned Unsplash
          // URL. Keep it exact so the detached warmer and visible NE image hit
          // the same browser-cache key instead of two different optimizer URLs.
          unoptimized
          onLoad={() => warmedCityImages.add(src)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </>
  );
}
