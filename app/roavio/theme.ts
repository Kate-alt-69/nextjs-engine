import type { EngineTheme, SchemaNode } from "@/engine";
import { copyFor, type RoavioLocale } from "./i18n";

export const roavioTheme: EngineTheme = {
  vars: {
    "--rv-ink": "#10231f",
    "--rv-muted": "#66736f",
    "--rv-paper": "#f5f4ee",
    "--rv-card": "#fffdf8",
    "--rv-card-soft": "#f0f1eb",
    "--rv-line": "rgba(16,35,31,.12)",
    "--rv-green": "#205f4a",
    "--rv-lime": "#c8f36b",
    "--rv-peach": "#ffbb91",
    "--rv-blue": "#9bd8ff",
    "--rv-yellow": "#f8df70",
    "--rv-shadow": "rgba(16,35,31,.10)",
    "--engine-nav-bg": "rgba(245,244,238,.84)",
    "--engine-nav-border": "1px solid rgba(16,35,31,.10)",
    "--engine-nav-color": "#21332e",
    "--engine-nav-active-color": "#10231f",
    "--engine-nav-active-bg": "rgba(32,95,74,.08)",
    "--engine-nav-dropdown-bg": "#fffdf8",
    "--engine-nav-dropdown-border": "rgba(16,35,31,.12)",
    "--engine-nav-height": "4.65rem",
    "--engine-nav-max-width": "1240px",
    "--engine-nav-px": "1rem"
  },
  fonts: ["https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Manrope:wght@500;600;700;800&display=swap"],
  globalStyles: `
    *,*::before,*::after{box-sizing:border-box}
    html{background:var(--rv-paper);scroll-behavior:smooth;color-scheme:light}
    html[data-rv-theme='dark']{color-scheme:dark;--rv-ink:#eef7f2;--rv-muted:#91a49e;--rv-paper:#07110e;--rv-card:#0d1b17;--rv-card-soft:#12241e;--rv-line:rgba(231,255,243,.12);--rv-green:#86d7b1;--rv-lime:#c8f36b;--rv-peach:#f0a97e;--rv-blue:#83c9ee;--rv-yellow:#efd66a;--rv-shadow:rgba(0,0,0,.28);--engine-nav-bg:rgba(7,17,14,.84);--engine-nav-border:1px solid rgba(231,255,243,.10);--engine-nav-color:#c8d8d1;--engine-nav-active-color:#f4fbf7;--engine-nav-active-bg:rgba(200,243,107,.10);--engine-nav-dropdown-bg:#0d1b17;--engine-nav-dropdown-border:rgba(231,255,243,.12);--e-sk-a:#132620;--e-sk-b:#1c332b}
    body{margin:0;background:var(--rv-paper);color:var(--rv-ink);font-family:'DM Sans',system-ui,sans-serif;transition:background .24s ease,color .24s ease}
    h1,h2,h3,h4,h5,h6{font-family:'Manrope','DM Sans',sans-serif;letter-spacing:-.035em}
    .rv-display-serif{font-family:'Instrument Serif',Georgia,serif!important;font-weight:400!important;letter-spacing:-.02em!important}
    .rv-overline{font-size:.7rem;font-weight:800;letter-spacing:.12em;color:var(--rv-green)}
    a{color:inherit}
    button,input,select{font:inherit}
    ::selection{background:rgba(200,243,107,.72);color:#10231f}
    .rv-shell{max-width:1240px;margin:0 auto;padding:0 1rem}
    nav img[src='/roavio-wordmark.svg']{width:118px;height:auto;border-radius:12px;background:#fffdf8;padding:4px 7px;box-shadow:0 1px 0 rgba(16,35,31,.08)}
    .rv-kicker{display:inline-flex;align-items:center;gap:.5rem;padding:.42rem .7rem;border:1px solid var(--rv-line);border-radius:999px;background:color-mix(in srgb,var(--rv-card) 78%,transparent);font-size:.78rem;font-weight:700;letter-spacing:.02em}
    .rv-dot{width:.5rem;height:.5rem;border-radius:99px;background:var(--rv-lime);box-shadow:0 0 0 4px rgba(200,243,107,.24)}
    .rv-panel{background:var(--rv-card);border:1px solid var(--rv-line);border-radius:26px;box-shadow:0 18px 55px var(--rv-shadow)}
    .rv-soft{background:color-mix(in srgb,var(--rv-card) 68%,transparent);border:1px solid var(--rv-line);border-radius:20px}
    .rv-city-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}
    .rv-city-card{position:relative;overflow:hidden;min-height:250px;border-radius:24px;border:1px solid rgba(255,255,255,.24);background:#173d31;color:white;text-decoration:none;isolation:isolate;box-shadow:0 18px 44px rgba(16,35,31,.13);transition:transform .22s ease,box-shadow .22s ease}
    .rv-city-card:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(16,35,31,.18)}
    .rv-city-card::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(7,28,22,.78));z-index:-1}
    .rv-city-card__photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
    .rv-card-top{display:flex;justify-content:space-between;align-items:flex-start;padding:1rem}
    .rv-score{padding:.38rem .58rem;border-radius:999px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.24);backdrop-filter:blur(12px);font-size:.77rem;font-weight:800}
    .rv-card-bottom{position:absolute;left:0;right:0;bottom:0;padding:1.15rem}
    .rv-card-bottom h3{font-size:1.55rem;margin:0 0 .1rem}.rv-card-bottom p{margin:0;color:rgba(255,255,255,.78);font-size:.9rem}
    .rv-mini-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-top:.9rem}.rv-mini-metric{padding:.58rem .6rem;border-radius:13px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px)}.rv-mini-metric strong{display:block;font-size:.92rem}.rv-mini-metric span{font-size:.68rem;color:rgba(255,255,255,.7)}
    .rv-search{display:flex;gap:.55rem;padding:.5rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:18px;box-shadow:0 16px 40px var(--rv-shadow)}
    .rv-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;padding:.75rem .7rem;color:var(--rv-ink)}
    .rv-primary,.rv-secondary{border:0;border-radius:13px;padding:.78rem 1rem;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:.45rem;transition:transform .16s ease,background .16s ease,border-color .16s ease}.rv-primary:active,.rv-secondary:active{transform:translateY(1px)}
    .rv-primary{background:var(--rv-ink);color:var(--rv-paper)}.rv-primary:hover{background:color-mix(in srgb,var(--rv-ink) 88%,var(--rv-green))}.rv-secondary{background:transparent;color:var(--rv-ink);border:1px solid var(--rv-line)}
    .rv-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:.7rem;align-items:center;margin:1rem 0 1.2rem}.rv-input,.rv-select{width:100%;border:1px solid var(--rv-line);background:var(--rv-card);border-radius:14px;padding:.78rem .9rem;color:var(--rv-ink);outline:none}.rv-input:focus,.rv-select:focus{border-color:color-mix(in srgb,var(--rv-green) 60%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--rv-green) 12%,transparent)}
    .rv-filter-pills{display:flex;gap:.45rem;overflow:auto;padding:.1rem 0 .4rem;scrollbar-width:none}.rv-filter-pills::-webkit-scrollbar{display:none}.rv-pill{white-space:nowrap;border:1px solid var(--rv-line);background:var(--rv-card);padding:.58rem .78rem;border-radius:999px;color:var(--rv-ink);cursor:pointer;font-weight:700;font-size:.82rem}.rv-pill[data-active='true']{background:var(--rv-ink);color:var(--rv-paper);border-color:var(--rv-ink)}
    .rv-result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.9rem}.rv-result-card{display:flex;flex-direction:column;gap:.85rem;padding:.55rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:22px;text-decoration:none;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;overflow:hidden}.rv-result-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--rv-green) 42%,transparent);box-shadow:0 18px 44px var(--rv-shadow)}.rv-result-card__body{display:flex;flex-direction:column;gap:.85rem;padding:.4rem .45rem .45rem}
    .rv-result-head{display:flex;justify-content:space-between;gap:1rem}.rv-result-head h3{margin:0;font-size:1.18rem}.rv-result-head p{margin:.15rem 0 0;color:var(--rv-muted);font-size:.84rem}.rv-result-score{font-family:'Manrope';font-weight:800;font-size:1.2rem}
    .rv-result-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem}.rv-result-metrics div{background:var(--rv-card-soft);border-radius:12px;padding:.6rem}.rv-result-metrics strong{display:block;font-size:.9rem}.rv-result-metrics span{font-size:.69rem;color:var(--rv-muted)}.rv-card-actions{display:flex;gap:.45rem}.rv-icon-btn{border:1px solid var(--rv-line);background:var(--rv-card);color:var(--rv-ink);border-radius:11px;padding:.55rem .65rem;cursor:pointer}.rv-icon-btn[data-active='true']{background:var(--rv-lime);color:#10231f}
    .rv-city-thumb{position:relative;overflow:hidden;border-radius:17px;aspect-ratio:16/9;background:linear-gradient(145deg,#173d31,#6c9a79);isolation:isolate}.rv-city-thumb--compact{border-radius:14px}.rv-city-thumb__engine,.rv-city-thumb__engine.e-img-wrap{width:100%!important;height:100%!important;aspect-ratio:16/9}.rv-city-thumb__engine img{width:100%!important;height:100%!important;object-fit:cover!important;transition:filter .35s ease,transform .35s ease,opacity .25s ease!important}.rv-city-thumb__fallback{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:space-between;padding:.8rem;color:white;background:radial-gradient(circle at 78% 22%,rgba(200,243,107,.45),transparent 20%),linear-gradient(135deg,#153d31,#386f5b 56%,#789b72)}.rv-city-thumb__fallback span{font-family:'Instrument Serif',serif;font-size:2.25rem}.rv-city-thumb__fallback small{opacity:.76}.rv-city-thumb--compact .rv-city-thumb__fallback span{font-size:1.45rem}
    @media(hover:hover) and (pointer:fine){.rv-result-card .rv-city-thumb__engine img{filter:blur(5px) saturate(.82);transform:scale(1.035)}.rv-result-card:hover .rv-city-thumb__engine img,.rv-result-card:focus-within .rv-city-thumb__engine img{filter:blur(0) saturate(1);transform:scale(1)}}
    .rv-compare-tray{position:sticky;bottom:1rem;z-index:20;margin-top:1rem;padding:.75rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;background:color-mix(in srgb,var(--rv-ink) 94%,transparent);color:var(--rv-paper);border-radius:18px;box-shadow:0 18px 50px var(--rv-shadow);backdrop-filter:blur(18px)}.rv-compare-chips{display:flex;gap:.4rem;flex-wrap:wrap}.rv-compare-chip{padding:.45rem .65rem;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);font-size:.78rem}
    .rv-compare-stage{position:relative;overflow:hidden;border:1px solid var(--rv-line);border-radius:30px;background:linear-gradient(140deg,color-mix(in srgb,var(--rv-card) 90%,var(--rv-green) 10%),var(--rv-card));box-shadow:0 24px 70px var(--rv-shadow);padding:1rem}.rv-compare-atmosphere{position:absolute;inset:0;pointer-events:none;opacity:.72;mask-image:linear-gradient(to bottom,#000,transparent 96%)}.rv-compare-stage__content{position:relative;z-index:2}.rv-compare-city-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin:.85rem 0}.rv-compare-city-card{background:color-mix(in srgb,var(--rv-card) 88%,transparent);border:1px solid var(--rv-line);border-radius:18px;padding:.55rem;backdrop-filter:blur(14px)}.rv-compare-city-card__meta{display:flex;justify-content:space-between;gap:.5rem;align-items:flex-end;padding:.55rem .2rem .15rem}.rv-compare-city-card__meta strong{font-family:'Manrope';font-size:1rem}.rv-compare-city-card__meta span{font-size:.72rem;color:var(--rv-muted)}
    .rv-compare-grid{display:grid;grid-template-columns:180px repeat(3,minmax(0,1fr));border:1px solid var(--rv-line);border-radius:22px;overflow:hidden;background:color-mix(in srgb,var(--rv-card) 94%,transparent);backdrop-filter:blur(12px)}.rv-compare-grid>div{padding:1rem;border-right:1px solid var(--rv-line);border-bottom:1px solid var(--rv-line)}.rv-compare-grid>div:nth-child(4n){border-right:0}.rv-compare-label{font-weight:800;background:var(--rv-card-soft)}.rv-best{background:color-mix(in srgb,var(--rv-lime) 25%,var(--rv-card))!important}
    .rv-hero-art{position:relative;min-height:430px;border-radius:30px;overflow:hidden;background:linear-gradient(145deg,#163d31,#2f725a);box-shadow:0 30px 80px var(--rv-shadow)}.rv-hero-map{position:absolute;inset:0;opacity:.42;background-image:radial-gradient(circle at 16% 38%,var(--rv-lime) 0 5px,transparent 6px),radial-gradient(circle at 62% 28%,var(--rv-peach) 0 6px,transparent 7px),radial-gradient(circle at 78% 64%,var(--rv-blue) 0 5px,transparent 6px),linear-gradient(110deg,transparent 0 46%,rgba(255,255,255,.08) 46% 47%,transparent 47% 100%)}.rv-floating-card{position:absolute;padding:1rem;background:rgba(255,255,255,.92);color:#10231f;border:1px solid rgba(255,255,255,.4);border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.18);backdrop-filter:blur(18px)}.rv-floating-card strong{font-family:'Manrope';font-size:1.1rem}.rv-floating-card span{display:block;color:#66736f;font-size:.75rem;margin-top:.1rem}.rv-float-a{top:12%;left:8%;transform:rotate(-3deg)}.rv-float-b{top:43%;right:7%;transform:rotate(3deg)}.rv-float-c{bottom:9%;left:21%}
    .rv-detail-hero{display:grid;grid-template-columns:1.15fr .85fr;gap:1rem}.rv-detail-photo{min-height:420px;border-radius:28px;background-size:cover;background-position:center;position:relative;overflow:hidden}.rv-detail-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(9,27,22,.7))}.rv-detail-stack{display:grid;gap:.8rem}.rv-stat-card{padding:1rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:18px}.rv-stat-card span{display:block;color:var(--rv-muted);font-size:.76rem}.rv-stat-card strong{display:block;font-family:'Manrope';font-size:1.25rem;margin-top:.15rem}.rv-dossier{display:grid;grid-template-columns:1fr 320px;gap:1.4rem}.rv-prose{line-height:1.75;color:var(--rv-ink)}.rv-sidecard{position:sticky;top:5.3rem;align-self:start;padding:1rem;background:var(--rv-card);border:1px solid var(--rv-line);border-radius:20px}
    .rv-theme-toggle{position:fixed;left:1rem;bottom:1rem;z-index:65;border:1px solid var(--rv-line);border-radius:999px;padding:.35rem .7rem .35rem .35rem;background:color-mix(in srgb,var(--rv-card) 92%,transparent);color:var(--rv-ink);box-shadow:0 12px 36px var(--rv-shadow);backdrop-filter:blur(16px);display:flex;align-items:center;gap:.35rem;cursor:pointer;font-size:.74rem;font-weight:800}.rv-theme-toggle canvas{display:block}.rv-cookie{position:fixed;right:1rem;bottom:1rem;z-index:70;width:min(390px,calc(100vw - 2rem));padding:1rem;background:color-mix(in srgb,var(--rv-card) 94%,transparent);border:1px solid var(--rv-line);border-radius:22px;box-shadow:0 24px 70px rgba(0,0,0,.2);backdrop-filter:blur(20px);display:grid;grid-template-columns:auto 1fr;gap:.8rem}.rv-cookie__mark{width:2.35rem;height:2.35rem;border-radius:50%;display:grid;place-items:center;background:var(--rv-lime);color:#10231f;font-size:1.25rem}.rv-cookie strong{font-family:'Manrope';font-size:1rem}.rv-cookie p{margin:.35rem 0 0;color:var(--rv-muted);font-size:.8rem;line-height:1.5}.rv-cookie__actions{grid-column:1/-1;display:flex;gap:.55rem}.rv-cookie__actions>*{flex:1}.rv-cookie-modal{position:fixed;inset:0;z-index:90;background:rgba(3,10,8,.52);backdrop-filter:blur(8px);display:grid;place-items:center;padding:1rem}.rv-cookie-custom{width:min(560px,100%);background:var(--rv-card);border:1px solid var(--rv-line);border-radius:26px;padding:1.1rem;box-shadow:0 30px 90px rgba(0,0,0,.32)}.rv-cookie-custom__head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}.rv-cookie-custom__head h2{margin:.25rem 0 1rem;font-size:1.7rem}.rv-cookie-choice{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.9rem 0;border-top:1px solid var(--rv-line)}.rv-cookie-choice span{display:grid;gap:.18rem}.rv-cookie-choice small{color:var(--rv-muted);line-height:1.4}.rv-cookie-choice input{width:1.2rem;height:1.2rem;accent-color:var(--rv-green)}.rv-cookie-save{width:100%;margin-top:.7rem}
    @media(max-width:960px){.rv-city-grid,.rv-result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rv-detail-hero,.rv-dossier{grid-template-columns:1fr}.rv-sidecard{position:static}.rv-compare-grid{grid-template-columns:130px repeat(3,minmax(180px,1fr));overflow:auto}}
    @media(max-width:700px){.rv-city-grid,.rv-result-grid{grid-template-columns:1fr}.rv-toolbar{grid-template-columns:1fr}.rv-search{flex-direction:column}.rv-search .rv-primary{width:100%}.rv-hero-art{min-height:360px}.rv-detail-photo{min-height:330px}.rv-compare-tray{align-items:flex-start;flex-direction:column}.rv-compare-grid{font-size:.85rem}.rv-compare-city-strip{grid-template-columns:1fr}.rv-cookie{right:0;left:0;bottom:0;width:100%;border-radius:24px 24px 0 0;border-left:0;border-right:0;border-bottom:0;padding:1rem max(1rem,env(safe-area-inset-right)) calc(1rem + env(safe-area-inset-bottom)) max(1rem,env(safe-area-inset-left))}.rv-theme-toggle--consent{bottom:12.5rem}.rv-cookie__actions{flex-direction:column}.rv-cookie-modal{align-items:end;padding:0}.rv-cookie-custom{border-radius:24px 24px 0 0;padding-bottom:calc(1rem + env(safe-area-inset-bottom))}.rv-city-thumb__engine img{filter:none!important;transform:none!important}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
  `
};

