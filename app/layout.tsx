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
    const found = document.cookie.match(/(?:^|;\\s*)rv_theme=([^;]+)/);
    const saved = found ? decodeURIComponent(found[1]) : null;
    const system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const mode = saved === 'dark' || saved === 'light' ? saved : system;
    document.documentElement.dataset.rvTheme = mode;
    document.documentElement.dataset.rvThemeSource = saved === 'dark' || saved === 'light' ? 'user' : 'system';
    document.documentElement.style.colorScheme = mode;
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
