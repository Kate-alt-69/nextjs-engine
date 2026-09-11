"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cities, citySlug, nomadScore, type RoavioCity } from "./cities";

type Priority = "balance" | "quality" | "safety" | "internet";
type BeachPreference = "any" | "prefer" | "must";
type Region = "any" | "Europe" | "Asia" | "Americas" | "Africa-Oceania";
type Speed = "any" | "100" | "200";

function regionMatches(city: RoavioCity, region: Region) {
  if (region === "any") return true;
  if (region === "Americas") return city.continent.includes("America") || city.continent === "Americas";
  if (region === "Africa-Oceania") return city.continent === "Africa" || city.continent === "Oceania";
  return city.continent === region;
}

function matchScore(city: RoavioCity, priority: Priority, beach: BeachPreference, region: Region, speed: Speed) {
  let score = nomadScore(city);
  if (priority === "quality") score += city.quality * 0.32;
  if (priority === "safety") score += city.safety * 0.34;
  if (priority === "internet") score += Math.min(city.internet / 45, 7);
  if (region !== "any") score += regionMatches(city, region) ? 2.2 : -4.5;
  if (beach === "prefer") score += city.beach ? 1.25 : 0;
  if (beach === "must") score += city.beach ? 2 : -8;
  const threshold = speed === "any" ? 0 : Number(speed);
  if (threshold && city.internet < threshold) score -= 4;
  return score;
}

function Choice<T extends string>({ value, active, onClick, children }: { value: T; active: boolean; onClick: (value: T) => void; children: React.ReactNode }) {
  return <button type="button" className="rv-match-option" data-active={active} onClick={() => onClick(value)}>{children}</button>;
}

export function MatchQuiz() {
  const [priority, setPriority] = useState<Priority>("balance");
  const [beach, setBeach] = useState<BeachPreference>("any");
  const [region, setRegion] = useState<Region>("any");
  const [speed, setSpeed] = useState<Speed>("any");

  const matches = useMemo(() => [...cities]
    .map((city) => ({ city, score: matchScore(city, priority, beach, region, speed) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6), [priority, beach, region, speed]);

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>1 · What matters most?</strong>
        <div className="rv-match-grid" style={{ marginTop: ".75rem" }}>
          <Choice value="balance" active={priority === "balance"} onClick={setPriority}>⚖️ Balanced overall</Choice>
          <Choice value="quality" active={priority === "quality"} onClick={setPriority}>✨ Quality of life</Choice>
          <Choice value="safety" active={priority === "safety"} onClick={setPriority}>🛡 Safety</Choice>
          <Choice value="internet" active={priority === "internet"} onClick={setPriority}>⚡ Internet speed</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>2 · How important is beach access?</strong>
        <div className="rv-match-grid" style={{ marginTop: ".75rem" }}>
          <Choice value="any" active={beach === "any"} onClick={setBeach}>No preference</Choice>
          <Choice value="prefer" active={beach === "prefer"} onClick={setBeach}>Would be nice</Choice>
          <Choice value="must" active={beach === "must"} onClick={setBeach}>🏖 Must have it</Choice>
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>3 · Any region preference?</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          {(["any", "Europe", "Asia", "Americas", "Africa-Oceania"] as Region[]).map((value) => <button key={value} className="rv-pill" data-active={region === value} onClick={() => setRegion(value)} type="button">{value === "any" ? "Anywhere" : value}</button>)}
        </div>
      </section>

      <section className="rv-panel" style={{ padding: "1.2rem" }}>
        <strong>4 · Minimum fixed internet?</strong>
        <div className="rv-filter-pills" style={{ marginTop: ".75rem" }}>
          {(["any", "100", "200"] as Speed[]).map((value) => <button key={value} className="rv-pill" data-active={speed === value} onClick={() => setSpeed(value)} type="button">{value === "any" ? "No minimum" : `${value}+ Mbps`}</button>)}
        </div>
      </section>

      <div>
        <p style={{ margin: "0 0 .7rem", color: "var(--rv-muted)", fontSize: ".85rem" }}>Live proposal ranking · based only on the structured metrics currently available to the prototype.</p>
        <div className="rv-result-grid">
          {matches.map(({ city }, index) => <article className="rv-result-card" key={city.city}>
            <div className="rv-result-head"><div><h3>{index + 1}. {city.city}</h3><p>{city.country} · {city.continent}</p></div><div className="rv-result-score">{nomadScore(city).toFixed(1)}</div></div>
            <div className="rv-result-metrics"><div><strong>{city.internet} Mbps</strong><span>internet</span></div><div><strong>{city.safety}/10</strong><span>safety</span></div><div><strong>{city.quality}/10</strong><span>quality</span></div></div>
            <div className="rv-card-actions"><Link className="rv-primary" href={`/cities/${citySlug(city.city)}`}>Open city →</Link><Link className="rv-secondary" href={`/compare?cities=${citySlug(city.city)}`}>Compare</Link></div>
          </article>)}
        </div>
      </div>
    </div>
  );
}
