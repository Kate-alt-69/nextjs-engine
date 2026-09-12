"use client";

import { EngineManim, type ManimConfig } from "@/engine";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

function burstConfig(): ManimConfig {
  return {
    mobjects: [
      { id: "ring", type: "Circle", radius: 15, x: 22, y: 22, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-a", type: "Line", x1: 22, y1: 3, x2: 22, y2: 9, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-b", type: "Line", x1: 35.5, y1: 8.5, x2: 31, y2: 13, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-c", type: "Line", x1: 41, y1: 22, x2: 35, y2: 22, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-d", type: "Line", x1: 35.5, y1: 35.5, x2: 31, y2: 31, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-e", type: "Line", x1: 22, y1: 41, x2: 22, y2: 35, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-f", type: "Line", x1: 8.5, y1: 35.5, x2: 13, y2: 31, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-g", type: "Line", x1: 3, y1: 22, x2: 9, y2: 22, strokeColor: "#c8f36b", strokeWidth: 2 },
      { id: "ray-h", type: "Line", x1: 8.5, y1: 8.5, x2: 13, y2: 13, strokeColor: "#c8f36b", strokeWidth: 2 },
    ],
    timeline: [
      { action: "Create", target: "ring", durationMs: 120, easing: "ease-out" },
      { action: "Create", target: "ray-a", durationMs: 30, easing: "ease-out" },
      { action: "Create", target: "ray-c", durationMs: 30, easing: "ease-out" },
      { action: "Create", target: "ray-e", durationMs: 30, easing: "ease-out" },
      { action: "Create", target: "ray-g", durationMs: 30, easing: "ease-out" },
      { action: "Create", target: "ray-b", durationMs: 25, easing: "ease-out" },
      { action: "Create", target: "ray-d", durationMs: 25, easing: "ease-out" },
      { action: "Create", target: "ray-f", durationMs: 25, easing: "ease-out" },
      { action: "Create", target: "ray-h", durationMs: 25, easing: "ease-out" },
      { action: "FadeOut", target: "ring", durationMs: 120, easing: "ease-out" },
    ],
    settings: { loop: false, fpsLimit: 60, background: "transparent" },
  };
}

function ThumbIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="M7.6 10.1 11.3 4c.5-.8 1.7-.8 2.1 0 .2.4.3.8.2 1.2l-.6 3.2h5.3c1.6 0 2.7 1.5 2.2 3l-1.7 6.3c-.3 1.1-1.3 1.9-2.5 1.9H7.6V10.1Zm0 0H4.9c-.8 0-1.4.6-1.4 1.4v6.7c0 .8.6 1.4 1.4 1.4h2.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AnimatedLikeButton({
  active,
  onToggle,
  locale,
  city,
}: {
  active: boolean;
  onToggle: () => void;
  locale: "es" | "en";
  city: string;
}) {
  const [burst, setBurst] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const config = useMemo(burstConfig, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!active && !reduceMotion) setBurst((value) => value + 1);
    onToggle();
  };

  const label = active
    ? locale === "es" ? `Quitar Me gusta de ${city}` : `Unlike ${city}`
    : locale === "es" ? `Me gusta ${city}` : `Like ${city}`;

  return (
    <button
      type="button"
      className="rv-city-like"
      data-active={active}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={handleClick}
    >
      <span key={`thumb-${active}-${burst}`} className="rv-city-like__thumb"><ThumbIcon active={active} /></span>
      {burst > 0 && !reduceMotion ? (
        <span className="rv-city-like__burst" aria-hidden="true">
          <EngineManim key={`like-burst-${burst}`} cprop={{ manim: config }} width={44} height={44} />
        </span>
      ) : null}
    </button>
  );
}
