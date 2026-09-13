"use client";

import { EngineDialog, useEngineTransitions } from "@/engine";
import { EngineCookies } from "@/src/engine/core/enginecookies/EngineCookies";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RoavioLocale } from "./i18n";
import type { RoavioThemeMode } from "./locale.server";
import { ThemeManimToggle } from "./ThemeManimToggle";

type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  personalization: boolean;
};

const ONE_YEAR = 60 * 60 * 24 * 365;

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
  const transitions = useEngineTransitions();
  const [theme, setTheme] = useState<RoavioThemeMode>(initialTheme);
  const [locale, setLocale] = useState<RoavioLocale>(initialLocale);
  const [showConsent, setShowConsent] = useState(!initialHasConsent);
  const [customOpen, setCustomOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [personalization, setPersonalization] = useState(true);
  const cookieIndex = useRef<ReturnType<typeof EngineCookies.createIndex> | null>(null);
  const spanish = locale === "es";

  useEffect(() => setLocale(initialLocale), [initialLocale]);

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

    // Theme changes share NE's transition runtime with route navigation, so a
    // theme animation cannot race an EngineTransitionLink native transition.
    void transitions.run(apply, {
      type: "layout",
      duration: 280,
      easing: "ease-out",
    });
  };

  const saveConsent = (choices: ConsentChoices) => {
    writeCookie("rv_consent", JSON.stringify(choices));
    window.dispatchEvent(new CustomEvent("rv:consent-changed", { detail: choices }));
    setShowConsent(false);
    setCustomOpen(false);
  };

  const themeControl = (
    <ThemeManimToggle
      theme={theme}
      onToggle={chooseTheme}
      ariaLabel={theme === "dark"
        ? (spanish ? "Cambiar a modo claro" : "Switch to light mode")
        : (spanish ? "Cambiar a modo oscuro" : "Switch to dark mode")}
      title={theme === "dark"
        ? (spanish ? "Cambiar al cielo diurno" : "Switch to daylight")
        : (spanish ? "Cambiar al cielo nocturno" : "Switch to night sky")}
    />
  );

  return (
    <>
      <div className={`rv-footer-theme-dock${showConsent ? " rv-footer-theme-dock--consent" : ""}`}>{themeControl}</div>

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

      <EngineDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        title={spanish ? "Elige qué guardar" : "Choose what we store"}
        ariaLabel={spanish ? "Personalizar cookies" : "Customize cookies"}
        closeLabel={spanish ? "Cerrar" : "Close"}
        duration={180}
        className="rv-cookie-custom"
        overlayStyle={{
          background: "rgba(4,12,10,.46)",
          backdropFilter: "blur(6px)",
        }}
        style={{
          width: "min(520px, calc(100vw - 2rem))",
          maxHeight: "min(86svh, 46rem)",
          padding: "1.15rem",
          border: "1px solid var(--rv-line)",
          borderRadius: "24px",
          background: "var(--rv-card)",
          color: "var(--rv-ink)",
          boxShadow: "0 30px 90px rgba(0,0,0,.28)",
        }}
      >
        <span className="rv-overline">CONTROL</span>
        <label className="rv-cookie-choice">
          <span><strong>{spanish ? "Necesarias" : "Necessary"}</strong><small>{spanish ? "Consentimiento y funcionamiento básico. Siempre activas." : "Consent and basic functionality. Always on."}</small></span>
          <input type="checkbox" checked disabled />
        </label>
        <label className="rv-cookie-choice">
          <span><strong>{spanish ? "Analítica" : "Analytics"}</strong><small>{spanish ? "Medición agregada para entender qué partes ayudan de verdad." : "Aggregated measurement to understand what actually helps."}</small></span>
          <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
        </label>
        <label className="rv-cookie-choice">
          <span><strong>{spanish ? "Personalización" : "Personalization"}</strong><small>{spanish ? "Preferencias como tema e idioma para que Roavio se sienta tuyo." : "Preferences like theme and language so Roavio feels yours."}</small></span>
          <input type="checkbox" checked={personalization} onChange={(event) => setPersonalization(event.target.checked)} />
        </label>
        <button type="button" className="rv-primary rv-cookie-save" onClick={() => saveConsent({ necessary: true, analytics, personalization })}>{spanish ? "Guardar selección" : "Save choices"}</button>
      </EngineDialog>
    </>
  );
}
