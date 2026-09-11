import type { EngineTheme, SchemaNode } from "@/engine";

export const roavioTheme: EngineTheme = {
  vars: {
    "--rv-ink": "#10231f",
    "--rv-muted": "#66736f",
    "--rv-paper": "#f5f4ee",
    "--rv-card": "#fffdf8",
    "--rv-line": "rgba(16,35,31,.12)",
    "--rv-green": "#205f4a",
    "--rv-lime": "#c8f36b",
    "--rv-peach": "#ffbb91",
    "--rv-blue": "#9bd8ff",
    "--rv-yellow": "#f8df70",
    "--engine-nav-bg": "rgba(245,244,238,.84)",
    "--engine-nav-border": "1px solid rgba(16,35,31,.10)",
    "--engine-nav-color": "#21332e",
    "--engine-nav-active-color": "#10231f",
    "--engine-nav-active-bg": "rgba(32,95,74,.08)",
    "--engine-nav-dropdown-bg": "#fffdf8",
    "--engine-nav-dropdown-border": "rgba(16,35,31,.12)",
    "--engine-nav-height": "4.4rem",
    "--engine-nav-max-width": "1240px",
    "--engine-nav-px": "1rem"
  },
  fonts: ["https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"],
  globalStyles: `
    *,*::before,*::after{box-sizing:border-box}
    html{background:var(--rv-paper);scroll-behavior:smooth}
    body{margin:0;background:var(--rv-paper);color:var(--rv-ink);font-family:'DM Sans',system-ui,sans-serif}
    h1,h2,h3,h4,h5,h6{font-family:'Manrope','DM Sans',sans-serif;letter-spacing:-.035em}
    a{color:inherit}
    button,input,select{font:inherit}
    ::selection{background:var(--rv-lime);color:var(--rv-ink)}
    .rv-shell{max-width:1240px;margin:0 auto;padding:0 1rem}
    .rv-kicker{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .65rem;border:1px solid var(--rv-line);border-radius:999px;background:rgba(255,253,248,.72);font-size:.78rem;font-weight:700;letter-spacing:.02em}
    .rv-dot{width:.5rem;height:.5rem;border-radius:99px;background:var(--rv-lime);box-shadow:0 0 0 4px rgba(200,243,107,.24)}
    .rv-panel{background:var(--rv-card);border:1px solid var(--rv-line);border-radius:26px;box-shadow:0 18px 55px rgba(16,35,31,.07)}
    .rv-soft{background:rgba(255,253,248,.55);border:1px solid var(--rv-line);border-radius:20px}
    .rv-city-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}
    .rv-city-card{position:relative;overflow:hidden;min-height:250px;border-radius:24px;border:1px solid rgba(255,255,255,.24);background:#173d31;color:white;text-decoration:none;isolation:isolate;box-shadow:0 18px 44px rgba(16,35,31,.13);transition:transform .22s ease,box-shadow .22s ease}
    .rv-city-card:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(16,35,31,.18)}
    .rv-city-card::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(7,28,22,.78));z-index:-1}
    .rv-city-card__photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
    .rv-card-top{display:flex;justify-content:space-between;align-items:flex-start;padding:1rem}
    .rv-score{padding:.38rem .58rem;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);backdrop-filter:blur(12px);font-size:.77rem;font-weight:800}
    .rv-card-bottom{position:absolute;left:0;right:0;bottom:0;padding:1.15rem}
    .rv-card-bottom h3{font-size:1.55rem;margin:0 0 .1rem}
    .rv-card-bottom p{margin:0;color:rgba(255,255,255,.78);font-size:.9rem}
    .rv-mini-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-top:.9rem}
    .rv-mini-metric{padding:.58rem .6rem;border-radius:13px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px)}
    .rv-mini-metric strong{display:block;font-size:.92rem}.rv-mini-metric span{font-size:.68rem;color:rgba(255,255,255,.7)}
    .rv-search{display:flex;gap:.55rem;padding:.5rem;background:white;border:1px solid var(--rv-line);border-radius:18px;box-shadow:0 16px 40px rgba(16,35,31,.08)}
    .rv-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;padding:.75rem .7rem;color:var(--rv-ink)}
    .rv-primary,.rv-secondary{border:0;border-radius:13px;padding:.78rem 1rem;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:.45rem}
    .rv-primary{background:var(--rv-ink);color:white}.rv-primary:hover{background:#1a3b33}
    .rv-secondary{background:transparent;color:var(--rv-ink);border:1px solid var(--rv-line)}
    .rv-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:.7rem;align-items:center;margin:1rem 0 1.2rem}
    .rv-input,.rv-select{width:100%;border:1px solid var(--rv-line);background:var(--rv-card);border-radius:14px;padding:.78rem .9rem;color:var(--rv-ink);outline:none}
    .rv-input:focus,.rv-select:focus{border-color:rgba(32,95,74,.48);box-shadow:0 0 0 3px rgba(32,95,74,.08)}
    .rv-filter-pills{display:flex;gap:.45rem;overflow:auto;padding:.1rem 0 .4rem;scrollbar-width:none}.rv-filter-pills::-webkit-scrollbar{display:none}
    .rv-pill{white-space:nowrap;border:1px solid var(--rv-line);background:var(--rv-card);padding:.58rem .78rem;border-radius:999px;color:var(--rv-ink);cursor:pointer;font-weight:700;font-size:.82rem}.rv-pill[data-active='true']{background:var(--rv-ink);color:white;border-color:var(--rv-ink)}
    .rv-result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9rem}
    .rv-result-card{display:flex;flex-direction:column;gap:.95rem;padding:1rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:20px;text-decoration:none;transition:transform .18s ease,border-color .18s ease}.rv-result-card:hover{transform:translateY(-2px);border-color:rgba(32,95,74,.35)}
    .rv-result-head{display:flex;justify-content:space-between;gap:1rem}.rv-result-head h3{margin:0;font-size:1.18rem}.rv-result-head p{margin:.15rem 0 0;color:var(--rv-muted);font-size:.84rem}
    .rv-result-score{font-family:'Manrope';font-weight:800;font-size:1.2rem}
    .rv-result-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.rv-result-metrics div{background:#f2f3ed;border-radius:12px;padding:.6rem}.rv-result-metrics strong{display:block;font-size:.9rem}.rv-result-metrics span{font-size:.69rem;color:var(--rv-muted)}
    .rv-card-actions{display:flex;gap:.45rem}.rv-icon-btn{border:1px solid var(--rv-line);background:white;border-radius:11px;padding:.55rem .65rem;cursor:pointer}.rv-icon-btn[data-active='true']{background:var(--rv-lime)}
    .rv-compare-tray{position:sticky;bottom:1rem;z-index:20;margin-top:1rem;padding:.75rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;background:rgba(16,35,31,.94);color:white;border-radius:18px;box-shadow:0 18px 50px rgba(16,35,31,.24);backdrop-filter:blur(18px)}
    .rv-compare-chips{display:flex;gap:.4rem;flex-wrap:wrap}.rv-compare-chip{padding:.45rem .65rem;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);font-size:.78rem}
    .rv-compare-grid{display:grid;grid-template-columns:180px repeat(3,minmax(0,1fr));border:1px solid var(--rv-line);border-radius:22px;overflow:hidden;background:var(--rv-card)}
    .rv-compare-grid>div{padding:1rem;border-right:1px solid var(--rv-line);border-bottom:1px solid var(--rv-line)}
    .rv-compare-grid>div:nth-child(4n){border-right:0}.rv-compare-label{font-weight:800;background:#f0f1eb}.rv-best{background:rgba(200,243,107,.27)!important}
    .rv-hero-art{position:relative;min-height:430px;border-radius:30px;overflow:hidden;background:linear-gradient(145deg,#163d31,#2f725a);box-shadow:0 30px 80px rgba(16,35,31,.18)}
    .rv-hero-map{position:absolute;inset:0;opacity:.42;background-image:radial-gradient(circle at 16% 38%,var(--rv-lime) 0 5px,transparent 6px),radial-gradient(circle at 62% 28%,var(--rv-peach) 0 6px,transparent 7px),radial-gradient(circle at 78% 64%,var(--rv-blue) 0 5px,transparent 6px),linear-gradient(110deg,transparent 0 46%,rgba(255,255,255,.08) 46% 47%,transparent 47% 100%);background-size:auto}
    .rv-floating-card{position:absolute;padding:1rem;background:rgba(255,255,255,.92);color:var(--rv-ink);border:1px solid rgba(255,255,255,.4);border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.18);backdrop-filter:blur(18px)}
    .rv-floating-card strong{font-family:'Manrope';font-size:1.1rem}.rv-floating-card span{display:block;color:var(--rv-muted);font-size:.75rem;margin-top:.1rem}
    .rv-float-a{top:12%;left:8%;transform:rotate(-3deg)}.rv-float-b{top:43%;right:7%;transform:rotate(3deg)}.rv-float-c{bottom:9%;left:21%}
    .rv-detail-hero{display:grid;grid-template-columns:1.15fr .85fr;gap:1rem}.rv-detail-photo{min-height:420px;border-radius:28px;background-size:cover;background-position:center;position:relative;overflow:hidden}.rv-detail-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(9,27,22,.7))}
    .rv-detail-stack{display:grid;gap:.8rem}.rv-stat-card{padding:1rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:18px}.rv-stat-card span{display:block;color:var(--rv-muted);font-size:.76rem}.rv-stat-card strong{display:block;font-family:'Manrope';font-size:1.25rem;margin-top:.15rem}
    .rv-dossier{display:grid;grid-template-columns:1fr 320px;gap:1.4rem}.rv-prose{line-height:1.75;color:#33443f}.rv-sidecard{position:sticky;top:5.3rem;align-self:start;padding:1rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:20px}
    @media(max-width:960px){.rv-city-grid,.rv-result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rv-detail-hero,.rv-dossier{grid-template-columns:1fr}.rv-sidecard{position:static}.rv-compare-grid{grid-template-columns:130px repeat(3,minmax(180px,1fr));overflow:auto}}
    @media(max-width:700px){.rv-city-grid,.rv-result-grid{grid-template-columns:1fr}.rv-toolbar{grid-template-columns:1fr}.rv-search{flex-direction:column}.rv-search .rv-primary{width:100%}.rv-hero-art{min-height:360px}.rv-detail-photo{min-height:330px}.rv-compare-tray{align-items:flex-start;flex-direction:column}.rv-compare-grid{font-size:.85rem}}
  `
};

export const roavioNav: SchemaNode = {
  type: "nav",
  key: "roavio-nav",
  props: {
    sticky: true,
    mobileBreakpoint: 820,
    logo: { alt: "roavio", href: "/" },
    items: [
      { label: "Explorar", href: "/cities", cprop: { link: { transition: "fade" } } },
      { label: "Comparar", href: "/compare", cprop: { link: { transition: "fade" } } },
      { label: "Favoritos", href: "/favoritos", cprop: { link: { transition: "fade" } } },
      { label: "ES · EN", href: "#language" }
    ]
  }
};

export const footerNode: SchemaNode = {
  type: "section",
  props: { contentMaxWidth: "1240px", px: "1rem", py: "2.2rem", borderTop: "1px solid var(--rv-line)" },
  children: [
    { type: "stack", props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", gap: "1rem" }, children: [
      { type: "text", props: { content: "roavio · decide dónde vivir y trabajar mejor", weight: 700 } },
      { type: "text", props: { content: "Datos: Numbeo · Ookla · fuentes oficiales · actualizado 2026", color: "var(--rv-muted)", size: ".82rem" } }
    ] }
  ]
};
