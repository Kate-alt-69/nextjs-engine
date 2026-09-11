"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CityCatalogEntry } from "./catalog";
import type { RoavioLocale } from "./i18n";

export function SearchableCitySelect({
  catalog,
  value,
  onChange,
  locale,
  ariaLabel,
}: {
  catalog: CityCatalogEntry[];
  value: number;
  onChange: (index: number) => void;
  locale: RoavioLocale;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = catalog[value] ?? catalog[0];

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return catalog.map((city, index) => ({ city, index }));
    return catalog
      .map((city, index) => ({ city, index }))
      .filter(({ city }) => `${city.city} ${city.country} ${city.continent}`.toLocaleLowerCase(locale).includes(needle));
  }, [catalog, locale, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div className="rv-city-combobox" ref={rootRef}>
      <button
        type="button"
        className="rv-city-combobox__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected ? `${selected.city} · ${selected.country}` : (locale === "es" ? "Elegir ciudad" : "Choose city")}</span>
        <span aria-hidden className="rv-city-combobox__chevron">⌄</span>
      </button>
      {open ? (
        <div className="rv-city-combobox__menu">
          <div className="rv-city-combobox__search-wrap">
            <span aria-hidden>⌕</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "Enter" && filtered[0]) {
                  onChange(filtered[0].index);
                  setOpen(false);
                }
              }}
              placeholder={locale === "es" ? "Buscar ciudad o país…" : "Search city or country…"}
              aria-label={locale === "es" ? "Buscar ciudades" : "Search cities"}
            />
          </div>
          <div className="rv-city-combobox__options" role="listbox">
            {filtered.length ? filtered.map(({ city, index }) => (
              <button
                key={city.slug}
                type="button"
                role="option"
                aria-selected={index === value}
                className="rv-city-combobox__option"
                data-active={index === value}
                onClick={() => {
                  onChange(index);
                  setOpen(false);
                }}
              >
                <span>{city.city}</span>
                <small>{city.country} · {city.continent}</small>
              </button>
            )) : (
              <div className="rv-city-combobox__empty">{locale === "es" ? "No hay coincidencias" : "No matches"}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
