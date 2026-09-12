from pathlib import Path


def replace(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# 1) Explore page: remove the oversized marketing intro and let the search surface lead.
Path("app/cities/page.tsx").write_text('''import { createPage, defineSchema } from "@/engine";
import { Explorer } from "../roavio/ClientWidgets";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { copyFor, type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createCitiesSchema(locale: RoavioLocale) {
  const copy = copyFor(locale).cities;
  return defineSchema({
    meta: { title: locale === "es" ? "Explora ciudades nómadas · Roavio" : "Explore nomad cities · Roavio", description: copy.subtitle },
    theme: roavioTheme,
    root: { type: "box", props: { bg: "var(--rv-paper)", minH: "100svh" }, children: [
      createRoavioNav(locale),
      { type: "section", props: { className: "rv-explore-directory-section", contentMaxWidth: "1240px", px: "1rem", py: { xs: "1.4rem", md: "2rem" } }, children: [
        { type: "slot", props: { name: "explorer" } },
      ] },
      createFooterNode(locale),
    ] },
  });
}

export default async function CitiesPage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({ schema: createCitiesSchema(locale), slots: { explorer: <Explorer catalog={catalog} locale={locale} /> }, compiler: { pageId: "roavio-cities", serverFirst: true } });
  return <Page />;
}
''', encoding="utf-8")

# 2) Directory pagination: only keep the bottom pager.
p = Path("app/roavio/ClientWidgets.tsx")
text = p.read_text(encoding="utf-8")
text = text.replace('  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index);\n', '')
start = '''        {pageCount > 1 ? (\n          <div className="rv-cities-folder__tabs" role="navigation" aria-label={locale === "es" ? "Páginas de destinos" : "Destination pages"}>\n            {pageNumbers.map((pageIndex) => (\n              <button key={pageIndex} type="button" className="rv-cities-page-tab" data-active={pageIndex === safePage} aria-current={pageIndex === safePage ? "page" : undefined} onClick={() => goToPage(pageIndex)}>\n                <span>{locale === "es" ? "Pág." : "Page"}</span> {pageIndex + 1}\n              </button>\n            ))}\n          </div>\n        ) : null}\n'''
if start not in text:
    raise SystemExit("top pagination block not found")
text = text.replace(start, '', 1)
p.write_text(text, encoding="utf-8")

# 3) Image quality policy and stale cache busting.
replace(
    "next.config.js",
    '\timages: {\n\t\tformats: ["image/avif", "image/webp"],\n\t\tminimumCacheTTL: 60 * 60 * 24 * 30,',
    '\timages: {\n\t\tformats: ["image/avif", "image/webp"],\n\t\tqualities: [58, 72, 75],\n\t\tminimumCacheTTL: 60 * 60 * 24 * 30,'
)
replace("app/roavio/CityThumb.tsx", 'const CITY_PHOTO_VERSION = "6";', 'const CITY_PHOTO_VERSION = "8";')
replace(
    "app/roavio/CityThumb.tsx",
    '''function lowResSource(source: string, city: string, country: string, slot: number): string {\n  if (source.includes("images.unsplash.com")) {''',
    '''function lowResSource(source: string, city: string, country: string, slot: number): string | null {\n  if (source.includes("images.unsplash.com")) {'''
)
replace(
    "app/roavio/CityThumb.tsx",
    '''  return cityProxySource(city, country, slot, 64);\n}''',
    '''  // Do not resolve Wikipedia twice (64px preview + final responsive image).\n  // The card's deterministic gradient/shimmer is the placeholder for proxy-backed\n  // cities, so the real city-photo request gets all of the network/API budget.\n  return null;\n}'''
)
replace(
    "app/roavio/CityThumb.tsx",
    '          blurDataURL={preview}\n',
    '          blurDataURL={preview ?? undefined}\n'
)

# 4) Remove the expensive persistent blur-on-hover behavior. Images blur only while loading.
p = Path("app/roavio/theme.ts")
text = p.read_text(encoding="utf-8")
old_hover = "    @media(hover:hover) and (pointer:fine){.rv-result-card .rv-city-thumb__engine img{filter:blur(5px) saturate(.82);transform:scale(1.035)}.rv-result-card:hover .rv-city-thumb__engine img,.rv-result-card:focus-within .rv-city-thumb__engine img{filter:blur(0) saturate(1);transform:scale(1)}}"
new_hover = "    @media(hover:hover) and (pointer:fine){.rv-result-card .rv-city-thumb__engine img{transform:scale(1);will-change:transform}.rv-result-card:hover .rv-city-thumb__engine img,.rv-result-card:focus-within .rv-city-thumb__engine img{transform:scale(1.035)}}"
if old_hover not in text:
    raise SystemExit("result-card hover block not found")
text = text.replace(old_hover, new_hover, 1)
old_toolbar = ".rv-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:.7rem;align-items:center;margin:1rem 0 1.2rem}"
new_toolbar = ".rv-toolbar{display:grid;grid-template-columns:minmax(280px,1fr) auto auto;gap:.7rem;align-items:center;width:min(980px,100%);margin:clamp(3rem,9vh,6rem) auto 1.2rem}"
if old_toolbar not in text:
    raise SystemExit("toolbar block not found")
text = text.replace(old_toolbar, new_toolbar, 1)
p.write_text(text, encoding="utf-8")

# 5) City dossier: full-body photo wallpaper + restore one crisp primary hero photo.
p = Path("app/roavio/CityDossier.tsx")
text = p.read_text(encoding="utf-8")
text = text.replace('import { createFooterNode, createRoavioNav, roavioTheme } from "./theme";\n', 'import { createFooterNode, createRoavioNav, roavioTheme } from "./theme";\nimport { CityThumb } from "./CityThumb";\n', 1)
text = text.replace('const cityBackdrop = `/api/city-photo?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&slot=0&width=480&height=270&v=7`;', 'const cityBackdrop = `/api/city-photo?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&slot=0&width=960&height=540&v=8`;')
old_root = 'props: { className: "rv-dossier-page", bg: "var(--rv-paper)", color: "var(--rv-ink)", minH: "100svh" },'
new_root = '''props: {\n        className: "rv-dossier-page",\n        color: "var(--rv-ink)",\n        minH: "100svh",\n        style: {\n          backgroundImage: `linear-gradient(rgba(7,17,14,.70), rgba(7,17,14,.82)), url("${cityBackdrop}")`,\n          backgroundSize: "cover",\n          backgroundPosition: "center",\n          backgroundRepeat: "no-repeat",\n          backgroundAttachment: "fixed",\n        },\n      },'''
if old_root not in text:
    raise SystemExit("dossier root props not found")
text = text.replace(old_root, new_root, 1)
old_intro_style = '''            py: { xs: "1.2rem", md: "1.8rem" },\n            style: {\n              backgroundImage: `linear-gradient(90deg, rgba(7,17,14,.78), rgba(7,17,14,.48)), url("${cityBackdrop}")`,\n              backgroundSize: "cover",\n              backgroundPosition: "center",\n              backgroundRepeat: "no-repeat",\n            },'''
new_intro_style = '''            py: { xs: "1.2rem", md: "1.8rem" },'''
if old_intro_style not in text:
    raise SystemExit("dossier intro background block not found")
text = text.replace(old_intro_style, new_intro_style, 1)
old_hero_children = '''                {\n                  type: "box",\n                  props: { className: "rv-dossier-hero__copy" },\n                  children: [\n                    { type: "text", props: { content: `${city.country} · ${continentLabel(city.continent, locale)}`, variant: "overline", color: "var(--rv-lime)", weight: 800 } },\n                    { type: "heading", props: { level: 1, content: city.name, size: { xs: "2.65rem", md: "4rem" }, color: "#fff", lineHeight: .96, style: { margin: ".3rem 0 .55rem" } } },\n                    ...(city.summary ? [{ type: "text", props: { content: city.summary, size: ".92rem", lineHeight: 1.6, maxW: "650px", color: "rgba(255,255,255,.92)" } } as SchemaNode] : []),\n                  ],\n                },'''
new_hero_children = old_hero_children + '''\n                { type: "slot", props: { name: "heroImage" } },'''
if old_hero_children not in text:
    raise SystemExit("hero copy block not found")
text = text.replace(old_hero_children, new_hero_children, 1)
old_return = '''  return createComponent({\n    schema,\n    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },\n  });'''
new_return = '''  return createComponent({\n    schema,\n    slots: {\n      heroImage: (\n        <div className="rv-dossier-hero__image">\n          <CityThumb slug={city.slug} city={city.name} country={city.country} eager />\n        </div>\n      ),\n    },\n    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },\n  });'''
if old_return not in text:
    raise SystemExit("createComponent return block not found")
text = text.replace(old_return, new_return, 1)
p.write_text(text, encoding="utf-8")

# 6) City dossier composition CSS: wallpaper is owned by the page; hero gets crisp media.
Path("app/roavio/city-hero.css").write_text('''/* City dossier: the page body owns the soft photographic wallpaper. */
.rv-dossier-page{
  background-color:#07110e;
  background-size:cover!important;
  background-position:center!important;
  background-repeat:no-repeat!important;
}
.rv-dossier-intro{
  position:relative;
  background:transparent!important;
  border-bottom:1px solid rgba(231,255,243,.10);
}
.rv-dossier-intro>div{position:relative}
.rv-dossier-hero{
  display:grid!important;
  grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr)!important;
  gap:1rem!important;
  align-items:stretch!important;
  background:rgba(6,24,19,.82)!important;
  border-color:rgba(232,255,244,.16)!important;
  box-shadow:0 18px 54px rgba(0,0,0,.24)!important;
  overflow:hidden!important;
}
.rv-dossier-hero__copy{align-self:center;position:relative;z-index:2}
.rv-dossier-hero__image{min-width:0;align-self:stretch}
.rv-dossier-hero__image .rv-city-thumb{height:100%;min-height:230px;aspect-ratio:auto;border-radius:18px}
.rv-dossier-hero__image .e-img-wrap{height:100%!important;aspect-ratio:auto!important}
.rv-dossier-intro .rv-dossier-metric{
  background:rgba(8,29,23,.90)!important;
  border-color:rgba(232,255,244,.14)!important;
  color:#f3faf6!important;
}
.rv-dossier-intro .rv-dossier-metric>*{color:inherit!important}
.rv-dossier-intro .rv-dossier-metric>*:first-child{color:rgba(237,249,243,.72)!important}
.rv-dossier-page .rv-dossier-section,
.rv-dossier-page .rv-dossier-insight,
.rv-dossier-page .rv-dossier-summary{
  background:color-mix(in srgb,var(--rv-card) 92%,transparent)!important;
  backdrop-filter:none!important;
}

@media(max-width:700px){
  .rv-dossier-page{background-attachment:scroll!important;background-size:auto 100svh!important}
  .rv-dossier-hero{grid-template-columns:1fr!important}
  .rv-dossier-hero__image{order:-1}
  .rv-dossier-hero__image .rv-city-thumb{min-height:190px;border-radius:16px}
}
''', encoding="utf-8")

print("Roavio UX/image hotfix applied")
