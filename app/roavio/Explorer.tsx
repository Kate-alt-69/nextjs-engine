"use client";

import { EngineReveal, EngineScroll, EngineTransitionLink } from "@/engine";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatedLikeButton } from "./AnimatedLikeButton";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import { peekRoavioCityAccent, type RoavioCityAccent } from "./cityAccent";
import { CityThumb } from "./CityThumb";
import { copyFor, type RoavioLocale } from "./i18n";

const FAVORITES_KEY = "roavio-proposal-favorites";
const PAGE_SIZE = 18;

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) sync();
    };

    sync();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggle = (slug: string) => {
    setFavorites((current) => {
      const next = current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug];
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // Keep this session interactive when storage is unavailable.
      }
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
    europe: ["Europa", "Europe"],
    europa: ["Europa", "Europe"],
    asia: ["Asia", "Asia"],
    africa: ["África", "Africa"],
    "áfrica": ["África", "Africa"],
    americas: ["América", "Americas"],
    america: ["América", "Americas"],
    "américa": ["América", "Americas"],
    "north america": ["Norteamérica", "North America"],
    "norteamérica": ["Norteamérica", "North America"],
    norteamerica: ["Norteamérica", "North America"],
    oceania: ["Oceanía", "Oceania"],
    "oceanía": ["Oceanía", "Oceania"],
    "middle east": ["Oriente Medio", "Middle East"],
    "oriente medio": ["Oriente Medio", "Middle East"],
  };
  const match = labels[normalized];
  return match ? match[locale === "es" ? 0 : 1] : value;
}

function CityResultCard({
  city,
  locale,
  favorite,
  compared,
  eager,
  motionIndex,
  onFavorite,
  onCompare,
}: {
  city: CityCatalogEntry;
  locale: RoavioLocale;
  favorite: boolean;
  compared: boolean;
  eager: boolean;
  motionIndex: number;
  onFavorite: () => void;
  onCompare: () => void;
}) {
  const copy = copyFor(locale).cities;
  const cityHref = `/cities/${city.slug}`;
  const [accent, setAccent] = useState<RoavioCityAccent | null>(null);

  useEffect(() => {
    setAccent(peekRoavioCityAccent(city.slug));
  }, [city.slug]);

  const accentStyle = accent ? {
    "--rv-city-accent": accent.rgb,
    "--rv-city-accent-hex": accent.hex,
  } as CSSProperties : undefined;

  return (
    <EngineReveal
      className="rv-result-card-reveal"
      priority={eager}
      effect="pop"
      replay
      renderMargin={1600}
      motionMargin={150}
      duration={340}
      delay={Math.min(motionIndex % 3, 2) * 16}
      scaleFrom={0.82}
      overshoot={1.022}
      releaseWhenFar
    >
      <article
        className="rv-result-card"
        data-accent-ready={accent ? "true" : "false"}
        style={accentStyle}
      >
        <div className="rv-result-card__visual-wrap">
          <EngineTransitionLink
            href={cityHref}
            transition="portal"
            className="rv-result-card__visual"
            aria-label={`${copy.open} ${city.city}`}
          >
            <CityThumb
              slug={city.slug}
              city={city.city}
              country={city.country}
              eager={eager}
              onAccent={setAccent}
            />
            <span className="rv-result-card__image-shade" aria-hidden="true" />
            <div className="rv-result-card__image-meta">
              <div className="rv-result-card__image-copy">
                <h3>{city.city}</h3>
                <p>
                  {city.country} · {continentLabel(city.continent, locale)}
                  {city.beach === true ? ` · ${locale === "es" ? "playa" : "beach"}` : ""}
                </p>
              </div>
              <strong
                className="rv-result-score"
                title={locale === "es" ? "Puntuación compuesta de la propuesta" : "Composite proposal score"}
              >
                {scoreLabel(city)}
              </strong>
            </div>
          </EngineTransitionLink>
          <AnimatedLikeButton
            active={favorite}
            onToggle={onFavorite}
            locale={locale}
            city={city.city}
          />
        </div>

        <div className="rv-result-card__body">
          <div className="rv-result-metrics">
            <div><strong>{city.cost ? city.cost.replace("/mo", "") : "—"}</strong><span>{copy.monthlyCost}</span></div>
            <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>{copy.fixedInternet}</span></div>
            <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>{copy.quality}</span></div>
          </div>

          <div className="rv-card-actions rv-card-actions--city">
            <button
              className="rv-icon-btn rv-card-action rv-card-action--compare"
              type="button"
              data-active={compared}
              onClick={onCompare}
            >
              <span aria-hidden>{compared ? "✓" : "+"}</span>
              <span>{copy.compare}</span>
            </button>
            <EngineTransitionLink
              className="rv-icon-btn rv-card-action rv-card-action--open"
              href={cityHref}
              transition="portal"
              aria-label={`${copy.open} ${city.city}`}
              style={{ textDecoration: "none" }}
            >
              <span>{copy.open}</span>
              <span aria-hidden>↗</span>
            </EngineTransitionLink>
          </div>
        </div>
      </article>
    </EngineReveal>
  );
}

