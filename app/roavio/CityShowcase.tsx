import Link from "next/link";
import { cities, citySlug, featuredImages, nomadScore } from "./cities";

const FEATURED = ["Valencia", "Lisboa", "Bali", "Bangkok", "Dubái", "Chiang Mai"];
const gradients = [
  "linear-gradient(145deg,#244b3f,#789f75)",
  "linear-gradient(145deg,#764637,#d8956d)",
  "linear-gradient(145deg,#21444d,#8ec7bc)",
  "linear-gradient(145deg,#4f2740,#ce6b55)",
  "linear-gradient(145deg,#473a61,#d5a35f)",
  "linear-gradient(145deg,#345f55,#c7c16c)"
];

export function CityShowcase() {
  const featured = FEATURED.map((name) => cities.find((city) => city.city === name)).filter(Boolean);

  return (
    <div className="rv-city-grid">
      {featured.map((city, index) => {
        if (!city) return null;
        const slug = citySlug(city.city);
        const image = featuredImages[slug];
        return (
          <Link key={city.city} className="rv-city-card" href={`/cities/${slug}`} style={{ background: gradients[index % gradients.length] }}>
            {image ? <img className="rv-city-card__photo" src={image} alt="" loading={index < 3 ? "eager" : "lazy"} /> : null}
            <div className="rv-card-top">
              <span className="rv-score">Roavio fit {nomadScore(city).toFixed(1)}</span>
              <span className="rv-score">{city.beach ? "Beach ✓" : city.continent}</span>
            </div>
            <div className="rv-card-bottom">
              <h3>{city.city}</h3>
              <p>{city.country} · {city.cost}</p>
              <div className="rv-mini-metrics">
                <div className="rv-mini-metric"><strong>{city.quality}/10</strong><span>quality</span></div>
                <div className="rv-mini-metric"><strong>{city.safety}/10</strong><span>safety</span></div>
                <div className="rv-mini-metric"><strong>{city.internet}M</strong><span>internet</span></div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
