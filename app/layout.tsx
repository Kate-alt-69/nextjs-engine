import type { Metadata } from "next";
import React from "react";
import { PreferencesShell } from "./roavio/PreferencesShell";
import { getRoavioPreferences } from "./roavio/locale.server";
import "./roavio/polish.css";
import "./roavio/brand.css";

export const metadata: Metadata = {
  title: {
    default: "Roavio · Digital nomad destinations",
    template: "%s · Roavio",
  },
  description: "Compare global destinations for remote work using cost, connectivity, safety, quality of life and relocation context.",
  applicationName: "Roavio",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#07110e" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preferences = await getRoavioPreferences();

  return (
    <html lang={preferences.locale} data-rv-theme={preferences.theme} data-rv-locale={preferences.locale} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
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
