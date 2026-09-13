"use client";

import { EngineReveal, EngineTransitionLink } from "@/engine";
import { useEffect, useState, type CSSProperties } from "react";
import { AnimatedLikeButton } from "./AnimatedLikeButton";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import { peekRoavioCityAccent, type RoavioCityAccent } from "./cityAccent";
import { CityThumb } from "./CityThumb";
import { copyFor, type RoavioLocale } from "./i18n";

const FAVORITES_KEY = "roavio-proposal-favorites";

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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setFavorites(readFavorites());
      setHydrated(true);
    };
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
        // Keep the current session interactive when storage is unavailable.
      }
      return next;
    });
  };

  return { favorites, hydrated, toggle };
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

function FavoriteCityCard({
  city,
  locale,
  index,
  onFavorite,
}: {
  city: CityCatalogEntry;
  locale: RoavioLocale;
  index: number;
  onFavorite: () => void;
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
      effect="pop"
      replay
      renderMargin={1600}
      motionMargin={150}
      duration={340}
      delay={Math.min(index % 3, 2) * 16}
      scaleFrom={0.82}
      overshoot={1.022}
      releaseWhenFar
    >
      <article className="rv-result-card" data-accent-ready={accent ? "true" : "false"} style={accentStyle}>
        <div className="rv-result-card__visual-wrap">
          <EngineTransitionLink href={cityHref} transition="portal" className="rv-result-card__visual" aria-label={`${copy.open} ${city.city}`}>
            <CityThumb
              slug={city.slug}
              city={city.city}
              country={city.country}
              eager={index < 3}
              onAccent={setAccent}
            />
            <span className="rv-result-card__image-shade" aria-hidden="true" />
            <div className="rv-result-card__image-meta">
              <div className="rv-result-card__image-copy">
                <h3>{city.city}</h3>
                <p>{city.country} · {continentLabel(city.continent, locale)}{city.beach === true ? ` · ${locale === "es" ? "playa" : "beach"}` : ""}</p>
              </div>
              <strong className="rv-result-score" title={locale === "es" ? "Puntuación compuesta de la propuesta" : "Composite proposal score"}>{scoreLabel(city)}</strong>
            </div>
          </EngineTransitionLink>
          <AnimatedLikeButton active onToggle={onFavorite} locale={locale} city={city.city} />
        </div>
        <div className="rv-result-card__body">
          <div className="rv-result-metrics">
            <div><strong>{city.cost ? city.cost.replace("/mo", "") : "—"}</strong><span>{copy.monthlyCost}</span></div>
            <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>{copy.fixedInternet}</span></div>
            <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>{copy.quality}</span></div>
          </div>
          <div className="rv-card-actions rv-card-actions--city">
            <EngineTransitionLink className="rv-icon-btn rv-card-action rv-card-action--compare" href={`/compare?cities=${city.slug}`} transition="depth" style={{ textDecoration: "none" }}>
              <span aria-hidden>+</span><span>{copy.compare}</span>
            </EngineTransitionLink>
            <EngineTransitionLink className="rv-icon-btn rv-card-action rv-card-action--open" href={cityHref} transition="portal" aria-label={`${copy.open} ${city.city}`} style={{ textDecoration: "none" }}>
              <span>{copy.open}</span><span aria-hidden>↗</span>
            </EngineTransitionLink>
          </div>
        </div>
      </article>
    </EngineReveal>
  );
}

export function FavoritesBoard({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const copy = copyFor(locale);
  const { favorites, hydrated, toggle } = useFavorites();
  const saved = catalog.filter((city) => favorites.includes(city.slug));

  if (!hydrated) {
    return (
      <div className="rv-panel" aria-busy="true" style={{ padding: "2rem", textAlign: "center", color: "var(--rv-muted)" }}>
        {locale === "es" ? "Cargando destinos guardados…" : "Loading saved destinations…"}
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}>
        <h3 style={{ marginTop: 0 }}>{copy.favorites.emptyTitle}</h3>
        <p style={{ color: "var(--rv-muted)" }}>{copy.favorites.emptyBody}</p>
        <EngineTransitionLink className="rv-primary" href="/cities" transition="reveal">{copy.favorites.find} →</EngineTransitionLink>
      </div>
    );
  }

  return (
    <div className="rv-result-grid">
      {saved.map((city, index) => (
        <FavoriteCityCard
          key={city.slug}
          city={city}
          locale={locale}
          index={index}
          onFavorite={() => toggle(city.slug)}
        />
      ))}
    </div>
  );
}
