"use client";

import { useEffect, useMemo, useState } from "react";
import { ROAVIO_MEDIA_VERSION } from "./mediaVersion";

function bundledPhoto(slug: string, slot: 0 | 1): string {
  return `/city-media/${encodeURIComponent(slug)}-${slot}.jpg?v=${ROAVIO_MEDIA_VERSION}`;
}

export function CityDossierBackdrop({ slug }: { slug: string }) {
  const [slot, setSlot] = useState<0 | 1>(1);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const source = useMemo(() => bundledPhoto(slug, slot), [slug, slot]);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setSlot(1);
  }, [slug]);

  useEffect(() => {
    setLoaded(false);
  }, [slot]);

  if (failed) return <div className="rv-dossier-backdrop rv-dossier-backdrop--fallback" aria-hidden="true" />;

  return (
    <div className="rv-dossier-backdrop rv-dossier-backdrop--progressive" data-loaded={loaded ? "true" : "false"} aria-hidden="true">
      <span className="rv-dossier-backdrop__loader" />
      <img
        className="rv-dossier-backdrop__full"
        src={source}
        alt=""
        draggable={false}
        decoding="async"
        fetchPriority="low"
        onLoad={() => setLoaded(true)}
        onDragStart={(event) => event.preventDefault()}
        onError={() => {
          if (slot === 1) setSlot(0);
          else setFailed(true);
        }}
      />
      <span className="rv-dossier-backdrop__veil" />

      <style jsx>{`
        .rv-dossier-backdrop--progressive {
          isolation: isolate;
        }

        .rv-dossier-backdrop__loader,
        .rv-dossier-backdrop__full {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          user-select: none;
        }

        .rv-dossier-backdrop__loader {
          z-index: 1;
          inset: -8%;
          width: 116%;
          height: 116%;
          background:
            radial-gradient(circle at 18% 32%, rgba(200, 243, 107, .14), transparent 28%),
            radial-gradient(circle at 78% 66%, rgba(134, 215, 177, .12), transparent 34%),
            linear-gradient(110deg,
              rgba(255,255,255,.015) 0%,
              rgba(255,255,255,.015) 34%,
              rgba(255,255,255,.11) 48%,
              rgba(255,255,255,.015) 62%,
              rgba(255,255,255,.015) 100%);
          background-size: 100% 100%, 100% 100%, 240% 100%;
          animation: rv-backdrop-loading 1.65s ease-in-out infinite;
          opacity: ${loaded ? "0" : "1"};
          transition: opacity .46s ease;
        }

        .rv-dossier-backdrop__full {
          z-index: 2;
          object-fit: cover;
          opacity: ${loaded ? "1" : "0"};
          transform: scale(${loaded ? "1" : "1.018"});
          transition:
            opacity .68s cubic-bezier(.2,.72,.2,1),
            transform .9s cubic-bezier(.2,.72,.2,1);
        }

        .rv-dossier-backdrop[data-loaded='true'] .rv-dossier-backdrop__loader {
          animation-play-state: paused;
        }

        .rv-dossier-backdrop__veil {
          z-index: 3;
        }

        @keyframes rv-backdrop-loading {
          0% { background-position: 0 0, 0 0, 115% 0; }
          50% { background-position: 0 0, 0 0, 35% 0; }
          100% { background-position: 0 0, 0 0, -45% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .rv-dossier-backdrop__loader { animation: none; }
          .rv-dossier-backdrop__full { transition: opacity .12s linear; }
        }
      `}</style>
    </div>
  );
}
