"use client";

import {
  EngineScheduler,
  EngineScroll,
  type EngineScrollDirector,
  type EngineScrollDirectorConfig,
} from "@/engine";
import { useEffect } from "react";

const CARD_SELECTOR = ".rv-result-card,.rv-city-card,.rv-compare-city-card";
const BOUND_ATTR = "data-rv-motion-bound";
const ENTERED_ATTR = "data-rv-entered";
const RENDER_MARGIN_PX = 760;
const MOTION_MARGIN_PX = 150;

type CardState = {
  index: number;
  id: string;
  renderTrack: string;
  motionTrack: string;
  generatedId: boolean;
  settleTimer?: number;
  enterRaf?: number;
};

type CardSize = { width: number; height: number };

let nextGeneratedCardId = 0;

function pointSpacing(): number {
  const spacing = EngineScroll.state().page.pointSpacing;
  return Number.isFinite(spacing) && spacing > 0 ? spacing : 1;
}

function ensureCardId(element: HTMLElement): { id: string; generated: boolean } {
  if (element.id) return { id: element.id, generated: false };
  nextGeneratedCardId += 1;
  const id = `rv-scroll-card-${nextGeneratedCardId}`;
  element.id = id;
  return { id, generated: true };
}

function timelineRangeForCard(
  id: string,
  heightPx: number,
  marginPx: number,
  spacing: number,
) {
  const target = `#${id}` as `#${string}`;
  const safeHeight = Math.max(1, heightPx);
  const safeSpacing = Math.max(1, spacing);

  return {
    start: target,
    end: target,
    source: "top" as const,
    startAlign: "end" as const,
    endAlign: "start" as const,
    // EngineScroll offsets are measured in EngineScroll points rather than CSS
    // pixels. Start before the card reaches the viewport and end after its
    // bottom has fully passed the viewport top.
    startOffset: -marginPx / safeSpacing,
    endOffset: (safeHeight + marginPx) / safeSpacing,
    easing: "linear" as const,
  };
}

