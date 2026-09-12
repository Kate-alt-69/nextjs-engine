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

      element.setAttribute(BOUND_ATTR, "true");
      element.setAttribute(ENTERED_ATTR, "false");
      element.style.setProperty("--rv-enter-delay", `${Math.min(index % 6, 5) * 42}ms`);

      let stop = () => undefined;
      stop = EngineScheduler.observe(element, (snapshot) => {
        if (!snapshot.visible || element.getAttribute(ENTERED_ATTR) === "true") return;

        if (reducedMotion.matches || snapshot.underFramePressure) {
          element.dataset.rvMotionMode = "instant";
          element.setAttribute(ENTERED_ATTR, "true");
          element.style.removeProperty("--rv-enter-delay");
          queueMicrotask(stop);
          subscriptions.delete(element);
          return;
        }

        element.dataset.rvMotionMode = "animated";
        window.requestAnimationFrame(() => {
          element.setAttribute(ENTERED_ATTR, "true");
          const delay = Math.min(index % 6, 5) * 42;
          const timer = window.setTimeout(() => {
            element.style.removeProperty("--rv-enter-delay");
            element.dataset.rvMotionMode = "settled";
            settleTimers.delete(element);
          }, 680 + delay);
          settleTimers.set(element, timer);
        });

        queueMicrotask(stop);
        subscriptions.delete(element);
      }, {
        nearMargin: "220px 0px",
        visibleThreshold: 0.04,
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
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (scanRaf) window.cancelAnimationFrame(scanRaf);
      for (const element of [...subscriptions.keys()]) release(element);
      for (const timer of settleTimers.values()) window.clearTimeout(timer);
      settleTimers.clear();
    };
  }, []);

  return null;
}
