"use client";

import { EngineButton, EngineForm, EngineInput } from "@/engine";
import { copyFor, type RoavioLocale } from "./i18n";

/**
 * Native GET search built entirely from NE form components. Keeping the query in
 * the URL makes the Explorer state shareable and lets the server provide the
 * same initial value during hydration.
 */
export function HeroSearch({ locale }: { locale: RoavioLocale }) {
  const copy = copyFor(locale).home;

  return (
    <EngineForm className="rv-search" action="/cities" method="get" autoComplete="off">
      <EngineInput
        type="search"
        name="search"
        className="rv-input"
        placeholder={copy.searchPlaceholder}
        ariaLabel={copy.searchPlaceholder}
      />
      <EngineButton
        className="rv-primary"
        type="submit"
        label={`${copy.searchAction} ↗`}
      />
    </EngineForm>
  );
}