export function CardEntranceController() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    EngineScroll.initialize();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactMotion = window.matchMedia("(max-width: 819px), (pointer: coarse)");
    const cards = new Map<HTMLElement, CardState>();
    const sizes = new WeakMap<HTMLElement, CardSize>();
    let director: EngineScrollDirector<EngineScrollDirectorConfig> | null = null;
    let rebuildRaf = 0;
    let hasBuiltOnce = false;

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

    const setRenderNear = (element: HTMLElement, near: boolean) => {
      element.dataset.rvRender = near ? "near" : "sleeping";
      if (!near) {
        clearPending(element);
        element.dataset.rvMotionMode = "sleeping";
        element.setAttribute(ENTERED_ATTR, "false");
        element.style.removeProperty("--rv-enter-delay");
        element.style.removeProperty("--rv-enter-duration");
      }
    };

    const sleepMotion = (element: HTMLElement) => {
      clearPending(element);
      element.dataset.rvMotionMode = "sleeping";
      element.setAttribute(ENTERED_ATTR, "false");
      element.style.removeProperty("--rv-enter-delay");
      element.style.removeProperty("--rv-enter-duration");
    };

    const settleMotion = (element: HTMLElement) => {
      clearPending(element);
      element.dataset.rvMotionMode = "settled";
      element.setAttribute(ENTERED_ATTR, "true");
      element.style.removeProperty("--rv-enter-delay");
      element.style.removeProperty("--rv-enter-duration");
    };

    const enterMotion = (element: HTMLElement) => {
      if (element.getAttribute(ENTERED_ATTR) === "true") return;
      const state = cards.get(element);
      if (!state) return;

      setRenderNear(element, true);
      clearPending(element);
      const { delay, duration } = setTimingVars(element, state.index);

      if (reducedMotion.matches || EngineScheduler.isUnderFramePressure()) {
        element.dataset.rvMotionMode = "instant";
        element.setAttribute(ENTERED_ATTR, "true");
        element.style.removeProperty("--rv-enter-delay");
        element.style.removeProperty("--rv-enter-duration");
        return;
      }

      // Timeline activity is the scroll trigger. One compositor-frame gap is
      // deliberate so Firefox sees animation-name disappear before it is
      // re-applied, which makes reverse/re-entry pops deterministic.
      element.dataset.rvMotionMode = "armed";
      element.setAttribute(ENTERED_ATTR, "false");
      state.enterRaf = window.requestAnimationFrame(() => {
        state.enterRaf = undefined;
        if (!element.isConnected || element.dataset.rvRender !== "near") return;

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

    const cleanupCard = (element: HTMLElement) => {
      const state = cards.get(element);
      if (!state) return;
      clearPending(element);
      element.removeAttribute(BOUND_ATTR);
      element.removeAttribute(ENTERED_ATTR);
      delete element.dataset.rvMotionMode;
      delete element.dataset.rvRender;
      delete element.dataset.rvMotionEngine;
      element.style.removeProperty("--rv-enter-delay");
      element.style.removeProperty("--rv-enter-duration");
      if (state.generatedId && element.id === state.id) element.removeAttribute("id");
      cards.delete(element);
    };

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver((entries) => {
          let materiallyChanged = false;
          for (const entry of entries) {
            if (!(entry.target instanceof HTMLElement) || !cards.has(entry.target)) continue;
            const rect = entry.target.getBoundingClientRect();
            const previous = sizes.get(entry.target);
            const next = { width: rect.width, height: rect.height };
            sizes.set(entry.target, next);
            if (!previous || Math.abs(previous.width - next.width) > 1 || Math.abs(previous.height - next.height) > 1) {
              materiallyChanged = true;
            }
          }
          if (materiallyChanged) scheduleRebuild();
        })
      : null;

    const rebuild = () => {
      rebuildRaf = 0;
      director?.dispose();
      director = null;

      const found = Array.from(document.querySelectorAll(CARD_SELECTOR))
        .filter((element): element is HTMLElement => element instanceof HTMLElement);
      const foundSet = new Set(found);

      for (const element of [...cards.keys()]) {
        if (!foundSet.has(element)) cleanupCard(element);
      }

      resizeObserver?.disconnect();
      const spacing = pointSpacing();
      const config: Record<string, ReturnType<typeof timelineRangeForCard>> = {};
      const newlyBound = new Set<HTMLElement>();

      found.forEach((element, index) => {
        let state = cards.get(element);
        if (!state) {
          const identity = ensureCardId(element);
          state = {
            index,
            id: identity.id,
            generatedId: identity.generated,
            renderTrack: `${identity.id}__render`,
            motionTrack: `${identity.id}__motion`,
          };
          cards.set(element, state);
          newlyBound.add(element);
        } else {
          state.index = index;
        }

        element.setAttribute(BOUND_ATTR, "true");
        element.dataset.rvMotionEngine = "engine-scroll-timeline";

        const rect = element.getBoundingClientRect();
        sizes.set(element, { width: rect.width, height: rect.height });
        resizeObserver?.observe(element);

        config[state.renderTrack] = timelineRangeForCard(
          state.id,
          rect.height,
          RENDER_MARGIN_PX,
          spacing,
        );
        config[state.motionTrack] = timelineRangeForCard(
          state.id,
          rect.height,
          MOTION_MARGIN_PX,
          spacing,
        );
      });

      if (Object.keys(config).length === 0) {
        hasBuiltOnce = true;
        return;
      }

      director = EngineScroll.direct(config);

      for (const [element, state] of cards) {
        const renderFrame = director.snapshotTrack(state.renderTrack);
        const motionFrame = director.snapshotTrack(state.motionTrack);

        setRenderNear(element, renderFrame.active);
        if (renderFrame.active && motionFrame.active) {
          if (hasBuiltOnce && newlyBound.has(element)) enterMotion(element);
          else settleMotion(element);
        } else {
          sleepMotion(element);
        }

        director.onEnter(state.renderTrack, () => setRenderNear(element, true));
        director.onLeave(state.renderTrack, () => setRenderNear(element, false));
        director.onEnter(state.motionTrack, () => enterMotion(element));
        director.onLeave(state.motionTrack, () => sleepMotion(element));
      }

      hasBuiltOnce = true;
    };

    function scheduleRebuild() {
      if (rebuildRaf) return;
      rebuildRaf = window.requestAnimationFrame(rebuild);
    }

    rebuild();

    // React can replace/filter/paginate cards. MutationObserver only rebuilds
    // the timeline directory when the card set changes; it is not part of the
    // scroll hot path.
    const mutationObserver = new MutationObserver(scheduleRebuild);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      director?.dispose();
      if (rebuildRaf) window.cancelAnimationFrame(rebuildRaf);
      for (const element of [...cards.keys()]) cleanupCard(element);
    };
  }, []);

  return null;
}
