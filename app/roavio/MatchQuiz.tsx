"use client";

import { EngineTransitionLink } from "@/engine";
import { useMemo, useState, type ReactNode } from "react";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import type { RoavioLocale } from "./i18n";

type Priority = "balance" | "quality" | "safety" | "internet";
type BeachPreference = "any" | "prefer" | "must";
type Speed = "any" | "100" | "200";

function availableBaseScore(city: CityCatalogEntry): number {
  let weighted = 0;
  let weight = 0;
  if (city.quality !== null) { weighted += city.quality * 0.45; weight += 0.45; }
  if (city.safety !== null) { weighted += city.safety * 0.3; weight += 0.3; }
  if (city.internet !== null) { weighted += Math.min(city.internet / 40, 10) * 0.25; weight += 0.25; }
  return weight ? weighted / weight : 0;
}

function matchScore(city: CityCatalogEntry, priority: Priority, beach: BeachPreference, region: string, speed: Speed) {
  let score = availableBaseScore(city);
  if (priority === "quality") score += city.quality === null ? -1 : city.quality * 0.32;
  if (priority === "safety") score += city.safety === null ? -1 : city.safety * 0.34;
  if (priority === "internet") score += city.internet === null ? -1 : Math.min(city.internet / 45, 7);
  if (region !== "any") score += city.continent === region ? 2.2 : -4.5;
  if (beach === "prefer") score += city.beach === true ? 1.25 : 0;
  if (beach === "must") score += city.beach === true ? 2 : city.beach === false ? -8 : -3;
  const threshold = speed === "any" ? 0 : Number(speed);
  if (threshold) score += city.internet === null ? -1.5 : city.internet < threshold ? -4 : 1;
  return score;
}

function Choice<T extends string>({ value, active, onClick, children }: { value: T; active: boolean; onClick: (value: T) => void; children: ReactNode }) {
  return <button type="button" className="rv-pill" data-active={active} onClick={() => onClick(value)} style={{ whiteSpace: "normal", textAlign: "left" }}>{children}</button>;
}

function regionLabel(value: string, locale: RoavioLocale) {
  if (locale === "es") return value;
  const map: Record<string, string> = { "Europa": "Europe", "Asia": "Asia", "América": "Americas", "Norteamérica": "North America", "África": "Africa", "Oceanía": "Oceania", "Oriente Medio": "Middle East" };
  return map[value] ?? value;
}

export function MatchQuiz({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const es = locale === "es";
  const [priority, setPriority] = useState<Priority>("balance");
  const [beach, setBeach] = useState<BeachPreference>("any");
  const [region, setRegion] = useState("any");
  const [speed, setSpeed] = useState<Speed>("any");
  const regions = useMemo(() => Array.from(new Set(catalog.map((city) => city.continent))).sort((a, b) => a.localeCompare(b, "es")), [catalog]);

  const matches = useMemo(() => [...catalog]
    .map((city) => ({ city, score: matchScore(city, priority, beach, region, speed) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6), [catalog, priority, beach, region, speed]);

  const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: ".55rem", marginTop: ".75rem" } as const;

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>{es ? "1 · ¿Qué te importa más?" : "1 · What matters most?"}</strong>
        <div style={gridStyle}>
          <Choice value="balance" active={priority === "balance"} onClick={setPriority}>⚖️ {es ? "Equilibrio general" : "Balanced overall"}</Choice>
          <Choice value="quality" active={priority === "quality"} onClick={setPriority}>✨ {es ? "Calidad de vida" : "Quality of life"}</Choice>
          <Choice value="safety" active={priority === "safety"} onClick={setSafety => setPriority(setSafety)}>🛡 {es ? "Seguridad" : "Safety"}</Choice>
          <Choice value="internet" active={priority === "internet"} onClick={setPriority}>⚡ {es ? "Velocidad de internet" : "Internet speed"}</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>{es ? "2 · ¿Qué importancia tiene el acceso a playa?" : "2 · How important is beach access?"}</strong>
        <div style={gridStyle}>
          <Choice value="any" active={beach === "any"} onClick={setBeach}>{es ? "Sin preferencia" : "No preference"}</Choice>
          <Choice value="prefer" active={beach === "prefer"} onClick={setBeach}>{es ? "Estaría bien" : "Would be nice"}</Choice>
          <Choice value="must" active={beach === "must"} onClick={setBeach}>🏖 {es ? "Imprescindible" : "Must have it"}</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>{es ? "3 · ¿Prefieres alguna región?" : "3 · Any region preference?"}</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          <button className="rv-pill" data-active={region === "any"} onClick={() => setRegion("any")} type="button">{es ? "Cualquiera" : "Anywhere"}</button>
          {regions.map((value) => <button key={value} className="rv-pill" data-active={region === value} onClick={() => setRegion(value)} type="button">{regionLabel(value, locale)}</button>)}
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>{es ? "4 · ¿Internet fijo mínimo?" : "4 · Minimum fixed internet?"}</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          {(["any", "100", "200"] as Speed[]).map((value) => <button key={value} className="rv-pill" data-active={speed === value} onClick={() => setSpeed(value)} type="button">{value === "any" ? (es ? "Sin mínimo" : "No minimum") : `${value}+ Mbps`}</button>)}
        </div>
      </section>

      <div>
        <p style={{ margin: "0 0 .7rem", color: "var(--rv-muted)", fontSize: ".85rem" }}>{es ? `Ranking en vivo sobre los ${catalog.length} destinos mapeados. Los datos ausentes siguen ausentes en lugar de inventarse.` : `Live ranking across all ${catalog.length} mapped destinations. Missing source metrics stay missing instead of being invented.`}</p>
        <div className="rv-result-grid">
          {matches.map(({ city }, index) => {
            const fit = catalogFitScore(city);
            return (
              <article className="rv-result-card" key={city.slug}>
                <div className="rv-result-card__body">
                  <div className="rv-result-head">
                    <div><h3>{index + 1}. {city.city}</h3><p>{city.country} · {regionLabel(city.continent, locale)}</p></div>
                    <div className="rv-result-score">{fit === null ? (es ? "parcial" : "partial") : fit.toFixed(1)}</div>
                  </div>
                  <div className="rv-result-metrics">
                    <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>internet</span></div>
                    <div><strong>{catalogMetric(city.safety, "/10")}</strong><span>{es ? "seguridad" : "safety"}</span></div>
                    <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>{es ? "calidad" : "quality"}</span></div>
                  </div>
                  <div className="rv-card-actions">
                    <EngineTransitionLink className="rv-primary" href={`/cities/${city.slug}`} transition="portal">{es ? "Abrir ciudad" : "Open city"} →</EngineTransitionLink>
                    <EngineTransitionLink className="rv-secondary" href={`/compare?cities=${city.slug}`} transition="depth">{es ? "Comparar" : "Compare"}</EngineTransitionLink>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
