"use client";

import { EngineCanvas } from "@/engine";
import { EngineCookies } from "@/src/engine/core/enginecookies/EngineCookies";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoavioLocale } from "./i18n";
import type { RoavioThemeMode } from "./locale.server";

type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
};

type MoonPhaseData = {
  phase: string;
  illumination: number;
  age: number;
  phaseFraction: number;
  source: string;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

const ONE_YEAR = 60 * 60 * 24 * 365;
const SYNODIC_MONTH = 29.530588853;

function writeCookie(name: string, value: string, maxAge = ONE_YEAR) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return decodeURIComponent(item.slice(prefix.length));
  }
  return null;
}

function applyTheme(mode: RoavioThemeMode) {
  document.documentElement.dataset.rvTheme = mode;
  document.documentElement.style.colorScheme = mode;
}

function fallbackMoon(): MoonPhaseData {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (Date.now() - knownNewMoon) / 86_400_000;
  const age = ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phaseFraction = age / SYNODIC_MONTH;
  return {
    phase: "Moon",
    illumination: (1 - Math.cos(phaseFraction * Math.PI * 2)) * 50,
    age,
    phaseFraction,
    source: "fallback",
  };
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.19;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((1 - progress) * -0.18 + progress * 0.08);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#f4b53f";
  ctx.lineWidth = Math.max(1.5, w * 0.045);
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    const inner = r * (1.42 + (1 - progress) * 0.12);
    const outer = r * (1.82 + progress * 0.12);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r * 1.2);
  glow.addColorStop(0, "#fff7c5");
  glow.addColorStop(0.64, "#ffd65a");
  glow.addColorStop(1, "#f3a62b");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number, phaseFraction: number, progress: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.32;
  const angle = phaseFraction * Math.PI * 2;
  const lightX = Math.sin(angle);
  const lightZ = -Math.cos(angle);
  const image = ctx.createImageData(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)));
  const pixels = image.data;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const radiusSq = nx * nx + ny * ny;
      if (radiusSq > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - radiusSq));
      const direct = Math.max(0, nx * lightX + nz * lightZ);
      const edge = Math.min(1, Math.max(0, (1 - radiusSq) * 11));
      const ambient = 0.11;
      const brightness = ambient + direct * 0.89;
      const crater = 1 - 0.055 * (
        Math.exp(-((nx + 0.31) ** 2 + (ny + 0.2) ** 2) / 0.018)
        + Math.exp(-((nx - 0.25) ** 2 + (ny - 0.04) ** 2) / 0.012)
        + Math.exp(-((nx - 0.06) ** 2 + (ny - 0.31) ** 2) / 0.016)
      );
      const value = Math.max(0, Math.min(1, brightness * crater * (0.92 + progress * 0.08)));
      const offset = (y * image.width + x) * 4;
      pixels[offset] = Math.round(214 * value + 12);
      pixels[offset + 1] = Math.round(226 * value + 14);
      pixels[offset + 2] = Math.round(222 * value + 15);
      pixels[offset + 3] = Math.round(255 * edge);
    }
  }

  ctx.putImageData(image, 0, 0);
  ctx.save();
  ctx.strokeStyle = "rgba(224,238,232,.34)";
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function CelestialGlyph({ mode, moon }: { mode: RoavioThemeMode; moon: MoonPhaseData }) {
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = performance.now(); }, [mode, moon.phaseFraction]);

  const draw = useCallback((context: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext, canvas: HTMLCanvasElement) => {
    if (!(context instanceof CanvasRenderingContext2D)) return false;
    if (!startedAt.current) startedAt.current = performance.now();
    const elapsed = performance.now() - startedAt.current;
    const progress = Math.min(1, elapsed / 620);
    const eased = 1 - Math.pow(1 - progress, 3);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === "dark") drawMoon(context, canvas.width, canvas.height, moon.phaseFraction, eased);
    else drawSun(context, canvas.width, canvas.height, eased);
    return progress >= 1 ? false : undefined;
  }, [mode, moon.phaseFraction]);

  return (
    <EngineCanvas
      mode="2d"
      width={40}
      height={40}
      maxDpr={1.5}
      adaptive={false}
      pauseWhenHidden
      pauseWhenOffscreen
      onDraw={draw}
      style={{ width: 40, height: 40, pointerEvents: "none" }}
    />
  );
}

