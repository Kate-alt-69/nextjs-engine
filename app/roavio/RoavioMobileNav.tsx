"use client";

import { EnginePopover, EngineTransitionLink } from "@/engine";
import { EngineNavManimIcon } from "@/src/engine/components/EngineNavManimIcon";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { copyFor, type RoavioLocale } from "./i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

function routeIsActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
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
      {open ? (
        <div
          className="rv-mobile-nav-scrim"
          aria-hidden="true"
          onPointerDown={() => setOpen(false)}
        />
      ) : null}

      <EnginePopover
        open={open}
        onOpenChange={(next) => {
          setMenuTouched(true);
          setOpen(next);
        }}
        placement="bottom"
        align="end"
        offset={10}
        viewportPadding={10}
        duration={180}
        closeOnEscape
        closeOnOutsideClick
        restoreFocus
        autoFocus={false}
        trapFocus={false}
        zIndex={2400}
        className="rv-mobile-nav-popover"
        triggerClassName="rv-mobile-nav-trigger"
        triggerAriaLabel={locale === "es" ? "Abrir navegación" : "Open navigation"}
        ariaLabel={locale === "es" ? "Navegación móvil" : "Mobile navigation"}
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
          <div className="rv-mobile-nav-head">
            <EngineTransitionLink
              href="/"
              transition="portal"
              className="rv-mobile-nav-brand"
              onClick={() => setOpen(false)}
              aria-label="Roavio home"
            >
              <img src="/roavio-wordmark.svg" alt="Roavio" draggable={false} />
            </EngineTransitionLink>
            <div className="rv-mobile-nav-meta" aria-hidden="true">
              <span>90 {locale === "es" ? "ciudades" : "cities"}</span>
              <span>6 {locale === "es" ? "continentes" : "continents"}</span>
            </div>
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
            {locale === "es"
              ? "Elige una ciudad · compara el contexto · decide mejor"
              : "Choose a city · compare the context · decide better"}
          </p>
        </div>
      </EnginePopover>
    </div>
  );
}