export function createRoavioNav(locale: RoavioLocale): SchemaNode {
  const copy = copyFor(locale).nav;
  return {
    type: "nav",
    key: "roavio-nav",
    props: {
      sticky: true,
      mobileBreakpoint: 820,
      logo: { src: "/roavio-wordmark.svg", alt: "Roavio", href: "/", width: 118, height: 31 },
      items: [
        { label: copy.explore, href: "/cities", cprop: { link: { transition: "fade" } } },
        { label: copy.match, href: "/match", cprop: { link: { transition: "fade" } } },
        { label: copy.compare, href: "/compare", cprop: { link: { transition: "fade" } } },
        { label: copy.favorites, href: "/favoritos", cprop: { link: { transition: "fade" } } },
        {
          label: copy.language,
          children: [
            { label: "Español", href: "/lang/es" },
            { label: "English", href: "/lang/en" },
          ],
        },
      ],
    },
  };
}

export function createFooterNode(locale: RoavioLocale): SchemaNode {
  return {
    type: "section",
    props: { contentMaxWidth: "1240px", px: "1rem", py: "2.2rem", borderTop: "1px solid var(--rv-line)" },
    children: [
      { type: "stack", props: { direction: { xs: "vertical", md: "horizontal" }, justify: "space-between", gap: "1rem" }, children: [
        { type: "text", props: { content: locale === "es" ? "roavio · decide dónde vivir y trabajar mejor" : "roavio · decide where to live and work better", weight: 700 } },
        { type: "text", props: { content: copyFor(locale).footer, color: "var(--rv-muted)", size: ".82rem" } },
      ] },
    ],
  };
}

// Spanish defaults keep existing proposal helpers source-compatible while pages migrate to cookie-aware factories.
export const roavioNav = createRoavioNav("es");
export const footerNode = createFooterNode("es");
