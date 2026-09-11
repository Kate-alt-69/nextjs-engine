"use client";

import { EngineCanvas } from "@/engine";
import { EngineCookies } from "@/src/engine/core/enginecookies/EngineCookies";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoavioLocale } from "./i18n";
import type { RoavioThemeMode } from "./locale.server";

type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
};

const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string, maxAge = ONE_YEAR) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function currentMoonPhase(): number {
  const synodicMonth = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (Date.now() - knownNewMoon) / 86_400_000;
  return ((days % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;
}

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.19;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(progress * Math.PI * 0.28);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#f4b53f";
  ctx.lineWidth = Math.max(1.5, w * 0.045);
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    const inner = r * 1.45;
    const outer = r * (1.85 + (i % 2) * 0.1);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.2);
  glow.addColorStop(0, "#fff3ad");
  glow.addColorStop(0.65, "#ffd65a");
  glow.addColorStop(1, "#f4a82f");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.29;
  const phase = currentMoonPhase();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((1 - progress) * -0.16);
  ctx.fillStyle = "#dfe9e5";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(77,101,95,.24)";
  [[-.3, -.22, .13], [.28, -.08, .09], [.08, .33, .11]].forEach(([x, y, rr]) => {
    ctx.beginPath();
    ctx.arc(r * x, r * y, r * rr, 0, Math.PI * 2);
    ctx.fill();
  });

  const shadowX = phase < 0.5
    ? -(phase / 0.5) * r * 2
    : ((1 - ((phase - 0.5) / 0.5)) * r * 2);
  ctx.fillStyle = "rgba(6,17,14,.9)";
  ctx.beginPath();
  ctx.arc(shadowX, 0, r * 1.01, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function CelestialGlyph({ mode }: { mode: RoavioThemeMode }) {
  const startedAt = useRef(typeof performance === "undefined" ? 0 : performance.now());
  useEffect(() => { startedAt.current = performance.now(); }, [mode]);

  const draw = useCallback((context: CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext, canvas: HTMLCanvasElement) => {
    if (!(context instanceof CanvasRenderingContext2D)) return false;
    const elapsed = performance.now() - startedAt.current;
    const progress = Math.min(1, elapsed / 480);
    const eased = 1 - Math.pow(1 - progress, 3);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === "dark") drawMoon(context, canvas.width, canvas.height, eased);
    else drawSun(context, canvas.width, canvas.height, eased);
    return progress >= 1 ? false : undefined;
  }, [mode]);

  return (
    <EngineCanvas
      mode="2d"
      width={38}
      height={38}
      maxDpr={1.5}
      adaptive={false}
      pauseWhenHidden
      pauseWhenOffscreen
      onDraw={draw}
      style={{ width: 38, height: 38, pointerEvents: "none" }}
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
  const [theme, setTheme] = useState<RoavioThemeMode>(initialTheme);
  const [showConsent, setShowConsent] = useState(!initialHasConsent);
  const [customOpen, setCustomOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [personalization, setPersonalization] = useState(true);
  const cookieIndex = useRef<ReturnType<typeof EngineCookies.createIndex> | null>(null);
  const spanish = initialLocale === "es";

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

  const chooseTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.rvTheme = next;
    document.documentElement.style.colorScheme = next;
    writeCookie("rv_theme", next);
  };

  const saveConsent = (choices: ConsentChoices) => {
    writeCookie("rv_consent", JSON.stringify(choices));
    setShowConsent(false);
    setCustomOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`rv-theme-toggle${showConsent ? " rv-theme-toggle--consent" : ""}`}
        onClick={chooseTheme}
        aria-label={theme === "dark" ? (spanish ? "Cambiar a modo claro" : "Switch to light mode") : (spanish ? "Cambiar a modo oscuro" : "Switch to dark mode")}
        title={theme === "dark" ? (spanish ? "Modo oscuro · fase lunar actual" : "Dark mode · current moon phase") : (spanish ? "Modo claro · sol" : "Light mode · sun")}
      >
        <CelestialGlyph mode={theme} />
        <span>{theme === "dark" ? (spanish ? "Oscuro" : "Dark") : (spanish ? "Claro" : "Light")}</span>
      </button>

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
              <div><span className="rv-overline">{spanish ? "CONTROL" : "CONTROL"}</span><h2>{spanish ? "Elige qué guardar" : "Choose what we store"}</h2></div>
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