export function Explorer({
  catalog,
  locale,
  initialSearch = "",
}: {
  catalog: CityCatalogEntry[];
  locale: RoavioLocale;
  initialSearch?: string;
}) {
  const copy = copyFor(locale).cities;
  const [query, setQuery] = useState(initialSearch);
  const [continent, setContinent] = useState("All");
  const [beachOnly, setBeachOnly] = useState(false);
  const [sort, setSort] = useState("fit");
  const [page, setPage] = useState(0);
  const [compare, setCompare] = useState<string[]>([]);
  const { favorites, toggle } = useFavorites();
  const continents = ["All", ...Array.from(new Set(catalog.map((city) => city.continent)))];

  useEffect(() => {
    if (initialSearch) return;
    const fromUrl = new URLSearchParams(window.location.search).get("search");
    if (fromUrl) setQuery(fromUrl);
  }, [initialSearch]);

  useEffect(() => {
    setPage(0);
  }, [query, continent, beachOnly, sort]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const filtered = catalog.filter((city) => {
      const matchesSearch = !needle
        || `${city.city} ${city.country} ${city.continent}`.toLocaleLowerCase(locale).includes(needle);
      return matchesSearch
        && (continent === "All" || city.continent === continent)
        && (!beachOnly || city.beach === true);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "quality") return sortNumber(b.quality) - sortNumber(a.quality);
      if (sort === "safety") return sortNumber(b.safety) - sortNumber(a.safety);
      if (sort === "internet") return sortNumber(b.internet) - sortNumber(a.internet);
      if (sort === "az") return a.city.localeCompare(b.city, locale);
      return sortNumber(catalogFitScore(b)) - sortNumber(catalogFitScore(a));
    });
  }, [catalog, query, continent, beachOnly, sort, locale]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleResults = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = results.length ? safePage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(results.length, safePage * PAGE_SIZE + PAGE_SIZE);
  const atStart = safePage === 0;
  const atEnd = safePage >= pageCount - 1;

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const goToPage = (nextPage: number) => {
    const bounded = Math.max(0, Math.min(pageCount - 1, nextPage));
    if (bounded === safePage) return;
    setPage(bounded);

    // Let React commit the new page, then use NE's own scroll runtime rather
    // than creating a browser smooth-scroll path beside EngineScroll.
    window.requestAnimationFrame(() => {
      EngineScroll.move("#rv-city-results", {
        align: "start",
        duration: 360,
        easing: "easeOutCubic",
        respectReducedMotion: true,
        interruptible: true,
      });
    });
  };

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
        <input
          className="rv-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchPlaceholder}
        />
        <select
          className="rv-select"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          aria-label={locale === "es" ? "Ordenar destinos" : "Sort destinations"}
        >
          <option value="fit">{copy.bestFit}</option>
          <option value="quality">{copy.quality}</option>
          <option value="safety">{copy.safety}</option>
          <option value="internet">{copy.internet}</option>
          <option value="az">{copy.az}</option>
        </select>
        <button
          className="rv-pill"
          data-active={beachOnly}
          onClick={() => setBeachOnly((value) => !value)}
          type="button"
        >
          {copy.beachOnly}
        </button>
      </div>

      <div className="rv-filter-pills">
        {continents.map((item) => (
          <button
            key={item}
            className="rv-pill"
            data-active={continent === item}
            onClick={() => setContinent(item)}
            type="button"
          >
            {item === "All"
              ? (locale === "es" ? "Todos" : "All")
              : continentLabel(item, locale)}
          </button>
        ))}
      </div>

      <p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>
        {results.length} {copy.destinations} · {catalog.length} {copy.catalog} · {copy.compareHint} · {locale === "es" ? `mostrando ${rangeStart}–${rangeEnd}` : `showing ${rangeStart}–${rangeEnd}`}
      </p>

      <div className="rv-cities-folder">
        <div className="rv-result-grid" id="rv-city-results">
          {visibleResults.map((city, index) => (
            <CityResultCard
              key={city.slug}
              city={city}
              locale={locale}
              favorite={favorites.includes(city.slug)}
              compared={compare.includes(city.slug)}
              eager={index < 3}
              motionIndex={index}
              onFavorite={() => toggle(city.slug)}
              onCompare={() => toggleCompare(city.slug)}
            />
          ))}
        </div>

        {pageCount > 1 ? (
          <div className="rv-cities-folder__footer">
            <button
              type="button"
              className="rv-cities-page-nav"
              aria-disabled={atStart}
              data-disabled={atStart ? "true" : undefined}
              style={atStart ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={() => {
                if (!atStart) goToPage(safePage - 1);
              }}
            >
              ← {locale === "es" ? "Anterior" : "Previous"}
            </button>
            <span>{locale === "es" ? "Página" : "Page"} <strong>{safePage + 1}</strong> / {pageCount}</span>
            <button
              type="button"
              className="rv-cities-page-nav"
              aria-disabled={atEnd}
              data-disabled={atEnd ? "true" : undefined}
              style={atEnd ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={() => {
                if (!atEnd) goToPage(safePage + 1);
              }}
            >
              {locale === "es" ? "Siguiente" : "Next"} →
            </button>
          </div>
        ) : null}
      </div>

      {results.length === 0 ? (
        <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}>
          <h3 style={{ marginTop: 0 }}>{copy.emptyTitle}</h3>
          <p style={{ color: "var(--rv-muted)" }}>{copy.emptyBody}</p>
        </div>
      ) : null}

      {compare.length > 0 ? (
        <div className="rv-compare-tray">
          <div>
            <strong>{copy.compareTray}</strong>
            <div className="rv-compare-chips">
              {compare.map((slug) => (
                <span className="rv-compare-chip" key={slug}>
                  {catalog.find((city) => city.slug === slug)?.city ?? slug}
                </span>
              ))}
            </div>
          </div>
          <EngineTransitionLink
            className="rv-primary"
            href={`/compare?cities=${compare.join(",")}`}
            transition="depth"
          >
            {copy.compare} {compare.length} →
          </EngineTransitionLink>
        </div>
      ) : null}
    </div>
  );
}
