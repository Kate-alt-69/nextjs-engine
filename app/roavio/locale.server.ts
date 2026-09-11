import { cookies } from "next/headers";
import { normalizeRoavioLocale, type RoavioLocale } from "./i18n";

export type RoavioThemeMode = "light" | "dark";

export interface RoavioPreferences {
  locale: RoavioLocale;
  theme: RoavioThemeMode;
  hasConsent: boolean;
}

export async function getRoavioPreferences(): Promise<RoavioPreferences> {
  const store = await cookies();
  return {
    locale: normalizeRoavioLocale(store.get("rv_lang")?.value),
    theme: store.get("rv_theme")?.value === "dark" ? "dark" : "light",
    hasConsent: Boolean(store.get("rv_consent")?.value),
  };
}

export async function getRoavioLocale(): Promise<RoavioLocale> {
  return (await getRoavioPreferences()).locale;
}
