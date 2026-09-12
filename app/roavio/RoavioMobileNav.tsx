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
    if (next === locale) return;
    writeCookie("rv_lang", next);
    document.documentElement.lang = next;
    document.documentElement.dataset.rvLocale = next;
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="rv-mobile-nav-root">
      {open ? <button className="rv-mobile-nav-scrim" type="button" aria-label={locale === "es" ? "Cerrar menú" : "Close menu"} onClick={() => setOpen(false)} /> : null}

      <div className="rv-mobile-nav-controls">
        <div className="rv-mobile-nav-language-inline" role="group" aria-label={locale === "es" ? "Seleccionar idioma" : "Choose language"}>
          <button type="button" data-active={locale === "es"} onClick={() => chooseLocale("es")}>ES</button>
          <button type="button" data-active={locale === "en"} onClick={() => chooseLocale("en")}>EN</button>
        </div>

        <EnginePopover
          open={open}
          onOpenChange={(next) => {
            setMenuTouched(true);
            setOpen(next);
          }}
          placement="bottom"
          align="end"
          offset={8}
          viewportPadding={10}
          duration={170}
          closeOnEscape
          closeOnOutsideClick
          restoreFocus
          autoFocus={false}
          trapFocus={false}
          zIndex={2400}
          className="rv-mobile-nav-popover"
          triggerClassName="rv-mobile-nav-trigger"
          triggerAriaLabel={locale === "es" ? "Abrir menú" : "Open menu"}
          ariaLabel={locale === "es" ? "Menú" : "Menu"}
          trigger={(
            <span className="rv-mobile-nav-trigger__content">
              <span className="rv-mobile-nav-trigger__icon" aria-hidden="true">
                {menuTouched ? (
                  <EngineNavManimIcon open={open} size={18} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3.5 5h11M3.5 9h11M3.5 13h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span>{locale === "es" ? "Menú" : "Menu"}</span>
            </span>
          )}
        >
          <nav className="rv-mobile-nav-links" aria-label={locale === "es" ? "Navegación móvil" : "Mobile navigation"}>
            {links.map((item) => {
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
                  <span>{item.label}</span>
                  <span aria-hidden="true">→</span>
                </EngineTransitionLink>
              );
            })}
          </nav>
        </EnginePopover>
      </div>
    </div>
  );
}
