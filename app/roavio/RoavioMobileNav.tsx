"use client";

import { EngineDrawer, EngineManim, EngineTransitionLink } from "@/engine";
import { EngineNavManimIcon } from "@/src/engine/components/EngineNavManimIcon";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { copyFor, type RoavioLocale } from "./i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function routeIsActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuGlyph() {
  const config = useMemo(() => ({
    manim: {
      mobjects: [
        { id: "route", type: "Path" as const, d: "M 8 34 C 48 6 94 62 142 28 C 170 8 194 18 214 31", strokeColor: "#c8f36b", strokeWidth: 2 },
        { id: "start", type: "Circle" as const, radius: 5, x: 8, y: 34, strokeColor: "#eef7f2", fillColor: "#205f4a", strokeWidth: 2 },
        { id: "mid", type: "Circle" as const, radius: 4, x: 142, y: 28, strokeColor: "#eef7f2", fillColor: "#86d7b1", strokeWidth: 2 },
        { id: "end", type: "Circle" as const, radius: 6, x: 214, y: 31, strokeColor: "#eef7f2", fillColor: "#ffbb91", strokeWidth: 2 },
      ],
      timeline: [
        { action: "Create" as const, target: "route", durationMs: 460, easing: "ease-out" as const },
        { action: "FadeIn" as const, target: "start", durationMs: 150, easing: "ease-out" as const },
        { action: "FadeIn" as const, target: "mid", durationMs: 150, easing: "ease-out" as const },
        { action: "FadeIn" as const, target: "end", durationMs: 170, easing: "ease-out" as const },
        { action: "Wait" as const, durationMs: 300 },
      ],
      settings: { loop: false, fpsLimit: 30 as const, background: "transparent" },
    },
  }), []);

  return (
    <EngineManim
      cprop={config}
      width={224}
      height={66}
      className="rv-mobile-nav-manim"
      style={{ width: 224, height: 66, maxWidth: "100%", pointerEvents: "none" }}
    />
  );
}

export function RoavioMobileNav({ locale }: { locale: RoavioLocale }) {
  const copy = copyFor(locale).nav;
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuTouched, setMenuTouched] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { label: copy.explore, href: "/cities" },
    { label: copy.match, href: "/match" },
    { label: copy.compare, href: "/compare" },
    { label: copy.favorites, href: "/favoritos" },
  ];

  const chooseLocale = (next: RoavioLocale) => {
    if (next === locale) {
      setOpen(false);
      return;
    }
    writeCookie("rv_lang", next);
    document.documentElement.lang = next;
    document.documentElement.dataset.rvLocale = next;
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="rv-mobile-nav-root">
      <EngineDrawer
        open={open}
        onOpenChange={(next) => { setMenuTouched(true); setOpen(next); }}
        side="right"
        size="min(22rem, 88vw)"
        duration={320}
        lockScroll
        trapFocus
        closeOnBackdrop
        closeOnEscape
        restoreFocus
        zIndex={2200}
        className="rv-mobile-nav-drawer"
        overlayStyle={{ background: "rgba(2,10,7,.56)", backdropFilter: "blur(10px) saturate(.86)" }}
        triggerClassName="rv-mobile-nav-trigger"
        triggerAriaLabel={locale === "es" ? "Abrir navegación" : "Open navigation"}
        closeLabel={locale === "es" ? "Cerrar navegación" : "Close navigation"}
        trigger={(
          <span className="rv-mobile-nav-trigger__icon" aria-hidden="true">
            {menuTouched ? (
              <EngineNavManimIcon open={open} size={22} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 6h14M4 11h14M4 16h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
          </span>
        )}
      >
        <div className="rv-mobile-nav-content">
          <div className="rv-mobile-nav-brand-row">
            <EngineTransitionLink href="/" transition="portal" className="rv-mobile-nav-brand" onClick={() => setOpen(false)} aria-label="Roavio home">
              <img src="/roavio-wordmark.svg" alt="Roavio" draggable={false} />
            </EngineTransitionLink>
            <span className="rv-mobile-nav-index">90 · 6</span>
          </div>

          <div className="rv-mobile-nav-route" aria-hidden="true">
            <MenuGlyph />
          </div>

          <nav className="rv-mobile-nav-links" aria-label={locale === "es" ? "Navegación móvil" : "Mobile navigation"}>
            {links.map((item, index) => {
              const active = routeIsActive(pathname, item.href);
              return (
                <EngineTransitionLink
                  key={item.href}
                  href={item.href}
                  transition="portal"
                  className="rv-mobile-nav-link"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="rv-mobile-nav-link__index">0{index + 1}</span>
                  <span>{item.label}</span>
                  <span className="rv-mobile-nav-link__arrow" aria-hidden="true">↗</span>
                </EngineTransitionLink>
              );
            })}
          </nav>

          <div className="rv-mobile-nav-language">
            <div>
              <span className="rv-mobile-nav-label">{locale === "es" ? "IDIOMA" : "LANGUAGE"}</span>
              <strong>{locale === "es" ? "Español" : "English"}</strong>
            </div>
            <div className="rv-mobile-nav-language__choices" role="group" aria-label={locale === "es" ? "Seleccionar idioma" : "Choose language"}>
              <button type="button" data-active={locale === "es"} onClick={() => chooseLocale("es")}>ES</button>
              <button type="button" data-active={locale === "en"} onClick={() => chooseLocale("en")}>EN</button>
            </div>
          </div>

          <p className="rv-mobile-nav-footnote">
            {locale === "es" ? "Elige una ciudad. Compara el contexto. Decide mejor." : "Choose a city. Compare the context. Decide better."}
          </p>
        </div>
      </EngineDrawer>
    </div>
  );
}
