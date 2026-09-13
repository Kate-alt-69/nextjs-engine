import { EngineReveal, EngineTransitionLink } from "@/engine";
import { catalogFitScore, type CityCatalogEntry } from "./catalog";
import type { RoavioLocale } from "./i18n";
import { OfficialCityImage } from "./OfficialCityImage";

const FEATURED = ["valencia", "lisboa", "bali", "bangkok", "dubai", "chiang-mai"];
const gradients = [
  "linear-gradient(145deg,#244b3f,#789f75)",
  "linear-gradient(145deg,#764637,#d8956d)",
  "linear-gradient(145deg,#21444d,#8ec7bc)",
  "linear-gradient(145deg,#4f2740,#ce6b55)",
  "linear-gradient(145deg,#473a61,#d5a35f)",
  "linear-gradient(145deg,#345f55,#c7c16c)",
];

export function CityShowcase({ catalog, locale }: { catalog: CityCatalogEntry[]; locale: RoavioLocale }) {
  const featured = FEATURED.map((slug) => catalog.find((city) => city.slug === slug)).filter((city): city is CityCatalogEntry => Boolean(city));
  const es = locale === "es";

  return (
    <div className="rv-city-grid">
      {featured.map((city, index) => {
        const score = catalogFitScore(city);
        return (
          <EngineReveal
            key={city.slug}
            className="rv-city-card-reveal"
            priority={index < 2}
            effect="pop"
            replay
            renderMargin={1600}
            motionMargin={150}
            duration={340}
            delay={Math.min(index % 3, 2) * 18}
            scaleFrom={0.82}
            overshoot={1.022}
            releaseWhenFar
          >
            <EngineTransitionLink className="rv-city-card" href={`/cities/${city.slug}`} transition="portal" style={{ background: gradients[index % gradients.length] }}>
              <OfficialCityImage
                slug={city.slug}
                className="rv-city-card__photo"
                priority={index < 2}
                sizes="(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 390px"
                style={{ position: "absolute", inset: 0 }}
              />
              <div className="rv-card-top">
                <span className="rv-score">Roavio fit {score === null ? "—" : score.toFixed(1)}</span>
                <span className="rv-score">{city.beach ? (es ? "Playa ✓" : "Beach ✓") : city.continent}</span>
              </div>
              <div className="rv-card-bottom">
                <h3>{city.city}</h3>
                <p>{city.country} · {city.cost ?? "—"}</p>
                <div className="rv-mini-metrics">
                  <div className="rv-mini-metric"><strong>{city.quality === null ? "—" : `${city.quality}/10`}</strong><span>{es ? "calidad" : "quality"}</span></div>
                  <div className="rv-mini-metric"><strong>{city.safety === null ? "—" : `${city.safety}/10`}</strong><span>{es ? "seguridad" : "safety"}</span></div>
                  <div className="rv-mini-metric"><strong>{city.internet === null ? "—" : `${city.internet}M`}</strong><span>internet</span></div>
                </div>
              </div>
            </EngineTransitionLink>
          </EngineReveal>
        );
      })}
    </div>
  );
}
