import type { Metadata, Viewport } from "next";
import React from "react";
import { PreferencesShell } from "./roavio/PreferencesShell";
import { RoavioMobileNav } from "./roavio/RoavioMobileNav";
import { getRoavioPreferences } from "./roavio/locale.server";
import "./roavio/polish.css";
import "./roavio/brand.css";
import "./roavio/ux.css";
import "./roavio/mobile.css";
import "./roavio/responsive-v2.css";
import "./roavio/city-hero.css";
import "./roavio/mobile-nav.css";
import "./roavio/like.css";
import "./roavio/card-motion.css";
import "./roavio/accent-surface.css";

export const metadata: Metadata = {
  title: {
    default: "Roavio · Digital nomad destinations",
    template: "%s · Roavio",
  },
  description: "Compare global destinations for remote work using cost, connectivity, safety, quality of life and relocation context.",
  applicationName: "Roavio",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#07110e" },
  ],
};

const THEME_BOOT = `(() => {
  try {
    const get = (name) => {
      const match = document.cookie.match(new RegExp('(?:^|;\\\\s*)' + name + '=([^;]+)'));
      return match ? decodeURIComponent(match[1]) : null;
    };
    const marker = get('rv_theme_pref');
    let saved = get('rv_theme');
    const system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    if (marker !== 'manual') {
      saved = null;
      document.cookie = 'rv_theme=; Path=/; Max-Age=0; SameSite=Lax';
    }

    const mode = saved === 'dark' || saved === 'light' ? saved : system;
    document.documentElement.dataset.rvTheme = mode;
    document.documentElement.dataset.rvThemeSource = saved === 'dark' || saved === 'light' ? 'user' : 'system';
    document.documentElement.style.colorScheme = mode;

    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('.rv-footer-theme-dock button') : null;
      if (!target) return;
      document.cookie = 'rv_theme_pref=manual; Path=/; Max-Age=31536000; SameSite=Lax';
    }, true);
  } catch (_) {}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getRoavioPreferences();

  return (
    <html lang={preferences.locale} data-rv-theme={preferences.theme} data-rv-locale={preferences.locale} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <RoavioMobileNav locale={preferences.locale} />
        <PreferencesShell
          initialTheme={preferences.theme}
          initialLocale={preferences.locale}
          initialHasConsent={preferences.hasConsent}
        />
      </body>
    </html>
  );
}
