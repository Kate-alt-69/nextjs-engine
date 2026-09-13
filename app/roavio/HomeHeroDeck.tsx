"use client";

import { EngineAPIResolver, EngineExpandLink, EngineSwipeDeck } from "@/engine";
import { useEffect, useState } from "react";
import { catalogFitScore, type CityCatalogEntry } from "./catalog";
import { CITY_EXPAND_DURATION, CITY_HANDOFF_DURATION, cityTransitionSurfaceId } from "./cityTransition";
import type { RoavioLocale } from "./i18n";
import { OfficialCityImage } from "./OfficialCityImage";

function metric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

function HeroDeckCard({ city, locale, imageActive }: { city: CityCatalogEntry; locale: RoavioLocale; imageActive: boolean }) {
  const es = locale === "es";
  const score = catalogFitScore(city);
  return (
    <EngineExpandLink
      id={`rv-home-deck-${city.slug}`}
      className="rv-home-deck-card"
      href={`/cities/${city.slug}`}
      targetId={cityTransitionSurfaceId(city.slug)}
      mediaSelector=".rv-home-deck-card__media"
      duration={CITY_EXPAND_DURATION}
      handoffDuration={CITY_HANDOFF_DURATION}
      transition="instant"
    >
      <div className="rv-home-deck-card__media" data-engine-expand-media data-image-active={imageActive ? "true" : "false"}>
        {imageActive ? (
          <OfficialCityImage
            slug={city.slug}
            className="rv-home-deck-card__image"
            priority
            sizes="(max-width: 760px) calc(100vw - 3rem), 520px"
            style={{ position: "absolute", inset: 0 }}
          />
        ) : null}
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
}

export function HomeHeroDeck({ locale }: { locale: RoavioLocale }) {
  const [cities, setCities] = useState<CityCatalogEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const es = locale === "es";

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const resolver = new EngineAPIResolver({
      endpoint: `/api/home-city-deck?limit=30&index=${Date.now()}`,
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    void resolver.resolveRequest()
      .then(async (response) => {
        if (!response.ok) throw new Error(`home city deck returned ${response.status}`);
        return response.json() as Promise<{ cities?: CityCatalogEntry[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const next = Array.isArray(payload.cities) ? payload.cities.slice(0, 30) : [];
        setCities(next);
        setActiveIndex(0);
        setFailed(next.length < 3);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rv-home-deck-shell">
      <div className="rv-home-deck__eyebrow">
        <span>{es ? "DESLIZA HACIA ARRIBA" : "SWIPE UP TO EXPLORE"}</span>
        <small>{es ? "agarra + lanza ↑" : "grab + flick ↑"}</small>
      </div>
      {cities.length >= 3 ? (
        <EngineSwipeDeck
          className="rv-home-deck"
          axis="y"
          virtualize
          depth={2}
          autoplayMs={5200}
          resumeDelay={2200}
          swipeThreshold={48}
          onIndexChange={setActiveIndex}
          ariaLabel={es ? "30 ciudades destacadas" : "30 featured cities"}
        >
          {cities.map((city, index) => (
            <HeroDeckCard key={city.slug} city={city} locale={locale} imageActive={index === activeIndex} />
          ))}
        </EngineSwipeDeck>
      ) : (
        <div
          className="rv-home-deck"
          role="status"
          style={{
            display: "grid",
            placeItems: "center",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,.24)",
            background: "linear-gradient(145deg,rgba(15,47,38,.92),rgba(8,29,23,.96))",
            color: "rgba(244,251,247,.78)",
            font: "700 .78rem/1.4 Manrope, DM Sans, sans-serif",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          <span>{failed ? (es ? "No se pudo cargar la baraja." : "City deck could not load.") : (es ? "Preparando ciudades…" : "Shuffling cities…")}</span>
        </div>
      )}
    </div>
  );
}
