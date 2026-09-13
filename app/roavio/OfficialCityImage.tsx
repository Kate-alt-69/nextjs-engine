"use client";

import { EngineBrowser, EngineImage, EngineScheduler, useEngineSchedule } from "@/engine";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import {
  getRoavioFallbackAccent,
  peekRoavioCityAccent,
  resolveRoavioCityAccent,
  type RoavioCityAccent,
} from "./cityAccent";
import { getRoavioCityImage } from "./cityImages";

type EngineImageProps = ComponentProps<typeof EngineImage>;

const warmedCityImages = new Set<string>();
const warmingCityImages = new Map<string, HTMLImageElement>();
const MAX_RETRIES = 2;
const WARM_NEAR_MARGIN = "1600px 0px";
const IMAGE_NEAR_MARGIN = "640px 0px";
const ACCENT_SURFACE_SELECTOR = [
  ".rv-result-card",
  ".rv-city-card",
  ".rv-compare-city-card",
  ".rv-dossier-page",
  "[data-roavio-accent-surface]",
].join(",");

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

function networkAllowsWarmup(): boolean {
  const network = EngineBrowser.network.status();
  if (!network.online || network.saveData) return false;
  if (network.type === "slow-2g" || network.type === "2g" || network.type === "3g") return false;
  if (typeof network.downlink === "number" && network.downlink > 0 && network.downlink < 1.5) return false;
  if (typeof network.rtt === "number" && network.rtt > 700) return false;
  return true;
}

function warmOfficialCityImage(src: string) {
  if (typeof window === "undefined" || !hasNecessaryConsent() || !networkAllowsWarmup()) return;
  if (warmedCityImages.has(src) || warmingCityImages.has(src)) return;

  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  warmingCityImages.set(src, image);

  image.onload = () => {
    warmedCityImages.add(src);
    warmingCityImages.delete(src);
    void image.decode().catch(() => undefined);
  };
  image.onerror = () => warmingCityImages.delete(src);
  image.src = src;
}

/**
 * Thin Roavio adapter around NE's image/runtime systems.
 *
 * - EngineReveal owns the wide card render window.
 * - This NE scheduler probe opens the cache-warm window at ~1600px.
 * - EngineImage owns the real image DOM at ~640px, cached-image recovery,
 *   frame-pressure policy and LCP priority behavior.
 * - The accent probe automatically carries the official image palette up to the
 *   nearest Roavio city surface, so every consumer gets the same behavior.
 */
export function OfficialCityImage({
  slug,
  alt = "",
  className,
  priority = false,
  sizes = "100vw",
  objectFit = "cover",
  style,
  onLoad,
  onAccent,
}: {
  slug: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  objectFit?: EngineImageProps["objectFit"];
  style?: EngineImageProps["style"];
  onLoad?: () => void;
  onAccent?: (accent: RoavioCityAccent) => void;
}) {
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const accentProbeRef = useRef<HTMLSpanElement | null>(null);
  const [failed, setFailed] = useState(false);
  const src = getRoavioCityImage(slug);
  const warmSchedule = useEngineSchedule<HTMLSpanElement>({
    priority,
    nearMargin: WARM_NEAR_MARGIN,
    releaseWhenFar: true,
  });

  const applyAccent = useCallback((accent: RoavioCityAccent, source: "fallback" | "image") => {
    const surface = accentProbeRef.current?.closest(ACCENT_SURFACE_SELECTOR) as HTMLElement | null;
    if (surface) {
      surface.style.setProperty("--rv-city-accent", accent.rgb);
      surface.style.setProperty("--rv-city-accent-hex", accent.hex);
      surface.dataset.accentReady = "true";
      surface.dataset.accentSource = source;
    }
    onAccent?.(accent);
  }, [onAccent]);

  useEffect(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    setFailed(false);

    const cached = peekRoavioCityAccent(slug);
    applyAccent(cached ?? getRoavioFallbackAccent(slug), cached ? "image" : "fallback");
  }, [applyAccent, slug]);

  useEffect(() => () => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    if (
      !src
      || priority
      || !warmSchedule.near
      || warmSchedule.underFramePressure
    ) return;

    let cancelIdle: (() => void) | null = null;
    const scheduleWarm = () => {
      cancelIdle?.();
      if (!hasNecessaryConsent() || !networkAllowsWarmup()) return;
      cancelIdle = EngineScheduler.runWhenIdle(() => warmOfficialCityImage(src), 1200);
    };

    scheduleWarm();
    const stopNetwork = EngineBrowser.network.onchange(scheduleWarm);
    window.addEventListener("rv:consent-changed", scheduleWarm);

    return () => {
      cancelIdle?.();
      stopNetwork();
      window.removeEventListener("rv:consent-changed", scheduleWarm);
    };
  }, [priority, src, warmSchedule.near, warmSchedule.underFramePressure]);

  const handleError = () => {
    if (!src) return;
    warmingCityImages.delete(src);
    if (retryCountRef.current >= MAX_RETRIES) {
      setFailed(true);
      return;
    }

    retryCountRef.current += 1;
    setFailed(true);
    const delay = retryCountRef.current === 1 ? 450 : 1100;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      setFailed(false);
    }, delay);
  };

  if (!src || failed) return null;

  return (
    <>
      <span
        ref={accentProbeRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
      />
      <span
        ref={warmSchedule.ref}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
      />
      <EngineImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        nearMargin={IMAGE_NEAR_MARGIN}
        releaseWhenFar
        sizes={sizes}
        quality={72}
        objectFit={objectFit}
        className={className}
        style={style}
        unoptimized
        onLoad={() => {
          retryCountRef.current = 0;
          warmedCityImages.add(src);
          onLoad?.();
          void resolveRoavioCityAccent(slug).then((accent) => applyAccent(accent, "image"));
        }}
        onError={handleError}
      />
    </>
  );
}
