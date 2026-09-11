"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  catalogFitScore,
  catalogMetric,
  type CityCatalogEntry,
} from "./catalog";

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

function sortNumber(value: number | null): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

function scoreLabel(city: CityCatalogEntry): string {
  const score = catalogFitScore(city);
  return score === null ? "—" : score.toFixed(1);
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
  city: CityCatalogEntry;
  favorite: boolean;
  compared: boolean;
  onFavorite: () => void;
  onCompare: () => void;
}) {
  return (
    <article className="rv-result-card">
      <div className="rv-result-head">
        <div>
          <h3><Link href={`/cities/${city.slug}`} style={{ textDecoration: "none" }}>{city.city}</Link></h3>
          <p>{city.country} · {city.continent} {city.beach === true ? "· beach" : ""}</p>
        </div>
        <div className="rv-result-score" title="Composite proposal score">{scoreLabel(city)}</div>
      </div>
      <div className="rv-result-metrics">
        <div><strong>{city.cost ? city.cost.replace("/mo", "") : "—"}</strong><span>monthly cost</span></div>
        <div><strong>{catalogMetric(city.internet, " Mbps")}</strong><span>fixed internet</span></div>
        <div><strong>{catalogMetric(city.quality, "/10")}</strong><span>quality of life</span></div>
      </div>
      <div className="rv-card-actions">
        <button className="rv-icon-btn" type="button" data-active={favorite} onClick={onFavorite} aria-label={favorite ? "Quitar de favoritos" : "Guardar favorito"}>{favorite ? "♥ Saved" : "♡ Save"}</button>
        <button className="rv-icon-btn" type="button" data-active={compared} onClick={onCompare}>{compared ? "✓ Compare" : "+ Compare"}</button>
        <Link className="rv-icon-btn" href={`/cities/${city.slug}`} style={{ marginLeft: "auto", textDecoration: "none" }}>Open ↗</Link>
      </div>
    </article>
  );
}

export function Explorer({ catalog, initialSearch = "" }: { catalog: CityCatalogEntry[]; initialSearch?: string }) {
  const [query, setQuery] = useState(initialSearch);
  const [continent, setContinent] = useState("All");
  const [beachOnly, setBeachOnly] = useState(false);
  const [sort, setSort] = useState("fit");
  const [compare, setCompare] = useState<string[]>([]);
  const { favorites, toggle } = useFavorites();
  const continents = ["All", ...Array.from(new Set(catalog.map((city) => city.continent)))];

  useEffect(() => {
    if (initialSearch) return;
    const fromUrl = new URLSearchParams(window.location.search).get("search");
    if (fromUrl) setQuery(fromUrl);
  }, [initialSearch]);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    const filtered = catalog.filter((city) => {
      const matchesSearch = !needle || `${city.city} ${city.country} ${city.continent}`.toLocaleLowerCase("es").includes(needle);
      return matchesSearch && (continent === "All" || city.continent === continent) && (!beachOnly || city.beach === true);
    });

    return [...filtered].sort((a, b) => {
      if (sort === "quality") return sortNumber(b.quality) - sortNumber(a.quality);
      if (sort === "safety") return sortNumber(b.safety) - sortNumber(a.safety);
      if (sort === "internet") return sortNumber(b.internet) - sortNumber(a.internet);
      if (sort === "az") return a.city.localeCompare(b.city, "es");
      return sortNumber(catalogFitScore(b)) - sortNumber(catalogFitScore(a));
    });
  }, [catalog, query, continent, beachOnly, sort]);

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
      <p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>{results.length} destinations · {catalog.length} in the catalog · compare up to 3</p>
      <div className="rv-result-grid">
        {results.map((city) => (
          <CityResultCard
            key={city.slug}
            city={city}
            favorite={favorites.includes(city.slug)}
            compared={compare.includes(city.slug)}
            onFavorite={() => toggle(city.slug)}
            onCompare={() => toggleCompare(city.slug)}
          />
        ))}
      </div>
      {results.length === 0 ? (
        <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}>
          <h3 style={{ marginTop: 0 }}>No destination matches that combination</h3>
          <p style={{ color: "var(--rv-muted)" }}>Try another region, remove the beach requirement, or clear the search.</p>
        </div>
      ) : null}
      {compare.length > 0 ? (
        <div className="rv-compare-tray">
          <div><strong>Compare tray</strong><div className="rv-compare-chips">{compare.map((slug) => <span className="rv-compare-chip" key={slug}>{catalog.find((city) => city.slug === slug)?.city ?? slug}</span>)}</div></div>
          <Link className="rv-primary" href={`/compare?cities=${compare.join(",")}`}>Compare {compare.length} cities →</Link>
        </div>
      ) : null}
    </div>
  );
}

