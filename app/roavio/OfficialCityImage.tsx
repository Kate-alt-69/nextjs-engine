"use client";

import { EngineImage, EngineScheduler } from "@/engine";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { getRoavioCityImage } from "./cityImages";

type EngineImageProps = ComponentProps<typeof EngineImage>;

const warmedCityImages = new Set<string>();
const warmingCityImages = new Map<string, HTMLImageElement>();
const VISIBLE_DOM_MARGIN = 640;
const WARM_MARGIN = 1600;
const MAX_RETRIES = 2;

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

function geometryNear(element: Element, margin: number) {
  const rect = element.getBoundingClientRect();
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

function warmOfficialCityImage(src: string) {
  if (typeof window === "undefined" || !hasNecessaryConsent()) return;
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
  const nearRef = useRef(priority);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const [nearViewport, setNearViewport] = useState(priority);
  const [failed, setFailed] = useState(false);
  const src = getRoavioCityImage(slug);

  const setNear = (next: boolean) => {
    nearRef.current = next;
    setNearViewport((current) => current === next ? current : next);
    if (next && failed && retryCountRef.current <= MAX_RETRIES) setFailed(false);
  };

  useEffect(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    setFailed(false);
    setNear(priority);
    warmEligibleRef.current = priority;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priority, slug]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!src || priority) return;
    const probe = probeRef.current;
    if (!probe) return;

    const syncWarmGeometry = () => {
      const eligible = geometryNear(probe, WARM_MARGIN);
      warmEligibleRef.current = eligible;
      if (eligible) warmOfficialCityImage(src);
    };

    // Do one synchronous geometry bootstrap before waiting for IntersectionObserver.
    // This fixes Chromium/Firefox cases where an observer attached inside a
    // content-visibility subtree did not deliver until a later reload/scroll.
    syncWarmGeometry();

    const stop = EngineScheduler.observe(probe, (snapshot) => {
      const eligible = snapshot.near || snapshot.visible || geometryNear(probe, WARM_MARGIN);
      warmEligibleRef.current = eligible;
      if (eligible) warmOfficialCityImage(src);
    }, {
      nearMargin: `${WARM_MARGIN}px 0px`,
      visibleThreshold: 0.01,
      releaseWhenFar: false,
    });

    window.addEventListener("pageshow", syncWarmGeometry);
    window.addEventListener("resize", syncWarmGeometry, { passive: true });
    return () => {
      stop();
      window.removeEventListener("pageshow", syncWarmGeometry);
      window.removeEventListener("resize", syncWarmGeometry);
    };
  }, [priority, src]);

  useEffect(() => {
    if (!src || priority) return;
    const handleConsentChanged = () => {
      if (warmEligibleRef.current) warmOfficialCityImage(src);
    };
    window.addEventListener("rv:consent-changed", handleConsentChanged);
    return () => window.removeEventListener("rv:consent-changed", handleConsentChanged);
  }, [priority, src]);

  useEffect(() => {
    if (priority) return;
    const probe = probeRef.current;
    if (!probe) return;

    const syncVisibleGeometry = () => setNear(geometryNear(probe, VISIBLE_DOM_MARGIN));

    // Bootstrap the actual visible DOM immediately. This is the important part
    // for home cards that previously stayed as placeholders until reload.
    syncVisibleGeometry();

    const stop = EngineScheduler.observe(probe, (snapshot) => {
      setNear(snapshot.near || snapshot.visible || geometryNear(probe, VISIBLE_DOM_MARGIN));
    }, {
      nearMargin: `${VISIBLE_DOM_MARGIN}px 0px`,
      visibleThreshold: 0.01,
      releaseWhenFar: true,
    });

    let scrollRaf = 0;
    const onScroll = () => {
      if (scrollRaf) return;
      scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        syncVisibleGeometry();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("pageshow", syncVisibleGeometry);
    return () => {
      stop();
      if (scrollRaf) window.cancelAnimationFrame(scrollRaf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pageshow", syncVisibleGeometry);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priority, slug]);

  const handleError = () => {
    if (!src) return;
    setFailed(true);
    warmingCityImages.delete(src);

    if (!nearRef.current || retryCountRef.current >= MAX_RETRIES) return;
    retryCountRef.current += 1;
    const delay = retryCountRef.current === 1 ? 450 : 1100;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (nearRef.current) setFailed(false);
    }, delay);
  };

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
          unoptimized
          onLoad={() => {
            retryCountRef.current = 0;
            warmedCityImages.add(src);
          }}
          onError={handleError}
        />
      ) : null}
    </>
  );
}
