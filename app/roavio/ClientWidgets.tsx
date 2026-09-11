"use client";

import { EngineTransitionLink, useEngineTransitions } from "@/engine";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import { CityThumb } from "./CityThumb";
import { CompareAtmosphere } from "./CompareAtmosphere";
import { copyFor, type RoavioLocale } from "./i18n";
import { SearchableCitySelect } from "./SearchableCitySelect";

const FAVORITES_KEY = "roavio-proposal-favorites";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => setFavorites(readFavorites()), []);

  const toggle = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { favorites, toggle };
}

function sortNumber(value: number | null): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

function scoreLabel(city: CityCatalogEntry): string {
  const score = catalogFitScore(city);
  return score === null ? "—" : score.toFixed(1);
}

function continentLabel(value: string, locale: RoavioLocale): string {
  const normalized = value.toLocaleLowerCase("es");
  const labels: Record<string, [string, string]> = {
    europe: ["Europa", "Europe"], europa: ["Europa", "Europe"],
    asia: ["Asia", "Asia"],
    africa: ["África", "Africa"], "áfrica": ["África", "Africa"],
    americas: ["América", "Americas"], america: ["América", "Americas"], "américa": ["América", "Americas"],
    "north america": ["Norteamérica", "North America"], "norteamérica": ["Norteamérica", "North America"], norteamerica: ["Norteamérica", "North America"],
    oceania: ["Oceanía", "Oceania"], "oceanía": ["Oceanía", "Oceania"],
    "middle east": ["Oriente Medio", "Middle East"], "oriente medio": ["Oriente Medio", "Middle East"],
  };
  const match = labels[normalized];
  return match ? match[locale === "es" ? 0 : 1] : value;
}

export function HeroSearch({ locale }: { locale: RoavioLocale }) {
  const transitions = useEngineTransitions();
  const copy = copyFor(locale).home;
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    const href = value ? `/cities?search=${encodeURIComponent(value)}` : "/cities";
    void transitions.push(href, { type: "reveal", duration: 460, origin: "pointer" });
  };

  return (
    <form className="rv-search" onSubmit={submit}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} aria-label={copy.searchPlaceholder} />
      <button className="rv-primary" type="submit">{copy.searchAction} <span aria-hidden>↗</span></button>
    </form>
  );
}

function CityResultCard({ city, locale, favorite, compared, onFavorite, onCompare }: {
  city: CityCatalogEntry;
  locale: RoavioLocale;
  favorite: boolean;
  compared: boolean;
  onFavorite: () => void;
  onCompare: () => void;
}) {
  const copy = copyFor(locale).cities;
  const cityHref = `/cities/${city.slug}`;
  return (
    <article className="rv-result-card">
      <EngineTransitionLink href={cityHref} transition="portal" className="rv-result-card__visual" aria-label={`${copy.open} ${city.city}`}>
        <CityThumb slug={city.slug} city={city.city} country={city.country} />
      </EngineTransitionLink>
      <div className="rv-result-card__body">
        <div className="rv-result-head">
          <div>
            <h3><EngineTransitionLink href={cityHref} transition="portal" style={{ textDecoration: "none" }}>{city.city}</EngineTransitionLink></h3>
            <p>{city.country} · {continentLabel(city.continent, locale)} {city.beach === true ? `· ${locale === "es" ? "playa" : "beach"}` : ""}</p>
          </div>
          <div className="rv-result-score" title={locale === "es" ? "Puntuación compuesta de la propuesta" : "Composite proposal score"}>{scoreLabel(city)}</div>
        </div>
        <div className="rv-result-metrics">
          <div><strong>{city.cost ? city.cost.replace("/mo", "") : "—"}</strong><span>{copy.monthlyCost}</span></div>
          <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>{copy.fixedInternet}</span></div>
          <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>{copy.quality}</span></div>
        </div>
        <div className="rv-card-actions">
          <button className="rv-icon-btn" type="button" data-active={favorite} onClick={onFavorite} aria-label={favorite ? copy.saved : copy.save}>{favorite ? `♥ ${copy.saved}` : `♡ ${copy.save}`}</button>
          <button className="rv-icon-btn" type="button" data-active={compared} onClick={onCompare}>{compared ? `✓ ${copy.compare}` : `+ ${copy.compare}`}</button>
          <EngineTransitionLink className="rv-icon-btn" href={cityHref} transition="portal" style={{ marginLeft: "auto", textDecoration: "none" }}>{copy.open} ↗</EngineTransitionLink>
        </div>
      </div>
    </article>
  );
}

