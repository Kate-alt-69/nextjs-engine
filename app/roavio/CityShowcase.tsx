import Link from "next/link";
import { featuredImages } from "./cities";
import { catalogFitScore, catalogMetric, type CityCatalogEntry } from "./catalog";
import { loadCityCatalog } from "./cityContent.server";

const FEATURED = ["valencia", "lisboa", "bali", "bangkok", "dubai", "chiang-mai"];
const gradients = [
  "linear-gradient(145deg,#244b3f,#789f75)",
  "linear-gradient(145deg,#764637,#d8956d)",
  "linear-gradient(145deg,#21444d,#8ec7bc)",
  "linear-gradient(145deg,#4f2740,#ce6b55)",
  "linear-gradient(145deg,#473a61,#d5a35f)",
  "linear-gradient(145deg,#345f55,#c7c16c)",
];

export async function CityShowcase() {
  const catalog = await loadCityCatalog();
  const featured = FEATURED
    .map((slug) => catalog.find((city) => city.slug === slug))
    .filter((city): city is CityCatalogEntry => Boolean(city));

  return (
    <div className="rv-city-grid">
      {featured.map((city, index) => {
        const image = featuredImages[city.slug];
        const score = catalogFitScore(city);
        return (
          <Link key={city.slug} className="rv-city-card" href={`/cities/${city.slug}`} style={{ background: gradients[index % gradients.length] }}>
            {image ? <img className="rv-city-card__photo" src={image} alt="" loading={index < 3 ? "eager" : "lazy"} /> : null}
            <div className="rv-card-top">
              <span className="rv-score">{score === null ? "Roavio profile" : `Roavio fit ${score.toFixed(1)}`}</span>
              <span className="rv-score">{city.beach === true ? "Beach ✓" : city.continent}</span>
            </div>
            <div className="rv-card-bottom">
              <h3>{city.city}</h3>
              <p>{city.country} · {city.cost ?? "cost not exposed"}</p>
              <div className="rv-mini-metrics">
                <div className="rv-mini-metric"><strong>{catalogMetric(city.quality, "/10")}</strong><span>quality</span></div>
                <div className="rv-mini-metric"><strong>{catalogMetric(city.safety, "/10")}</strong><span>safety</span></div>
                <div className="rv-mini-metric"><strong>{catalogMetric(city.internet, "M")}</strong><span>internet</span></div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