const metrics: Array<{ label: string; key: "quality" | "safety" | "internet"; suffix: string }> = [
  { label: "Quality of life", key: "quality", suffix: "/10" },
  { label: "Safety", key: "safety", suffix: "/10" },
  { label: "Internet", key: "internet", suffix: " Mbps" },
];

function indexesForSlugs(catalog: CityCatalogEntry[], slugs: string[], fallbackSlugs: string[]): number[] {
  const indexes = slugs
    .map((slug) => catalog.findIndex((city) => city.slug === slug))
    .filter((index) => index >= 0)
    .slice(0, 3);

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

export function CompareBoard({ catalog, initialSlugs = ["valencia", "lisboa", "bali"] }: { catalog: CityCatalogEntry[]; initialSlugs?: string[] }) {
  const fallback = indexesForSlugs(catalog, initialSlugs, ["valencia", "lisboa", "bali"]);
  const [selected, setSelected] = useState<number[]>(fallback);
  const chosen = selected.map((index) => catalog[index]).filter((city): city is CityCatalogEntry => Boolean(city));

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("cities");
    if (!raw) return;
    const fromUrl = indexesForSlugs(catalog, raw.split(",").map((value) => value.trim()).filter(Boolean), ["valencia", "lisboa", "bali"]);
    setSelected(fromUrl);
  }, [catalog]);

  const update = (slot: number, cityIndex: number) => setSelected((current) => current.map((value, index) => index === slot ? cityIndex : value));

  const scoreValues = chosen.map(catalogFitScore).filter((value): value is number => value !== null);
  const bestScore = scoreValues.length ? Math.max(...scoreValues) : null;

  return (
    <div>
      <div className="rv-toolbar" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        {selected.map((value, slot) => (
          <select key={slot} className="rv-select" value={value} onChange={(event) => update(slot, Number(event.target.value))}>
            {catalog.map((city, index) => <option key={city.slug} value={index}>{city.city} · {city.country}</option>)}
          </select>
        ))}
      </div>
      <div className="rv-compare-grid">
        <div className="rv-compare-label">Metric</div>
        {chosen.map((city) => <div key={`head-${city.slug}`}><strong style={{ fontFamily: "Manrope", fontSize: "1.15rem" }}>{city.city}</strong><div style={{ color: "var(--rv-muted)", fontSize: ".78rem" }}>{city.country}</div></div>)}

        <div className="rv-compare-label">Monthly cost</div>
        {chosen.map((city) => <div key={`cost-${city.slug}`}><strong>{city.cost ?? "—"}</strong></div>)}

        {metrics.map((metric) => {
          const best = bestMetric(chosen, metric.key);
          return [
            <div className="rv-compare-label" key={`${metric.key}-label`}>{metric.label}</div>,
            ...chosen.map((city) => {
              const value = city[metric.key];
              return <div key={`${metric.key}-${city.slug}`} className={value !== null && best !== null && value === best ? "rv-best" : ""}><strong>{catalogMetric(value, metric.suffix)}</strong></div>;
            }),
          ];
        })}

        <div className="rv-compare-label">Beach</div>
        {chosen.map((city) => <div key={`beach-${city.slug}`} className={city.beach === true ? "rv-best" : ""}>{city.beach === true ? "Yes · coastal access" : city.beach === false ? "No" : "—"}</div>)}

        <div className="rv-compare-label">Roavio fit</div>
        {chosen.map((city) => {
          const score = catalogFitScore(city);
          return <div key={`score-${city.slug}`} className={score !== null && bestScore !== null && score === bestScore ? "rv-best" : ""}><strong>{score === null ? "—" : `${score.toFixed(1)}/10`}</strong></div>;
        })}
      </div>
      <p style={{ color: "var(--rv-muted)", fontSize: ".78rem", marginTop: ".8rem" }}>A dash means the source did not expose that metric. Mixed currencies are deliberately shown as supplied rather than falsely ranked as directly comparable.</p>
    </div>
  );
}

export function FavoritesBoard({ catalog }: { catalog: CityCatalogEntry[] }) {
  const { favorites, toggle } = useFavorites();
  const saved = catalog.filter((city) => favorites.includes(city.slug));

  if (saved.length === 0) {
    return <div className="rv-panel" style={{ padding: "2rem", textAlign: "center" }}><h3 style={{ marginTop: 0 }}>Your shortlist is empty</h3><p style={{ color: "var(--rv-muted)" }}>Save destinations while exploring. This proposal stores them locally; a Roavio account can sync the same model later.</p><Link className="rv-primary" href="/cities">Find cities →</Link></div>;
  }

  return <div className="rv-result-grid">{saved.map((city) => (
    <CityResultCard key={city.slug} city={city} favorite compared={false} onFavorite={() => toggle(city.slug)} onCompare={() => undefined} />
  ))}</div>;
}
