export default function Loading() {
  return (
    <main className="rv-route-loading" aria-live="polite" aria-busy="true">
      <style>{`
        .rv-route-loading{min-height:100svh;background:var(--rv-paper,#f5f4ee);color:var(--rv-ink,#10231f);padding:clamp(5rem,10vw,7rem) 1rem 2rem;font-family:'DM Sans',system-ui,sans-serif}
        .rv-route-loading__shell{width:min(1240px,100%);margin:0 auto;display:grid;gap:.75rem}
        .rv-route-loading__brand{display:flex;align-items:center;gap:.55rem;font-weight:800;margin-bottom:.3rem}
        .rv-route-loading__dot{width:.72rem;height:.72rem;border-radius:50%;background:var(--rv-lime,#c8f36b);box-shadow:0 0 0 5px color-mix(in srgb,var(--rv-lime,#c8f36b) 18%,transparent)}
        .rv-route-loading__hero,.rv-route-loading__bar,.rv-route-loading__card{border:1px solid var(--rv-line,rgba(16,35,31,.12));background:var(--rv-card,#fffdf8);overflow:hidden;position:relative}
        .rv-route-loading__hero{height:clamp(210px,32vw,320px);border-radius:24px}
        .rv-route-loading__bar{height:1rem;border-radius:999px;width:min(560px,72%)}
        .rv-route-loading__bar--small{width:min(360px,48%)}
        .rv-route-loading__metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.55rem}
        .rv-route-loading__card{height:82px;border-radius:15px}
        .rv-route-loading__hero::after,.rv-route-loading__bar::after,.rv-route-loading__card::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 15%,color-mix(in srgb,var(--rv-ink,#10231f) 7%,transparent) 50%,transparent 85%);transform:translateX(-100%);animation:rv-loading-sweep 1.15s ease-in-out infinite}
        .rv-route-loading__label{margin:.2rem 0;color:var(--rv-muted,#66736f);font-size:.82rem}
        @keyframes rv-loading-sweep{to{transform:translateX(100%)}}
        @media(max-width:760px){.rv-route-loading{padding-top:4.6rem}.rv-route-loading__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.rv-route-loading__hero{height:250px}.rv-route-loading__bar{width:82%}.rv-route-loading__bar--small{width:58%}}
        @media(prefers-reduced-motion:reduce){.rv-route-loading__hero::after,.rv-route-loading__bar::after,.rv-route-loading__card::after{animation:none}}
      `}</style>
      <div className="rv-route-loading__shell">
        <div className="rv-route-loading__brand"><span className="rv-route-loading__dot" />Roavio</div>
        <p className="rv-route-loading__label">Loading destination data…</p>
        <div className="rv-route-loading__hero" />
        <div className="rv-route-loading__bar" />
        <div className="rv-route-loading__bar rv-route-loading__bar--small" />
        <div className="rv-route-loading__metrics">
          {Array.from({ length: 6 }, (_, index) => <div className="rv-route-loading__card" key={index} />)}
        </div>
      </div>
    </main>
  );
}
