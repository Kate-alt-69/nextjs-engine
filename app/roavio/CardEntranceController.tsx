"use client";

import { EngineScheduler } from "@/engine";
import { useEffect } from "react";

const CARD_SELECTOR = ".rv-result-card,.rv-city-card,.rv-compare-city-card";
const BOUND_ATTR = "data-rv-motion-bound";
const ENTERED_ATTR = "data-rv-entered";
const NEAR_PX = 150;

type CardState = {
  index: number;
  stop: () => void;
  settleTimer?: number;
  enterRaf?: number;
};

function geometryNear(element: Element, margin = NEAR_PX) {
  const rect = element.getBoundingClientRect();
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

export function CardEntranceController() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactMotion = window.matchMedia("(max-width: 819px), (pointer: coarse)");
    const cards = new Map<HTMLElement, CardState>();
    let scanRaf = 0;
    let geometryRaf = 0;

    const clearPending = (element: HTMLElement) => {
      const state = cards.get(element);
      if (!state) return;
      if (state.settleTimer !== undefined) window.clearTimeout(state.settleTimer);
      if (state.enterRaf !== undefined) window.cancelAnimationFrame(state.enterRaf);
      state.settleTimer = undefined;
      state.enterRaf = undefined;
    };

    const setTimingVars = (element: HTMLElement, index: number) => {
      const compact = compactMotion.matches;
      const delay = compact
        ? Math.min(index % 3, 2) * 16
        : Math.min(index % 5, 4) * 24;
      const duration = compact ? 320 : 380;
      element.style.setProperty("--rv-enter-delay", `${delay}ms`);
      element.style.setProperty("--rv-enter-duration", `${duration}ms`);
      return { delay, duration };
    };

    const sleep = (element: HTMLElement) => {
      clearPending(element);
      element.dataset.rvMotionMode = "sleeping";
      element.setAttribute(ENTERED_ATTR, "false");
      element.style.removeProperty("--rv-enter-delay");
      element.style.removeProperty("--rv-enter-duration");
    };

    const enter = (element: HTMLElement, underFramePressure = false) => {
      if (element.getAttribute(ENTERED_ATTR) === "true") return;
      const state = cards.get(element);
      if (!state) return;

      clearPending(element);
      const { delay, duration } = setTimingVars(element, state.index);

      if (reducedMotion.matches || underFramePressure) {
        element.dataset.rvMotionMode = "instant";
        element.setAttribute(ENTERED_ATTR, "true");
        element.style.removeProperty("--rv-enter-delay");
        element.style.removeProperty("--rv-enter-duration");
        return;
      }

      // Force a distinct sleeping -> armed -> animated sequence. Firefox in
      // particular is much more reliable about restarting the keyframe when the
      // animation-name is absent for one frame before it is re-applied.
      element.dataset.rvMotionMode = "armed";
      element.setAttribute(ENTERED_ATTR, "false");
      state.enterRaf = window.requestAnimationFrame(() => {
        state.enterRaf = undefined;
        if (!element.isConnected || !geometryNear(element)) {
          sleep(element);
          return;
        }

        element.dataset.rvMotionMode = "animated";
        element.setAttribute(ENTERED_ATTR, "true");
        state.settleTimer = window.setTimeout(() => {
          state.settleTimer = undefined;
          if (!element.isConnected) return;
          element.dataset.rvMotionMode = "settled";
          element.style.removeProperty("--rv-enter-delay");
          element.style.removeProperty("--rv-enter-duration");
        }, duration + delay + 80);
      });
    };

    const evaluateGeometry = (element: HTMLElement, pressure = false) => {
      if (geometryNear(element)) enter(element, pressure);
      else sleep(element);
    };

    const release = (element: HTMLElement) => {
      clearPending(element);
      cards.get(element)?.stop();
      cards.delete(element);
      element.removeAttribute(BOUND_ATTR);
    };

    const bind = (element: Element, index: number) => {
      if (!(element instanceof HTMLElement) || cards.has(element)) return;

      element.setAttribute(BOUND_ATTR, "true");

      // Never hide something already on/near the first viewport. This removes
      // the SSR -> hidden -> observer callback race that produced a blank
      // Explorer in Firefox and occasionally Chromium.
      if (geometryNear(element)) {
        element.setAttribute(ENTERED_ATTR, "true");
        element.dataset.rvMotionMode = "settled";
      } else {
        element.setAttribute(ENTERED_ATTR, "false");
        element.dataset.rvMotionMode = "sleeping";
      }

      const state: CardState = { index, stop: () => undefined };
      cards.set(element, state);

      state.stop = EngineScheduler.observe(element, (snapshot) => {
        // EngineScheduler supplies the cheap pooled IO path. Geometry is checked
        // too because Firefox has had edge cases when an observed subtree also
        // uses content-visibility.
        if (snapshot.near || snapshot.visible || geometryNear(element)) {
          enter(element, snapshot.underFramePressure);
        } else {
          sleep(element);
        }
      }, {
        nearMargin: `${NEAR_PX}px 0px`,
        visibleThreshold: 0.01,
        releaseWhenFar: true,
      });
    };

    const scan = () => {
      scanRaf = 0;

      for (const element of [...cards.keys()]) {
        if (!element.isConnected) release(element);
      }

      const found = Array.from(document.querySelectorAll(CARD_SELECTOR));
      found.forEach((element, index) => bind(element, index));
    };

    const scheduleScan = () => {
      if (scanRaf) return;
      scanRaf = window.requestAnimationFrame(scan);
    };

    // Shared Firefox/Chromium safety net. At 18 Explorer cards this is tiny,
    // and it is throttled to one geometry pass per animation frame.
    const scheduleGeometryPass = () => {
      if (geometryRaf) return;
      geometryRaf = window.requestAnimationFrame(() => {
        geometryRaf = 0;
        const pressure = EngineScheduler.isUnderFramePressure();
        for (const element of cards.keys()) evaluateGeometry(element, pressure);
      });
    };

    scan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scheduleGeometryPass, { passive: true });
    window.addEventListener("resize", scheduleGeometryPass, { passive: true });
    window.addEventListener("pageshow", scheduleGeometryPass);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleGeometryPass);
      window.removeEventListener("resize", scheduleGeometryPass);
      window.removeEventListener("pageshow", scheduleGeometryPass);
      if (scanRaf) window.cancelAnimationFrame(scanRaf);
      if (geometryRaf) window.cancelAnimationFrame(geometryRaf);
      for (const element of [...cards.keys()]) release(element);
    };
  }, []);

  return null;
}
