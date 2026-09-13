"use client";

import { EngineReveal } from "@/engine";
import { cityTransitionSurfaceId } from "./cityTransition";
import { OfficialCityImage } from "./OfficialCityImage";

export function CityDossierBackdrop({ slug }: { slug: string }) {
  return (
    <div
      id={cityTransitionSurfaceId(slug)}
      className="rv-dossier-backdrop rv-dossier-backdrop--fallback"
      data-roavio-city-image
      aria-hidden="true"
    >
      <EngineReveal
        className="rv-dossier-backdrop__reveal"
        priority
        effect="fade"
        replay={false}
        duration={520}
        delay={40}
        releaseWhenFar={false}
      >
        <OfficialCityImage
          slug={slug}
          priority
          className="rv-dossier-backdrop__full"
          sizes="100vw"
          style={{ position: "absolute", inset: 0 }}
        />
        <span className="rv-dossier-backdrop__veil" />
      </EngineReveal>
    </div>
  );
}
