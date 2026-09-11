"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";

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

export function MatchQuiz({ catalog }: { catalog: CityCatalogEntry[] }) {
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
        <strong>1 · What matters most?</strong>
        <div style={gridStyle}>
          <Choice value="balance" active={priority === "balance"} onClick={setPriority}>⚖️ Balanced overall</Choice>
          <Choice value="quality" active={priority === "quality"} onClick={setPriority}>✨ Quality of life</Choice>
          <Choice value="safety" active={priority === "safety"} onClick={setPriority}>🛡 Safety</Choice>
          <Choice value="internet" active={priority === "internet"} onClick={setPriority}>⚡ Internet speed</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>2 · How important is beach access?</strong>
        <div style={gridStyle}>
          <Choice value="any" active={beach === "any"} onClick={setBeach}>No preference</Choice>
          <Choice value="prefer" active={beach === "prefer"} onClick={setBeach}>Would be nice</Choice>
          <Choice value="must" active={beach === "must"} onClick={setBeach}>🏖 Must have it</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>3 · Any region preference?</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          <button className="rv-pill" data-active={region === "any"} onClick={() => setRegion("any")} type="button">Anywhere</button>
          {regions.map((value) => <button key={value} className="rv-pill" data-active={region === value} onClick={() => setRegion(value)} type="button">{value}</button>)}
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>4 · Minimum fixed internet?</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          {(["any", "100", "200"] as Speed[]).map((value) => <button key={value} className="rv-pill" data-active={speed === value} onClick={() => setSpeed(value)} type="button">{value === "any" ? "No minimum" : `${value}+ Mbps`}</button>)}
        </div>
      </section>

      <div>
        <p style={{ margin: "0 0 .7rem", color: "var(--rv-muted)", fontSize: ".85rem" }}>Live proposal ranking across all {catalog.length} mapped destinations. Missing source metrics stay missing instead of being invented.</p>
        <div className="rv-result-grid">
          {matches.map(({ city }, index) => {
            const fit = catalogFitScore(city);
            return (
              <article className="rv-result-card" key={city.slug}>
                <div className="rv-result-head">
                  <div><h3>{index + 1}. {city.city}</h3><p>{city.country} · {city.continent}</p></div>
                  <div className="rv-result-score">{fit === null ? "partial" : fit.toFixed(1)}</div>
                </div>
                <div className="rv-result-metrics">
                  <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>internet</span></div>
                  <div><strong>{catalogMetric(city.safety, "/10")}</strong><span>safety</span></div>
                  <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>quality</span></div>
                </div>
                <div className="rv-card-actions">
                  <Link className="rv-primary" href={`/cities/${city.slug}`}>Open city →</Link>
                  <Link className="rv-secondary" href={`/compare?cities=${city.slug}`}>Compare</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