export function Explorer({ catalog, locale, initialSearch = "" }: { catalog: CityCatalogEntry[]; locale: RoavioLocale; initialSearch?: string }) {
  const copy = copyFor(locale).cities;
  const [query, setQuery] = useState(initialSearch);
  const [continent, setContinent] = useState("All");
  const [beachOnly, setBeachOnly] = useState(false);
  const [sort, setSort] = useState("fit");
  const [compare, setCompare] = useState<string[]>([]);
  const { favorites, toggle } = useFavorites();
  const continents = ["All", ...Array.from(new Set(catalog.map((city) => city.continent)))];

  useEffect(() => {
    if (initialSearch) return;
    const fromUrl = new URLSearchParams(window.location.search).get("search");
    if (fromUrl) setQuery(fromUrl);
  }, [initialSearch]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const filtered = catalog.filter((city) => {
      const matchesSearch = !needle || `${city.city} ${city.country} ${city.continent}`.toLocaleLowerCase(locale).includes(needle);
      return matchesSearch && (continent === "All" || city.continent === continent) && (!beachOnly || city.beach === true);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "quality") return sortNumber(b.quality) - sortNumber(a.quality);
      if (sort === "safety") return sortNumber(b.safety) - sortNumber(a.safety);
      if (sort === "internet") return sortNumber(b.internet) - sortNumber(a.internet);
      if (sort === "az") return a.city.localeCompare(b.city, locale);
      return sortNumber(catalogFitScore(b)) - sortNumber(catalogFitScore(a));
    });
  }, [catalog, query, continent, beachOnly, sort, locale]);

  const toggleCompare = (slug: string) => {
    setCompare((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
  };

  return (
    <div>
      <div className="rv-toolbar">
        <input className="rv-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} />
        <select className="rv-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label={locale === "es" ? "Ordenar destinos" : "Sort destinations"}>
          <option value="fit">{copy.bestFit}</option>
          <option value="quality">{copy.quality}</option>
          <option value="safety">{copy.safety}</option>
          <option value="internet">{copy.internet}</option>
          <option value="az">{copy.az}</option>
        </select>
        <button className="rv-pill" data-active={beachOnly} onClick={() => setBeachOnly((value) => !value)} type="button">{copy.beachOnly}</button>
      </div>
      <div className="rv-filter-pills">
        {continents.map((item) => <button key={item} className="rv-pill" data-active={continent === item} onClick={() => setContinent(item)} type="button">{item === "All" ? (locale === "es" ? "Todos" : "All") : continentLabel(item, locale)}</button>)}
      </div>
      <p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>{results.length} {copy.destinations} · {catalog.length} {copy.catalog} · {copy.compareHint}</p>
      <div className="rv-result-grid">
        {results.map((city) => (
          <CityResultCard key={city.slug} city={city} locale={locale} favorite={favorites.includes(city.slug)} compared={compare.includes(city.slug)} onFavorite={() => toggle(city.slug)} onCompare={() => toggleCompare(city.slug)} />
        ))}
      </div>
      {results.length === 0 ? (
        <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}>
          <h3 style={{ marginTop: 0 }}>{copy.emptyTitle}</h3>
          <p style={{ color: "var(--rv-muted)" }}>{copy.emptyBody}</p>
        </div>
      ) : null}
      {compare.length > 0 ? (
        <div className="rv-compare-tray">
          <div><strong>{copy.compareTray}</strong><div className="rv-compare-chips">{compare.map((slug) => <span className="rv-compare-chip" key={slug}>{catalog.find((city) => city.slug === slug)?.city ?? slug}</span>)}</div></div>
          <EngineTransitionLink className="rv-primary" href={`/compare?cities=${compare.join(",")}`} transition="depth">{copy.compare} {compare.length} →</EngineTransitionLink>
        </div>
      ) : null}
    </div>
  );
}

const metricKeys: Array<{ key: "quality" | "safety" | "internet"; suffix: string }> = [
  { key: "quality", suffix: "/10" },
  { key: "safety", suffix: "/10" },
  { key: "internet", suffix: " Mbps" },
];

function indexesForSlugs(catalog: CityCatalogEntry[], slugs: string[], fallbackSlugs: string[]): number[] {
  const indexes = slugs.map((slug) => catalog.findIndex((city) => city.slug === slug)).filter((index) => index >= 0).slice(0, 3);
  for (const slug of fallbackSlugs) {
    if (indexes.length >= 3) break;
    const index = catalog.findIndex((city) => city.slug === slug);
    if (index >= 0 && !indexes.includes(index)) indexes.push(index);
  }
  for (let index = 0; indexes.length < 3 && index < catalog.length; index += 1) if (!indexes.includes(index)) indexes.push(index);
  return indexes.slice(0, 3);
}

