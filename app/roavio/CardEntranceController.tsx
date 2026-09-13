"use client";

import { EngineScheduler } from "@/engine";
import { useEffect } from "react";

const CARD_SELECTOR = ".rv-result-card,.rv-city-card,.rv-compare-city-card";
const BOUND_ATTR = "data-rv-motion-bound";
const ENTERED_ATTR = "data-rv-entered";

export function CardEntranceController() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactMotion = window.matchMedia("(max-width: 819px), (pointer: coarse)");
    const subscriptions = new Map<Element, () => void>();
    const settleTimers = new Map<Element, number>();
    let scanRaf = 0;

    const release = (element: Element) => {
      subscriptions.get(element)?.();
      subscriptions.delete(element);
      const timer = settleTimers.get(element);
      if (timer !== undefined) window.clearTimeout(timer);
      settleTimers.delete(element);
    };

    const bind = (element: Element, index: number) => {
      if (!(element instanceof HTMLElement) || element.hasAttribute(BOUND_ATTR)) return;

      const compact = compactMotion.matches;
      const delay = compact
        ? Math.min(index % 3, 2) * 18
        : Math.min(index % 5, 4) * 28;
      const duration = compact ? 340 : 400;

      element.setAttribute(BOUND_ATTR, "true");
      element.setAttribute(ENTERED_ATTR, "false");
      element.style.setProperty("--rv-enter-delay", `${delay}ms`);
      element.style.setProperty("--rv-enter-duration", `${duration}ms`);

      let stop: () => void = () => undefined;
      stop = EngineScheduler.observe(element, (snapshot) => {
        if ((!snapshot.near && !snapshot.visible) || element.getAttribute(ENTERED_ATTR) === "true") return;

        if (reducedMotion.matches || snapshot.underFramePressure) {
          element.dataset.rvMotionMode = "instant";
          element.setAttribute(ENTERED_ATTR, "true");
          element.style.removeProperty("--rv-enter-delay");
          element.style.removeProperty("--rv-enter-duration");
          queueMicrotask(stop);
          subscriptions.delete(element);
          return;
        }

        element.dataset.rvMotionMode = "animated";
        window.requestAnimationFrame(() => {
          if (!element.isConnected) {
            release(element);
            return;
          }

          element.setAttribute(ENTERED_ATTR, "true");
          const timer = window.setTimeout(() => {
            element.style.removeProperty("--rv-enter-delay");
            element.style.removeProperty("--rv-enter-duration");
            element.dataset.rvMotionMode = "settled";
            settleTimers.delete(element);
          }, duration + delay + 100);
          settleTimers.set(element, timer);
        });

        queueMicrotask(stop);
        subscriptions.delete(element);
      }, {
        // Start just before the card reaches the viewport. Images are warmed much
        // earlier by OfficialCityImage, so decoding does not fight the pop motion.
        nearMargin: "96px 0px",
        visibleThreshold: 0.01,
        releaseWhenFar: true,
      });

      subscriptions.set(element, stop);
    };

    const scan = () => {
      scanRaf = 0;

      for (const element of [...subscriptions.keys()]) {
        if (!element.isConnected) release(element);
      }

      const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
      cards.forEach((element, index) => bind(element, index));
    };

    const scheduleScan = () => {
      if (scanRaf) return;
      scanRaf = window.requestAnimationFrame(scan);
    };

    scan();
    document.documentElement.dataset.rvMotion = "ready";

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (scanRaf) window.cancelAnimationFrame(scanRaf);
      for (const element of [...subscriptions.keys()]) release(element);
      for (const timer of settleTimers.values()) window.clearTimeout(timer);
      settleTimers.clear();
      if (document.documentElement.dataset.rvMotion === "ready") {
        delete document.documentElement.dataset.rvMotion;
      }
    };
  }, []);

  return null;
}
