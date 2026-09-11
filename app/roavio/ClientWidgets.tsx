"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cities, citySlug, nomadScore, type RoavioCity } from "./cities";

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

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/cities?search=${encodeURIComponent(value)}` : "/cities");
  };

  return (
    <form className="rv-search" onSubmit={submit}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ciudad, país o continente…" aria-label="Buscar destinos" />
      <button className="rv-primary" type="submit">Explorar destinos <span aria-hidden>↗</span></button>
    </form>
  );
}

function CityResultCard({ city, favorite, compared, onFavorite, onCompare }: {
  city: RoavioCity;
  favorite: boolean;
  compared: boolean;
  onFavorite: () => void;
  onCompare: () => void;
}) {
  const slug = citySlug(city.city);
  return (
    <article className="rv-result-card">
      <div className="rv-result-head">
        <div>
          <h3><Link href={`/cities/${slug}`} style={{ textDecoration: "none" }}>{city.city}</Link></h3>
          <p>{city.country} · {city.continent} {city.beach ? "· beach" : ""}</p>
        </div>
        <div className="rv-result-score" title="Composite proposal score">{nomadScore(city).toFixed(1)}</div>
      </div>
      <div className="rv-result-metrics">
        <div><strong>{city.cost.replace("/mo", "")}</strong><span>monthly cost</span></div>
        <div><strong>{city.internet} Mbps</strong><span>fixed internet</span></div>
        <div><strong>{city.quality}/10</strong><span>quality of life</span></div>
      </div>
      <div className="rv-card-actions">
        <button className="rv-icon-btn" type="button" data-active={favorite} onClick={onFavorite} aria-label={favorite ? "Quitar de favoritos" : "Guardar favorito"}>{favorite ? "♥ Saved" : "♡ Save"}</button>
        <button className="rv-icon-btn" type="button" data-active={compared} onClick={onCompare}>{compared ? "✓ Compare" : "+ Compare"}</button>
        <Link className="rv-icon-btn" href={`/cities/${slug}`} style={{ marginLeft: "auto", textDecoration: "none" }}>Open ↗</Link>
      </div>
    </article>
  );
}

export function Explorer({ initialSearch = "" }: { initialSearch?: string }) {
  const [query, setQuery] = useState(initialSearch);
  const [continent, setContinent] = useState("All");
  const [beachOnly, setBeachOnly] = useState(false);
  const [sort, setSort] = useState("fit");
  const [compare, setCompare] = useState<string[]>([]);
  const { favorites, toggle } = useFavorites();
  const continents = ["All", ...Array.from(new Set(cities.map((city) => city.continent)))];

  useEffect(() => {
    if (initialSearch) return;
    const fromUrl = new URLSearchParams(window.location.search).get("search");
    if (fromUrl) setQuery(fromUrl);
  }, [initialSearch]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = cities.filter((city) => {
      const matchesSearch = !needle || `${city.city} ${city.country} ${city.continent}`.toLowerCase().includes(needle);
      return matchesSearch && (continent === "All" || city.continent === continent) && (!beachOnly || city.beach);
    });
    return [...filtered].sort((a, b) => {
      if (sort === "quality") return b.quality - a.quality;
      if (sort === "safety") return b.safety - a.safety;
      if (sort === "internet") return b.internet - a.internet;
      if (sort === "az") return a.city.localeCompare(b.city);
      return nomadScore(b) - nomadScore(a);
    });
  }, [query, continent, beachOnly, sort]);

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
        <input className="rv-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city, country, continent…" />
        <select className="rv-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar destinos">
          <option value="fit">Best Roavio fit</option>
          <option value="quality">Quality of life</option>
          <option value="safety">Safety</option>
          <option value="internet">Internet speed</option>
          <option value="az">A–Z</option>
        </select>
        <button className="rv-pill" data-active={beachOnly} onClick={() => setBeachOnly((value) => !value)} type="button">🏖 Beach only</button>
      </div>
      <div className="rv-filter-pills">
        {continents.map((item) => <button key={item} className="rv-pill" data-active={continent === item} onClick={() => setContinent(item)} type="button">{item}</button>)}
      </div>
      <p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>{results.length} destinations · compare up to 3 without leaving the directory</p>
      <div className="rv-result-grid">
        {results.map((city) => {
          const slug = citySlug(city.city);
          return <CityResultCard key={city.city} city={city} favorite={favorites.includes(slug)} compared={compare.includes(slug)} onFavorite={() => toggle(slug)} onCompare={() => toggleCompare(slug)} />;
        })}
      </div>
      {compare.length > 0 ? (
        <div className="rv-compare-tray">
          <div><strong>Compare tray</strong><div className="rv-compare-chips">{compare.map((slug) => <span className="rv-compare-chip" key={slug}>{cities.find((city) => citySlug(city.city) === slug)?.city ?? slug}</span>)}</div></div>
          <Link className="rv-primary" href={`/compare?cities=${compare.join(",")}`}>Compare {compare.length} cities →</Link>
        </div>
      ) : null}
    </div>
  );
}

const metrics: Array<{ label: string; key: keyof Pick<RoavioCity, "quality" | "safety" | "internet">; suffix: string }> = [
  { label: "Quality of life", key: "quality", suffix: "/10" },
  { label: "Safety", key: "safety", suffix: "/10" },
  { label: "Internet", key: "internet", suffix: " Mbps" }
];

function indexesForSlugs(slugs: string[], fallback: number[]): number[] {
  const indexes = slugs.map((slug) => cities.findIndex((city) => citySlug(city.city) === slug)).filter((index) => index >= 0).slice(0, 3);
  for (const index of fallback) {
    if (indexes.length >= 3) break;
    if (!indexes.includes(index)) indexes.push(index);
  }
  return indexes.slice(0, 3);
}

export function CompareBoard({ initialSlugs = ["valencia", "lisboa", "bali"] }: { initialSlugs?: string[] }) {
  const fallback = indexesForSlugs(initialSlugs, [0, 1, 2]);
  const [selected, setSelected] = useState<number[]>(fallback);
  const chosen = selected.map((index) => cities[index]);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("cities");
    if (!raw) return;
    const fromUrl = indexesForSlugs(raw.split(",").map((value) => value.trim()).filter(Boolean), fallback);
    setSelected(fromUrl);
  }, []);

  const update = (slot: number, cityIndex: number) => setSelected((current) => current.map((value, index) => index === slot ? cityIndex : value));

  return (
    <div>
      <div className="rv-toolbar" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        {selected.map((value, slot) => (
          <select key={slot} className="rv-select" value={value} onChange={(event) => update(slot, Number(event.target.value))}>
            {cities.map((city, index) => <option key={city.city} value={index}>{city.city} · {city.country}</option>)}
          </select>
        ))}
      </div>
      <div className="rv-compare-grid">
        <div className="rv-compare-label">Metric</div>
        {chosen.map((city) => <div key={`head-${city.city}`}><strong style={{ fontFamily: "Manrope", fontSize: "1.15rem" }}>{city.city}</strong><div style={{ color: "var(--rv-muted)", fontSize: ".78rem" }}>{city.country}</div></div>)}
        <div className="rv-compare-label">Monthly cost</div>
        {chosen.map((city) => <div key={`cost-${city.city}`}><strong>{city.cost}</strong></div>)}
        {metrics.map((metric) => {
          const best = Math.max(...chosen.map((city) => Number(city[metric.key])));
          return [<div className="rv-compare-label" key={`${metric.key}-label`}>{metric.label}</div>, ...chosen.map((city) => <div key={`${metric.key}-${city.city}`} className={Number(city[metric.key]) === best ? "rv-best" : ""}><strong>{city[metric.key]}{metric.suffix}</strong></div>)];
        })}
        <div className="rv-compare-label">Beach</div>
        {chosen.map((city) => <div key={`beach-${city.city}`} className={city.beach ? "rv-best" : ""}>{city.beach ? "Yes · coastal access" : "No"}</div>)}
        <div className="rv-compare-label">Roavio fit</div>
        {chosen.map((city) => {
          const best = Math.max(...chosen.map(nomadScore));
          const score = nomadScore(city);
          return <div key={`score-${city.city}`} className={score === best ? "rv-best" : ""}><strong>{score.toFixed(1)}/10</strong></div>;
        })}
      </div>
      <p style={{ color: "var(--rv-muted)", fontSize: ".78rem", marginTop: ".8rem" }}>Proposal note: production can also compare normalized EUR cost, tax/visa complexity, healthcare and climate from Roavio's existing data services.</p>
    </div>
  );
}

export function FavoritesBoard() {
  const { favorites, toggle } = useFavorites();
  const saved = cities.filter((city) => favorites.includes(citySlug(city.city)));

  if (saved.length === 0) {
    return <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}><h3 style={{ marginTop: 0 }}>Your shortlist is empty</h3><p style={{ color: "var(--rv-muted)" }}>Save destinations while exploring. This proposal stores them locally; a Roavio account can sync the same model later.</p><Link className="rv-primary" href="/cities">Find cities →</Link></div>;
  }

  return <div className="rv-result-grid">{saved.map((city) => {
    const slug = citySlug(city.city);
    return <CityResultCard key={slug} city={city} favorite compared={false} onFavorite={() => toggle(slug)} onCompare={() => undefined} />;
  })}</div>;
}