export function PreferencesShell({
  initialTheme,
  initialLocale,
  initialHasConsent,
}: {
  initialTheme: RoavioThemeMode;
  initialLocale: RoavioLocale;
  initialHasConsent: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<RoavioThemeMode>(initialTheme);
  const [locale, setLocale] = useState<RoavioLocale>(initialLocale);
  const [moon, setMoon] = useState<MoonPhaseData>(() => fallbackMoon());
  const [showConsent, setShowConsent] = useState(!initialHasConsent);
  const [customOpen, setCustomOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [personalization, setPersonalization] = useState(true);
  const [footerThemeSlot, setFooterThemeSlot] = useState<HTMLElement | null>(null);
  const cookieIndex = useRef<ReturnType<typeof EngineCookies.createIndex> | null>(null);
  const spanish = locale === "es";

  useEffect(() => setLocale(initialLocale), [initialLocale]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFooterThemeSlot(document.getElementById("rv-footer-theme-slot"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const explicit = readCookie("rv_theme");
    const datasetTheme = document.documentElement.dataset.rvTheme;
    const resolved: RoavioThemeMode = explicit === "dark" || explicit === "light"
      ? explicit
      : datasetTheme === "dark" || datasetTheme === "light"
        ? datasetTheme
        : media.matches ? "dark" : "light";
    setTheme(resolved);
    applyTheme(resolved);

    const followSystem = (event: MediaQueryListEvent) => {
      if (readCookie("rv_theme")) return;
      const next: RoavioThemeMode = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener?.("change", followSystem);
    return () => media.removeEventListener?.("change", followSystem);
  }, [initialTheme]);

  useEffect(() => {
    fetch("/api/moon-phase", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: MoonPhaseData) => {
        if (Number.isFinite(data.phaseFraction)) setMoon(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const index = EngineCookies.createIndex();
    const owner = window.location.origin;
    for (const [alias, purpose] of [
      ["rv_consent", "Stores the user's Roavio cookie-consent choices."],
      ["rv_theme", "Stores the user's light or dark appearance preference."],
      ["rv_lang", "Stores the user's Roavio interface language preference."],
    ] as const) {
      index.register({ alias, owner, creator: "roavio-proposal", purpose, binding: "none", commands: [] });
    }
    cookieIndex.current = index;
    return () => { cookieIndex.current?.clear(); cookieIndex.current = null; };
  }, []);

  useEffect(() => {
    const handleLanguageClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const match = url.pathname.match(/^\/lang\/(es|en)\/?$/);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const next = match[1] as RoavioLocale;
      setLocale(next);
      writeCookie("rv_lang", next);
      document.documentElement.lang = next;
      document.documentElement.dataset.rvLocale = next;
      router.refresh();
    };
    document.addEventListener("click", handleLanguageClick, true);
    return () => document.removeEventListener("click", handleLanguageClick, true);
  }, [router]);

  const chooseTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    const apply = () => {
      setTheme(next);
      applyTheme(next);
      writeCookie("rv_theme", next);
    };
    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(apply);
    } else {
      document.documentElement.classList.add("rv-theme-changing");
      apply();
      window.setTimeout(() => document.documentElement.classList.remove("rv-theme-changing"), 480);
    }
  };

  const saveConsent = (choices: ConsentChoices) => {
    writeCookie("rv_consent", JSON.stringify(choices));
    setShowConsent(false);
    setCustomOpen(false);
  };

  const phaseLabel = modeLabel(theme, moon.phase, spanish);
  const themeControl = (
    <button
      type="button"
      className="rv-theme-toggle"
      onClick={chooseTheme}
      aria-label={theme === "dark" ? (spanish ? "Cambiar a modo claro" : "Switch to light mode") : (spanish ? "Cambiar a modo oscuro" : "Switch to dark mode")}
      title={theme === "dark" ? `${moon.phase} · ${Math.round(moon.illumination)}%` : (spanish ? "Modo claro · sol" : "Light mode · sun")}
    >
      <CelestialGlyph mode={theme} moon={moon} />
      <span>{phaseLabel}</span>
    </button>
  );

  return (
    <>
      {footerThemeSlot ? createPortal(themeControl, footerThemeSlot) : null}

      {showConsent ? (
        <aside className="rv-cookie" aria-label={spanish ? "Preferencias de cookies" : "Cookie preferences"}>
          <div className="rv-cookie__mark" aria-hidden>◌</div>
          <div>
            <strong>{spanish ? "Tus preferencias, sin drama." : "Your preferences, without the drama."}</strong>
            <p>{spanish ? "Usamos cookies necesarias para recordar tus elecciones. Las opcionales se activan solo si tú quieres." : "We use necessary cookies to remember your choices. Optional cookies turn on only if you want them."}</p>
          </div>
          <div className="rv-cookie__actions">
            <button type="button" className="rv-primary" onClick={() => saveConsent({ necessary: true, analytics: true, personalization: true })}>{spanish ? "Aceptar todas" : "Accept all"}</button>
            <button type="button" className="rv-secondary" onClick={() => setCustomOpen(true)}>{spanish ? "Personalizar" : "Customize"}</button>
          </div>
        </aside>
      ) : null}

      {customOpen ? (
        <div className="rv-cookie-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomOpen(false); }}>
          <section className="rv-cookie-custom" role="dialog" aria-modal="true" aria-label={spanish ? "Personalizar cookies" : "Customize cookies"}>
            <div className="rv-cookie-custom__head">
              <div><span className="rv-overline">CONTROL</span><h2>{spanish ? "Elige qué guardar" : "Choose what we store"}</h2></div>
              <button type="button" className="rv-icon-btn" onClick={() => setCustomOpen(false)} aria-label={spanish ? "Cerrar" : "Close"}>×</button>
            </div>
            <label className="rv-cookie-choice">
              <span><strong>{spanish ? "Necesarias" : "Necessary"}</strong><small>{spanish ? "Consentimiento y funcionamiento básico. Siempre activas." : "Consent and basic functionality. Always on."}</small></span>
              <input type="checkbox" checked disabled />
            </label>
            <label className="rv-cookie-choice">
              <span><strong>{spanish ? "Analítica" : "Analytics"}</strong><small>{spanish ? "Medición agregada para entender qué partes ayudan de verdad." : "Aggregated measurement to understand what actually helps."}</small></span>
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
            </label>
            <label className="rv-cookie-choice">
              <span><strong>{spanish ? "Personalización" : "Personalization"}</strong><small>{spanish ? "Preferencias como tema e idioma para que Roavio se sienta tuyo." : "Preferences like theme and language so Roavio feels like yours."}</small></span>
              <input type="checkbox" checked={personalization} onChange={(event) => setPersonalization(event.target.checked)} />
            </label>
            <button type="button" className="rv-primary rv-cookie-save" onClick={() => saveConsent({ necessary: true, analytics, personalization })}>{spanish ? "Guardar selección" : "Save choices"}</button>
          </section>
        </div>
      ) : null}
    </>
  );
}

function modeLabel(theme: RoavioThemeMode, phase: string, spanish: boolean) {
  if (theme === "light") return spanish ? "Claro" : "Light";
  const translated: Record<string, string> = {
    "New Moon": "Luna nueva",
    "Waxing Crescent": "Creciente",
    "First Quarter": "Cuarto creciente",
    "Waxing Gibbous": "Gibosa creciente",
    "Full Moon": "Luna llena",
    "Waning Gibbous": "Gibosa menguante",
    "Last Quarter": "Cuarto menguante",
    "Waning Crescent": "Menguante",
  };
  return spanish ? (translated[phase] ?? "Oscuro") : phase;
}
