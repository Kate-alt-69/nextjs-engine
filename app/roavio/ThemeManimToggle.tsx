"use client";

import { EngineManim, type ManimConfig } from "@/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RoavioThemeMode } from "./locale.server";
import styles from "./ThemeManimToggle.module.css";

const WIDTH = 112;
const HEIGHT = 52;
const LIGHT_POS = { x: 24, y: 29, radius: 10.8 };
const DARK_POS = { x: 88, y: 24, radius: 11.4 };
const APEX_POS = { x: 56, y: 13, radius: 10.9 };

function circle(
  id: string,
  x: number,
  y: number,
  radius: number,
  options: { fillColor?: string; strokeColor?: string; strokeWidth?: number } = {},
) {
  return {
    id,
    type: "Circle" as const,
    x,
    y,
    radius,
    fillColor: options.fillColor ?? "transparent",
    strokeColor: options.strokeColor ?? "transparent",
    strokeWidth: options.strokeWidth ?? 0,
  };
}

function makeOrbConfig(
  from: RoavioThemeMode,
  to: RoavioThemeMode,
  reducedMotion: boolean,
): ManimConfig {
  const fromPos = from === "dark" ? DARK_POS : LIGHT_POS;
  const toPos = to === "dark" ? DARK_POS : LIGHT_POS;
  const fill = "#fff2bd";

  if (from === to || reducedMotion) {
    return {
      mobjects: [circle("orb-current", toPos.x, toPos.y, toPos.radius, {
        fillColor: fill,
        strokeColor: "rgba(255,255,255,.72)",
        strokeWidth: 1,
      })],
      timeline: [{ action: "FadeIn", target: "orb-current", durationMs: 1 }],
      settings: { loop: false, fpsLimit: 60, background: "transparent" },
    };
  }

  return {
    mobjects: [
      circle("orb-from", fromPos.x, fromPos.y, fromPos.radius, {
        fillColor: fill,
        strokeColor: "rgba(255,255,255,.72)",
        strokeWidth: 1,
      }),
      circle("orb-apex", APEX_POS.x, APEX_POS.y, APEX_POS.radius, {
        fillColor: fill,
        strokeColor: "rgba(255,255,255,.72)",
        strokeWidth: 1,
      }),
      circle("orb-to", toPos.x, toPos.y, toPos.radius, {
        fillColor: fill,
        strokeColor: "rgba(255,255,255,.72)",
        strokeWidth: 1,
      }),
    ],
    timeline: [
      {
        action: "Transform",
        origin: "orb-from",
        target: "orb-apex",
        durationMs: 175,
        easing: "ease-in-out",
      },
      {
        action: "Transform",
        origin: "orb-apex",
        target: "orb-to",
        durationMs: 255,
        easing: "ease-out",
      },
    ],
    settings: { loop: false, fpsLimit: 60, background: "transparent" },
  };
}

function makeHaloConfig(
  from: RoavioThemeMode,
  to: RoavioThemeMode,
  reducedMotion: boolean,
): ManimConfig {
  const fromPos = from === "dark" ? DARK_POS : LIGHT_POS;
  const toPos = to === "dark" ? DARK_POS : LIGHT_POS;
  const haloRadius = (radius: number) => radius + 5.5;

  if (from === to || reducedMotion) {
    return {
      mobjects: [circle("halo-current", toPos.x, toPos.y, haloRadius(toPos.radius), {
        strokeColor: "rgba(255,255,255,.27)",
        strokeWidth: 1.15,
      })],
      timeline: [{ action: "FadeIn", target: "halo-current", durationMs: 1 }],
      settings: { loop: false, fpsLimit: 60, background: "transparent" },
    };
  }

  return {
    mobjects: [
      circle("halo-from", fromPos.x, fromPos.y, haloRadius(fromPos.radius), {
        strokeColor: "rgba(255,255,255,.27)",
        strokeWidth: 1.15,
      }),
      circle("halo-apex", APEX_POS.x, APEX_POS.y, haloRadius(APEX_POS.radius), {
        strokeColor: "rgba(255,255,255,.27)",
        strokeWidth: 1.15,
      }),
      circle("halo-to", toPos.x, toPos.y, haloRadius(toPos.radius), {
        strokeColor: "rgba(255,255,255,.27)",
        strokeWidth: 1.15,
      }),
    ],
    timeline: [
      {
        action: "Transform",
        origin: "halo-from",
        target: "halo-apex",
        durationMs: 175,
        easing: "ease-in-out",
      },
      {
        action: "Transform",
        origin: "halo-apex",
        target: "halo-to",
        durationMs: 255,
        easing: "ease-out",
      },
    ],
    settings: { loop: false, fpsLimit: 60, background: "transparent" },
  };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);

  return reduced;
}

export function ThemeManimToggle({
  theme,
  onToggle,
  ariaLabel,
  title,
}: {
  theme: RoavioThemeMode;
  onToggle: () => void;
  ariaLabel: string;
  title: string;
}) {
  const previousTheme = useRef<RoavioThemeMode>(theme);
  const reducedMotion = useReducedMotion();
  const fromTheme = previousTheme.current;

  const orbConfig = useMemo(
    () => makeOrbConfig(fromTheme, theme, reducedMotion),
    [fromTheme, reducedMotion, theme],
  );
  const haloConfig = useMemo(
    () => makeHaloConfig(fromTheme, theme, reducedMotion),
    [fromTheme, reducedMotion, theme],
  );

  useEffect(() => {
    previousTheme.current = theme;
  }, [theme]);

  const transitionKey = `${fromTheme}-${theme}-${reducedMotion ? "reduced" : "motion"}`;

  return (
    <button
      type="button"
      className={styles.toggle}
      data-mode={theme}
      onClick={onToggle}
      aria-pressed={theme === "dark"}
      aria-label={ariaLabel}
      title={title}
    >
      <span className={styles.scene} aria-hidden="true">
        <span className={styles.daySky} />
        <span className={styles.nightSky} />
        <span className={styles.horizonGlow} />

        <span className={styles.cloudCloudlet} />
        <span className={styles.cloudMain} />

        <span className={`${styles.star} ${styles.starOne}`} />
        <span className={`${styles.star} ${styles.starTwo}`} />
        <span className={`${styles.star} ${styles.starThree}`} />
        <span className={`${styles.star} ${styles.starFour}`} />
        <span className={`${styles.star} ${styles.starFive}`} />

        <span className={styles.sunRays} />

        <span className={styles.engineLayer}>
          <EngineManim
            key={`halo-${transitionKey}`}
            cprop={{ manim: haloConfig }}
            width={WIDTH}
            height={HEIGHT}
            className={styles.manimCanvas}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
          <EngineManim
            key={`orb-${transitionKey}`}
            cprop={{ manim: orbConfig }}
            width={WIDTH}
            height={HEIGHT}
            className={styles.manimCanvas}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        </span>

        <span className={styles.moonShade} />
        <span className={styles.moonCraterOne} />
        <span className={styles.moonCraterTwo} />
        <span className={styles.glassSheen} />
      </span>
    </button>
  );
}