function bestMetric(cities: CityCatalogEntry[], key: "quality" | "safety" | "internet"): number | null {
  const values = cities.map((city) => city[key]).filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

export function CompareBoard({ catalog, locale, initialSlugs = ["valencia", "lisboa", "bali"] }: { catalog: CityCatalogEntry[]; locale: RoavioLocale; initialSlugs?: string[] }) {
  const copy = copyFor(locale).compare;
  const fallback = indexesForSlugs(catalog, initialSlugs, ["valencia", "lisboa", "bali"]);
  const [selected, setSelected] = useState<number[]>(fallback);
  const chosen = selected.map((index) => catalog[index]).filter((city): city is CityCatalogEntry => Boolean(city));

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("cities");
    if (!raw) return;
    setSelected(indexesForSlugs(catalog, raw.split(",").map((value) => value.trim()).filter(Boolean), ["valencia", "lisboa", "bali"]));
  }, [catalog]);

  const update = (slot: number, cityIndex: number) => setSelected((current) => current.map((value, index) => index === slot ? cityIndex : value));
  const scoreValues = chosen.map(catalogFitScore).filter((value): value is number => value !== null);
  const bestScore = scoreValues.length ? Math.max(...scoreValues) : null;
  const metricLabel = (key: "quality" | "safety" | "internet") => key === "quality" ? copy.quality : key === "safety" ? copy.safety : copy.internet;

  return (
    <div className="rv-compare-stage">
      <CompareAtmosphere />
      <div className="rv-compare-stage__content">
        <div className="rv-compare-select-grid">
          {selected.map((value, slot) => (
            <SearchableCitySelect
              key={slot}
              catalog={catalog}
              value={value}
              locale={locale}
              ariaLabel={locale === "es" ? `Ciudad ${slot + 1} de la comparación` : `Comparison city ${slot + 1}`}
              onChange={(cityIndex) => update(slot, cityIndex)}
            />
          ))}
        </div>

        <div className="rv-compare-city-strip">
          {chosen.map((city) => (
            <EngineTransitionLink href={`/cities/${city.slug}`} transition="portal" className="rv-compare-city-card" key={`visual-${city.slug}`}>
              <CityThumb slug={city.slug} city={city.city} country={city.country} compact />
              <div className="rv-compare-city-card__meta"><strong>{city.city}</strong><span>{scoreLabel(city) === "—" ? (locale === "es" ? "parcial" : "partial") : `${scoreLabel(city)}/10`}</span></div>
            </EngineTransitionLink>
          ))}
        </div>

        <div className="rv-compare-grid">
          <div className="rv-compare-label">{copy.metric}</div>
          {chosen.map((city) => <div key={`head-${city.slug}`}><strong style={{ fontFamily: "Manrope", fontSize: "1.15rem" }}>{city.city}</strong><div style={{ color: "var(--rv-muted)", fontSize: ".78rem" }}>{city.country}</div></div>)}
          <div className="rv-compare-label">{copy.monthlyCost}</div>
          {chosen.map((city) => <div key={`cost-${city.slug}`}><strong>{city.cost ?? "—"}</strong></div>)}
          {metricKeys.map((metric) => {
            const best = bestMetric(chosen, metric.key);
            return [
              <div className="rv-compare-label" key={`${metric.key}-label`}>{metricLabel(metric.key)}</div>,
              ...chosen.map((city) => {
                const value = city[metric.key];
                return <div key={`${metric.key}-${city.slug}`} className={value !== null && best !== null && value === best ? "rv-best" : ""}><strong>{catalogMetric(value, metric.suffix)}</strong></div>;
              }),
            ];
          })}
          <div className="rv-compare-label">{copy.beach}</div>
          {chosen.map((city) => <div key={`beach-${city.slug}`} className={city.beach === true ? "rv-best" : ""}>{city.beach === true ? copy.coastal : city.beach === false ? copy.no : "—"}</div>)}
          <div className="rv-compare-label">{copy.fit}</div>
          {chosen.map((city) => {
            const score = catalogFitScore(city);
            return <div key={`score-${city.slug}`} className={score !== null && bestScore !== null && score === bestScore ? "rv-best" : ""}><strong>{score === null ? "—" : `${score.toFixed(1)}/10`}</strong></div>;
          })}
        </div>
        <p style={{ color: "var(--rv-muted)", fontSize: ".78rem", margin: ".8rem .2rem .2rem" }}>{copy.note}</p>
      </div>
    </div>
  );
}

export function FavoritesBoard({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const copy = copyFor(locale);
  const { favorites, toggle } = useFavorites();
  const saved = catalog.filter((city) => favorites.includes(city.slug));

  if (saved.length === 0) {
    return <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}><h3 style={{ marginTop: 0 }}>{copy.favorites.emptyTitle}</h3><p style={{ color: "var(--rv-muted)" }}>{copy.favorites.emptyBody}</p><EngineTransitionLink className="rv-primary" href="/cities" transition="reveal">{copy.favorites.find} →</EngineTransitionLink></div>;
  }

  return <div className="rv-result-grid">{saved.map((city) => <CityResultCard key={city.slug} city={city} locale={locale} favorite compared={false} onFavorite={() => toggle(city.slug)} onCompare={() => undefined} />)}</div>;
}
