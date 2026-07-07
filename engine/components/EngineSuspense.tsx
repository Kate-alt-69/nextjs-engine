"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineSuspense
//
//  Schema-native abstraction over React.Suspense.
//  Provides built-in loading presets and timeout handling.
//
//  Supported presets:
//    · skeleton — animated placeholder lines (articles, cards, blog posts)
//    · spinner  — centered loading spinner (buttons, small widgets)
//    · shimmer  — left-to-right shimmer effect (tables, lists, dashboards)
//    · pulse    — opacity animation (images, media)
//    · blur     — blurred content reveal (heroes, progressive loading)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  Suspense,
  memo,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import type { BaseNodeProps } from "../schema/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SuspensePreset = "skeleton" | "spinner" | "shimmer" | "pulse" | "blur";

export interface EngineSuspenseProps extends BaseNodeProps {
  children?: ReactNode;
  /** Built-in loading fallback preset */
  preset?: SuspensePreset;
  /** Minimum height of the placeholder area */
  minHeight?: string | number;
  /** Number of skeleton lines (skeleton preset) */
  skeletonLines?: number;
  /** Delay (ms) before the fallback appears — prevents flash for fast loads */
  delay?: number;
  /** Maximum ms to wait before switching to errorFallback */
  timeout?: number;
  /** Schema node id (string) to render on timeout — for future use */
  errorFallback?: string;
  /** Custom fallback node override */
  fallback?: ReactNode;
}

// ── Keyframe injection (once per session) ─────────────────────────────────────

let _keyframesInjected = false;
function injectKeyframes() {
  if (typeof document === "undefined" || _keyframesInjected) return;
  _keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes e-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    @keyframes e-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }
    @keyframes e-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes e-skeleton-wave {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

// ── Skeleton preset ───────────────────────────────────────────────────────────

function SkeletonFallback({
  lines = 4,
  minHeight,
}: {
  lines?: number;
  minHeight?: string | number;
}) {
  useEffect(() => { injectKeyframes(); }, []);

  const containerStyle: CSSProperties = {
    padding: "1.25rem",
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  };

  const lineStyle = (width: string, height = "14px"): CSSProperties => ({
    height,
    borderRadius: "6px",
    width,
    background:
      "linear-gradient(90deg, var(--e-skeleton-base, #e2e8f0) 25%, var(--e-skeleton-shine, #f1f5f9) 50%, var(--e-skeleton-base, #e2e8f0) 75%)",
    backgroundSize: "200% 100%",
    animation: "e-skeleton-wave 1.5s ease-in-out infinite",
  });

  const widths = ["100%", "85%", "90%", "70%", "95%", "60%", "80%", "75%"];

  return (
    <div style={containerStyle} aria-busy="true" aria-label="Loading..." role="status">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={lineStyle(widths[i % widths.length])} />
      ))}
    </div>
  );
}

// ── Spinner preset ────────────────────────────────────────────────────────────

function SpinnerFallback({ minHeight }: { minHeight?: string | number }) {
  useEffect(() => { injectKeyframes(); }, []);

  const containerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : (minHeight ?? "80px"),
  };

  const spinnerStyle: CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "3px solid var(--e-skeleton-base, #e2e8f0)",
    borderTopColor: "var(--e-accent, #4f46e5)",
    animation: "e-spin 0.7s linear infinite",
  };

  return (
    <div style={containerStyle} role="status" aria-label="Loading...">
      <div style={spinnerStyle} aria-hidden="true" />
    </div>
  );
}

// ── Shimmer preset ────────────────────────────────────────────────────────────

function ShimmerFallback({ minHeight }: { minHeight?: string | number }) {
  useEffect(() => { injectKeyframes(); }, []);

  const style: CSSProperties = {
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : (minHeight ?? "120px"),
    borderRadius: "8px",
    background:
      "linear-gradient(90deg, var(--e-skeleton-base, #e2e8f0) 0%, var(--e-skeleton-shine, #f8fafc) 50%, var(--e-skeleton-base, #e2e8f0) 100%)",
    backgroundSize: "400px 100%",
    animation: "e-shimmer 1.5s ease-in-out infinite",
  };

  return <div style={style} role="status" aria-label="Loading..." aria-busy="true" />;
}

// ── Pulse preset ──────────────────────────────────────────────────────────────

function PulseFallback({ minHeight }: { minHeight?: string | number }) {
  useEffect(() => { injectKeyframes(); }, []);

  const style: CSSProperties = {
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : (minHeight ?? "120px"),
    borderRadius: "8px",
    background: "var(--e-skeleton-base, #e2e8f0)",
    animation: "e-pulse 1.8s ease-in-out infinite",
  };

  return <div style={style} role="status" aria-label="Loading..." aria-busy="true" />;
}

// ── Blur preset ───────────────────────────────────────────────────────────────

function BlurFallback({
  children,
  minHeight,
}: {
  children?: ReactNode;
  minHeight?: string | number;
}) {
  const style: CSSProperties = {
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
    filter: "blur(8px)",
    opacity: 0.6,
    transition: "filter 0.4s ease, opacity 0.4s ease",
    pointerEvents: "none",
  };
  return (
    <div style={style} aria-busy="true" aria-label="Loading..." role="status">
      {children}
    </div>
  );
}

// ── Delayed fallback wrapper ──────────────────────────────────────────────────
//  Hides fallback for `delay` ms to avoid flash on fast loads.

function DelayedFallback({
  delay,
  children,
}: {
  delay: number;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return visible ? <>{children}</> : null;
}

// ── EngineSuspense ────────────────────────────────────────────────────────────

export const EngineSuspense = memo(function EngineSuspense({
  children,
  preset = "skeleton",
  minHeight,
  skeletonLines = 4,
  delay = 0,
  timeout,
  errorFallback,
  fallback,
  style,
  className,
  id,
  point,
  cprop,
  ...props
}: EngineSuspenseProps) {
  const resolvedStyle = usePropStyles(props as any, style);
  const hoverClass   = cpropClass(cprop);
  const mergedClass  = [className, hoverClass].filter(Boolean).join(" ") || undefined;
  const resolvedId   = id ?? point;

  // Build preset fallback
  const presetFallback: ReactNode = (() => {
    if (fallback) return fallback;
    switch (preset) {
      case "skeleton":
        return <SkeletonFallback lines={skeletonLines} minHeight={minHeight} />;
      case "spinner":
        return <SpinnerFallback minHeight={minHeight} />;
      case "shimmer":
        return <ShimmerFallback minHeight={minHeight} />;
      case "pulse":
        return <PulseFallback minHeight={minHeight} />;
      case "blur":
        return <BlurFallback minHeight={minHeight}>{children}</BlurFallback>;
      default:
        return <SkeletonFallback lines={skeletonLines} minHeight={minHeight} />;
    }
  })();

  const wrappedFallback =
    delay > 0 ? (
      <DelayedFallback delay={delay}>{presetFallback}</DelayedFallback>
    ) : (
      presetFallback
    );

  return (
    <div
      id={resolvedId}
      className={mergedClass}
      style={resolvedStyle}
    >
      <Suspense fallback={wrappedFallback}>
        {children}
      </Suspense>
    </div>
  );
});
