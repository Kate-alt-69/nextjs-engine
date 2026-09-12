"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const [activeOption, setActiveOption] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const selected = catalog[value] ?? catalog[0];

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    if (!needle) return catalog.map((city, index) => ({ city, index }));
    return catalog
      .map((city, index) => ({ city, index }))
      .filter(({ city }) => `${city.city} ${city.country} ${city.continent}`.toLocaleLowerCase(locale).includes(needle));
  }, [catalog, locale, query]);

  useEffect(() => {
    setActiveOption(0);
  }, [query]);

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
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !filtered.length) return;
    const bounded = Math.max(0, Math.min(filtered.length - 1, activeOption));
    if (bounded !== activeOption) {
      setActiveOption(bounded);
      return;
    }
    const option = rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${listboxId}-option-${bounded}`)}`);
    option?.scrollIntoView({ block: "nearest" });
  }, [activeOption, filtered.length, listboxId, open]);

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectActive = () => {
    const item = filtered[activeOption];
    if (!item) return;
    onChange(item.index);
    setOpen(false);
  };

  return (
    <div className="rv-city-combobox" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="rv-city-combobox__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
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
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeAndFocusTrigger();
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveOption((current) => Math.min(filtered.length - 1, current + 1));
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveOption((current) => Math.max(0, current - 1));
                  return;
                }
                if (event.key === "Home") {
                  event.preventDefault();
                  setActiveOption(0);
                  return;
                }
                if (event.key === "End") {
                  event.preventDefault();
                  setActiveOption(Math.max(0, filtered.length - 1));
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  selectActive();
                }
              }}
              placeholder={locale === "es" ? "Buscar ciudad o país…" : "Search city or country…"}
              aria-label={locale === "es" ? "Buscar ciudades" : "Search cities"}
              aria-controls={listboxId}
              aria-activedescendant={filtered[activeOption] ? `${listboxId}-option-${activeOption}` : undefined}
            />
          </div>
          <div className="rv-city-combobox__options" id={listboxId} role="listbox">
            {filtered.length ? filtered.map(({ city, index }, optionIndex) => (
              <button
                id={`${listboxId}-option-${optionIndex}`}
                key={city.slug}
                type="button"
                role="option"
                aria-selected={index === value}
                className="rv-city-combobox__option"
                data-active={optionIndex === activeOption}
                onMouseEnter={() => setActiveOption(optionIndex)}
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
