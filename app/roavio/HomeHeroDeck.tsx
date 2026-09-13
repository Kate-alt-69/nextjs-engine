"use client";

import { EngineExpandLink, EngineSwipeDeck } from "@/engine";
import { catalogFitScore, type CityCatalogEntry } from "./catalog";
import {
  CITY_EXPAND_DURATION,
  CITY_HANDOFF_DURATION,
  cityTransitionSurfaceId,
} from "./cityTransition";
import { HOME_HERO_DECK_SLUGS } from "./homeCities";
import type { RoavioLocale } from "./i18n";
import { OfficialCityImage } from "./OfficialCityImage";

function metric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

export function HomeHeroDeck({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const cities = HOME_HERO_DECK_SLUGS
    .map((slug) => catalog.find((city) => city.slug === slug))
    .filter((city): city is CityCatalogEntry => Boolean(city));
  const es = locale === "es";

  return (
    <div className="rv-home-deck-shell">
      <div className="rv-home-deck__eyebrow">
        <span>{es ? "DESLIZA PARA EXPLORAR" : "SWIPE TO EXPLORE"}</span>
        <small>{es ? "arrástrala ↔" : "grab it ↔"}</small>
      </div>
      <EngineSwipeDeck
        className="rv-home-deck"
        depth={3}
        autoplayMs={5200}
        resumeDelay={2200}
        swipeThreshold={52}
        ariaLabel={es ? "Ciudades destacadas" : "Featured cities"}
      >
        {cities.map((city, index) => {
          const score = catalogFitScore(city);
          return (
            <EngineExpandLink
              key={city.slug}
              id={`rv-home-deck-${city.slug}`}
              className="rv-home-deck-card"
              href={`/cities/${city.slug}`}
              targetId={cityTransitionSurfaceId(city.slug)}
              mediaSelector=".rv-home-deck-card__media"
              duration={CITY_EXPAND_DURATION}
              handoffDuration={CITY_HANDOFF_DURATION}
              transition="instant"
            >
              <div className="rv-home-deck-card__media" data-engine-expand-media>
                <OfficialCityImage
                  slug={city.slug}
                  className="rv-home-deck-card__image"
                  priority={index < 2}
                  sizes="(max-width: 760px) calc(100vw - 3rem), 520px"
                  style={{ position: "absolute", inset: 0 }}
                />
                <span className="rv-home-deck-card__shade" aria-hidden="true" />
              </div>
              <div className="rv-home-deck-card__top" data-engine-expand-detail>
                <span>{city.continent}</span>
                <strong>{score === null ? "—" : score.toFixed(1)}</strong>
              </div>
              <div className="rv-home-deck-card__copy" data-engine-expand-detail>
                <p>{city.country}</p>
                <h3>{city.city}</h3>
                <div className="rv-home-deck-card__metrics">
                  <span><strong>{metric(city.quality, "/10")}</strong>{es ? "calidad" : "quality"}</span>
                  <span><strong>{metric(city.internet, " Mbps")}</strong>internet</span>
                  <span><strong>{city.cost?.replace("/mo", "") ?? "—"}</strong>{es ? "coste/mes" : "cost/mo"}</span>
                </div>
              </div>
            </EngineExpandLink>
          );
        })}
      </EngineSwipeDeck>
    </div>
  );
}
