import type { Metadata, Viewport } from "next";
import React from "react";
import { PreferencesShell } from "./roavio/PreferencesShell";
import { getRoavioPreferences } from "./roavio/locale.server";
import "./roavio/polish.css";
import "./roavio/brand.css";
import "./roavio/ux.css";
import "./roavio/mobile.css";

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

    // Builds before the system-theme pass wrote rv_theme without a marker.
    // Ignore that legacy value once so an existing localhost session really
    // returns to automatic device preference after updating.
    if (marker !== 'manual') {
      saved = null;
      document.cookie = 'rv_theme=; Path=/; Max-Age=0; SameSite=Lax';
    }

    const mode = saved === 'dark' || saved === 'light' ? saved : system;
    document.documentElement.dataset.rvTheme = mode;
    document.documentElement.dataset.rvThemeSource = saved === 'dark' || saved === 'light' ? 'user' : 'system';
    document.documentElement.style.colorScheme = mode;

    // Mark subsequent clicks as intentional user overrides. PreferencesShell
    // writes rv_theme during the same click, so the next load can distinguish
    // an explicit choice from the legacy cookie above.
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('.rv-theme-toggle') : null;
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
        <PreferencesShell
          initialTheme={preferences.theme}
          initialLocale={preferences.locale}
          initialHasConsent={preferences.hasConsent}
        />
      </body>
    </html>
  );
}
