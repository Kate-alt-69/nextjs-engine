"use client";

import { EngineAutoRail, EngineExpandLink, EngineTransitionLink } from "@/engine";
import { catalogFitScore, type CityCatalogEntry } from "./catalog";
import {
  CITY_EXPAND_DURATION,
  CITY_HANDOFF_DURATION,
  cityTransitionImageId,
  cityTransitionSurfaceId,
} from "./cityTransition";
import { HOME_RAIL_SLUGS } from "./homeCities";
import type { RoavioLocale } from "./i18n";
import { CityThumb } from "./CityThumb";

function metric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

export function CityShowcase({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const cities = HOME_RAIL_SLUGS
    .map((slug) => catalog.find((city) => city.slug === slug))
    .filter((city): city is CityCatalogEntry => Boolean(city));
  const es = locale === "es";

  return (
    <EngineAutoRail
      className="rv-home-city-rail"
      speed={24}
      gap={14}
      resumeDelay={1800}
      motionDirection="right"
      ariaLabel={es ? "Ciudades populares y con alta calidad de vida" : "Popular and high quality-of-life cities"}
    >
      {cities.map((city, index) => {
        const score = catalogFitScore(city);
        const imageSurfaceId = cityTransitionImageId(city.slug);
        const destinationSurfaceId = cityTransitionSurfaceId(city.slug);
        return (
          <article className="rv-home-rail-card" key={city.slug}>
            <EngineExpandLink
              id={imageSurfaceId}
              className="rv-home-rail-card__visual"
              href={`/cities/${city.slug}`}
              targetId={destinationSurfaceId}
              mediaSelector=".rv-city-thumb"
              duration={CITY_EXPAND_DURATION}
              handoffDuration={CITY_HANDOFF_DURATION}
              transition="instant"
              aria-label={`${es ? "Abrir" : "Open"} ${city.city}`}
            >
              <CityThumb
                slug={city.slug}
                city={city.city}
                country={city.country}
                eager={index < 3}
              />
              <span className="rv-home-rail-card__shade" aria-hidden="true" />
              <div className="rv-home-rail-card__meta" data-engine-expand-detail>
                <div>
                  <h3>{city.city}</h3>
                  <p>{city.country} · {city.continent}</p>
                </div>
                <strong>{score === null ? "—" : score.toFixed(1)}</strong>
              </div>
            </EngineExpandLink>

            <div className="rv-home-rail-card__metrics">
              <span><strong>{city.cost?.replace("/mo", "") ?? "—"}</strong>{es ? "coste/mes" : "cost/mo"}</span>
              <span><strong>{metric(city.internet, " Mbps")}</strong>internet</span>
              <span><strong>{metric(city.quality, "/10")}</strong>{es ? "calidad" : "quality"}</span>
            </div>

            <div className="rv-home-rail-card__actions">
              <EngineTransitionLink
                href={`/compare?cities=${city.slug}`}
                transition={{ type: "fade", duration: 220 }}
                className="rv-home-rail-card__compare"
              >
                {es ? "+ Comparar" : "+ Compare"}
              </EngineTransitionLink>
              <EngineExpandLink
                href={`/cities/${city.slug}`}
                sourceId={imageSurfaceId}
                targetId={destinationSurfaceId}
                duration={CITY_EXPAND_DURATION}
                handoffDuration={CITY_HANDOFF_DURATION}
                transition="instant"
                className="rv-home-rail-card__open"
              >
                {es ? "Abrir ↗" : "Open ↗"}
              </EngineExpandLink>
            </div>
          </article>
        );
      })}
    </EngineAutoRail>
  );
}
