"use client";

import { CustomSelect, EngineReveal, EngineTransitionLink } from "@/engine";
import { useEffect, useMemo, useState } from "react";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import { CityThumb } from "./CityThumb";
import { CompareAtmosphere } from "./CompareAtmosphere";
import { copyFor, type RoavioLocale } from "./i18n";

const metricKeys: Array<{ key: "quality" | "safety" | "internet"; suffix: string }> = [
  { key: "quality", suffix: "/10" },
  { key: "safety", suffix: "/10" },
  { key: "internet", suffix: " Mbps" },
];

function scoreLabel(city: CityCatalogEntry): string {
  const score = catalogFitScore(city);
  return score === null ? "—" : score.toFixed(1);
}

function indexesForSlugs(catalog: CityCatalogEntry[], slugs: string[], fallbackSlugs: string[]): number[] {
  const indexes: number[] = [];
  for (const slug of slugs) {
    if (indexes.length >= 3) break;
    const index = catalog.findIndex((city) => city.slug === slug);
    if (index >= 0 && !indexes.includes(index)) indexes.push(index);
  }
  for (const slug of fallbackSlugs) {
    if (indexes.length >= 3) break;
    const index = catalog.findIndex((city) => city.slug === slug);
    if (index >= 0 && !indexes.includes(index)) indexes.push(index);
  }
  for (let index = 0; indexes.length < 3 && index < catalog.length; index += 1) {
    if (!indexes.includes(index)) indexes.push(index);
  }
  return indexes.slice(0, 3);
}

function bestMetric(cities: CityCatalogEntry[], key: "quality" | "safety" | "internet"): number | null {
  const values = cities.map((city) => city[key]).filter((value): value is number => value !== null);
  return values.length ? Math.max(...values) : null;
}

export function CompareBoard({
  catalog,
  locale,
  initialSlugs = ["valencia", "lisboa", "bali"],
}: {
  catalog: CityCatalogEntry[];
  locale: RoavioLocale;
  initialSlugs?: string[];
}) {
  const copy = copyFor(locale).compare;
  const fallback = indexesForSlugs(catalog, initialSlugs, ["valencia", "lisboa", "bali"]);
  const [selected, setSelected] = useState<number[]>(fallback);
  const [urlReady, setUrlReady] = useState(false);
  const chosen = selected.map((index) => catalog[index]).filter((city): city is CityCatalogEntry => Boolean(city));

  const options = useMemo(() => catalog.map((city, index) => ({
    value: String(index),
    label: `${city.city} · ${city.country}`,
  })), [catalog]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("cities");
    if (raw) {
      setSelected(indexesForSlugs(
        catalog,
        raw.split(",").map((value) => value.trim()).filter(Boolean),
        ["valencia", "lisboa", "bali"],
      ));
    }
    setUrlReady(true);
  }, [catalog]);

  useEffect(() => {
    if (!urlReady) return;
    const slugs = selected.map((index) => catalog[index]?.slug).filter((slug): slug is string => Boolean(slug));
    if (!slugs.length) return;
    const url = new URL(window.location.href);
    const value = slugs.join(",");
    if (url.searchParams.get("cities") === value) return;
    url.searchParams.set("cities", value);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [catalog, selected, urlReady]);

  const update = (slot: number, cityIndex: number) => {
    if (!Number.isInteger(cityIndex) || cityIndex < 0 || cityIndex >= catalog.length) return;
    setSelected((current) => {
      if (current[slot] === cityIndex) return current;
      const duplicateSlot = current.findIndex((value, index) => index !== slot && value === cityIndex);
      const next = [...current];
      if (duplicateSlot >= 0) {
        const previous = next[slot];
        next[slot] = cityIndex;
        next[duplicateSlot] = previous;
        return next;
      }
      next[slot] = cityIndex;
      return next;
    });
  };

  const scoreValues = chosen.map(catalogFitScore).filter((value): value is number => value !== null);
  const bestScore = scoreValues.length ? Math.max(...scoreValues) : null;
  const metricLabel = (key: "quality" | "safety" | "internet") => key === "quality"
    ? copy.quality
    : key === "safety"
      ? copy.safety
      : copy.internet;

  return (
    <div className="rv-compare-stage">
      <CompareAtmosphere />
      <div className="rv-compare-stage__content">
        <div className="rv-compare-select-grid">
          {selected.map((value, slot) => (
            <CustomSelect
              key={slot}
              name={`compare-city-${slot + 1}`}
              className="rv-engine-city-select"
              options={options}
              value={String(value)}
              searchable
              size="lg"
              ariaLabel={locale === "es" ? `Ciudad ${slot + 1} de la comparación` : `Comparison city ${slot + 1}`}
              searchPlaceholder={locale === "es" ? "Buscar ciudad o país…" : "Search city or country…"}
              emptyLabel={locale === "es" ? "No hay coincidencias" : "No matches"}
              onChange={(next) => update(slot, Number(next))}
            />
          ))}
        </div>

        <div className="rv-compare-city-strip">
          {chosen.map((city, index) => (
            <EngineReveal
              key={`visual-${city.slug}`}
              className="rv-compare-city-reveal"
              effect="pop"
              replay
              renderMargin={1200}
              motionMargin={120}
              duration={330}
              delay={index * 20}
              scaleFrom={0.84}
              overshoot={1.018}
              releaseWhenFar
            >
              <EngineTransitionLink href={`/cities/${city.slug}`} transition="portal" className="rv-compare-city-card">
                <CityThumb slug={city.slug} city={city.city} country={city.country} compact />
                <div className="rv-compare-city-card__meta">
                  <strong>{city.city}</strong>
                  <span>{scoreLabel(city) === "—" ? (locale === "es" ? "parcial" : "partial") : `${scoreLabel(city)}/10`}</span>
                </div>
              </EngineTransitionLink>
            </EngineReveal>
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
