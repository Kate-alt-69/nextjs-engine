from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

# Homepage: only load the six city metadata entries actually rendered.
path = 'app/page.tsx'
text = read(path)
text = replace_once(text,
    'import { loadCityCatalog } from "./roavio/cityContent.server";',
    'import { loadCityCatalogForSlugs } from "./roavio/cityContent.server";',
    'home catalog import')
needle = 'import { createFooterNode, createRoavioNav, roavioTheme } from "./roavio/theme";\n'
text = replace_once(text, needle, needle + '\nconst HOME_FEATURED_SLUGS = ["valencia", "lisboa", "bali", "bangkok", "dubai", "chiang-mai"] as const;\n', 'home slugs')
text = replace_once(text,
    'const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);',
    'const [catalog, locale] = await Promise.all([loadCityCatalogForSlugs(HOME_FEATURED_SLUGS), getRoavioLocale()]);',
    'home loader')
write(path, text)

# Homepage curated imagery: responsive source widths instead of fixed 960px downloads.
path = 'app/roavio/CityShowcase.tsx'
text = read(path)
needle = '''const gradients = [
  "linear-gradient(145deg,#244b3f,#789f75)",
  "linear-gradient(145deg,#764637,#d8956d)",
  "linear-gradient(145deg,#21444d,#8ec7bc)",
  "linear-gradient(145deg,#4f2740,#ce6b55)",
  "linear-gradient(145deg,#473a61,#d5a35f)",
  "linear-gradient(145deg,#345f55,#c7c16c)",
];
'''
insert = needle + '''
function cityImageAt(src: string, width: number, quality = 72): string {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}
'''
text = replace_once(text, needle, insert, 'showcase image helper')
old = '''{image ? <img className="rv-city-card__photo" src={image} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" draggable={false} /> : null}'''
new = '''{image ? (
              <img
                className="rv-city-card__photo"
                src={cityImageAt(image, 720, 72)}
                srcSet={`${cityImageAt(image, 384, 64)} 384w, ${cityImageAt(image, 640, 70)} 640w, ${cityImageAt(image, 828, 72)} 828w`}
                sizes="(max-width: 700px) calc(100vw - 2rem), (max-width: 1100px) calc(50vw - 2rem), 390px"
                alt=""
                loading={index < 2 ? "eager" : "lazy"}
                fetchPriority={index < 2 ? "high" : "low"}
                decoding="async"
                draggable={false}
              />
            ) : null}'''
text = replace_once(text, old, new, 'showcase responsive img')
write(path, text)

# Compare: remove the highlighted verbose intro and lead directly into the tool.
write('app/compare/page.tsx', '''import { createPage, defineSchema } from "@/engine";
import { CompareBoard } from "../roavio/ClientWidgets";
import { loadCityCatalog } from "../roavio/cityContent.server";
import { type RoavioLocale } from "../roavio/i18n";
import { getRoavioLocale } from "../roavio/locale.server";
import { createFooterNode, createRoavioNav, roavioTheme } from "../roavio/theme";

function createCompareSchema(locale: RoavioLocale) {
  return defineSchema({
    meta: {
      title: locale === "es" ? "Comparar ciudades · Roavio" : "Compare cities · Roavio",
      description: locale === "es" ? "Compara hasta tres destinos de Roavio." : "Compare up to three Roavio destinations.",
    },
    theme: roavioTheme,
    root: {
      type: "box",
      props: { bg: "var(--rv-paper)", minH: "100svh" },
      children: [
        createRoavioNav(locale),
        {
          type: "section",
          props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1rem", md: "1.35rem" } },
          children: [{ type: "slot", props: { name: "compare-board" } }],
        },
        createFooterNode(locale),
      ],
    },
  });
}

export default async function ComparePage() {
  const [catalog, locale] = await Promise.all([loadCityCatalog(), getRoavioLocale()]);
  const Page = createPage({
    schema: createCompareSchema(locale),
    slots: { "compare-board": <CompareBoard catalog={catalog} locale={locale} /> },
    compiler: { pageId: "roavio-compare", serverFirst: true },
  });
  return <Page />;
}
''')

# City dossier: put one photo on the OUTER intro section background and remove duplicate image slot.
path = 'app/roavio/CityDossier.tsx'
text = read(path)
text = replace_once(text, 'import { CityDossierMedia } from "./CityDossierMedia";\n', '', 'dossier media import')
text = replace_once(text,
    '  const score = fitScore(city);\n',
    '  const score = fitScore(city);\n  const cityBackdrop = `/api/city-photo?city=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.country)}&slot=0&width=960&height=540&v=7`;\n',
    'dossier backdrop url')
old = 'props: { contentMaxWidth: "1240px", px: "1rem", py: { xs: "1.2rem", md: "1.8rem" } },'
new = '''props: {
            className: "rv-dossier-intro",
            contentMaxWidth: "1240px",
            px: "1rem",
            py: { xs: "1.2rem", md: "1.8rem" },
            style: {
              backgroundImage: `linear-gradient(90deg, rgba(7,17,14,.78), rgba(7,17,14,.48)), url("${cityBackdrop}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            },
          },'''
text = replace_once(text, old, new, 'dossier intro section')
text = replace_once(text, '                { type: "slot", props: { name: "city-media" } },\n', '', 'dossier media slot')
old = '''  return createComponent({
    schema,
    slots: {
      "city-media": <CityDossierMedia slug={city.slug} city={city.name} country={city.country} />,
    },
    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },
  });'''
new = '''  return createComponent({
    schema,
    compiler: { pageId: `roavio-city-${city.slug}`, serverFirst: true },
  });'''
text = replace_once(text, old, new, 'dossier createComponent slots')
write(path, text)

# Remove obsolete duplicate image component.
media = ROOT / 'app/roavio/CityDossierMedia.tsx'
if media.exists():
    media.unlink()

# Hydration stability: stop portaling the theme button into a separately hydrating Engine subtree.
path = 'app/roavio/PreferencesShell.tsx'
text = read(path)
text = replace_once(text, 'import { usePathname, useRouter } from "next/navigation";', 'import { useRouter } from "next/navigation";', 'preferences pathname import')
text = replace_once(text, 'import { createPortal } from "react-dom";\n', '', 'preferences portal import')
text = replace_once(text, '  const pathname = usePathname();\n', '', 'preferences pathname var')
text = replace_once(text, '  const [footerThemeSlot, setFooterThemeSlot] = useState<HTMLElement | null>(null);\n', '', 'preferences slot state')
old = '''  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFooterThemeSlot(document.getElementById("rv-footer-theme-slot"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

'''
text = replace_once(text, old, '', 'preferences portal effect')
text = replace_once(text,
    '      {footerThemeSlot ? createPortal(themeControl, footerThemeSlot) : null}\n',
    '      <div className="rv-footer-theme-dock">{themeControl}</div>\n',
    'preferences portal render')
write(path, text)

# Footer no longer contains a portal target.
path = 'app/roavio/theme.ts'
text = read(path)
text = replace_once(text, '        { type: "box", props: { id: "rv-footer-theme-slot", className: "rv-footer-theme-slot" } },\n', '', 'footer portal target')
write(path, text)

# Replace obsolete inset-photo stylesheet with the real outer-section treatment.
write('app/roavio/city-hero.css', '''/* City dossier intro: one verified city photo belongs to the outer Engine section. */
.rv-dossier-intro{
  position:relative;
  background-color:#0a1b16;
  background-blend-mode:normal;
  border-bottom:1px solid var(--rv-line);
}
.rv-dossier-intro>div{position:relative}
.rv-dossier-intro .rv-dossier-hero{
  background:rgba(6,24,19,.78)!important;
  border-color:rgba(232,255,244,.16)!important;
  box-shadow:0 18px 54px rgba(0,0,0,.2)!important;
}
.rv-dossier-intro .rv-dossier-metric{
  background:rgba(8,29,23,.88)!important;
  border-color:rgba(232,255,244,.14)!important;
  color:#f3faf6!important;
}
.rv-dossier-intro .rv-dossier-metric>*{color:inherit!important}
.rv-dossier-intro .rv-dossier-metric>*:first-child{color:rgba(237,249,243,.72)!important}

@media(max-width:700px){
  .rv-dossier-intro{
    background-position:center top!important;
  }
  .rv-dossier-intro .rv-dossier-hero{
    background:rgba(5,22,17,.8)!important;
  }
}
''')

# Add cheap overrides for homepage glass and the new non-portal theme dock.
path = 'app/roavio/ux.css'
text = read(path)
append = '''

/* Homepage performance: avoid persistent compositor-heavy glass blur on six cards. */
.rv-city-card .rv-score,
.rv-city-card .rv-mini-metric{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
  background:rgba(7,30,23,.72)!important;
}
.rv-floating-card{
  -webkit-backdrop-filter:none!important;
  backdrop-filter:none!important;
  background:rgba(255,255,255,.96)!important;
}

/* Theme control is a normal hydrated sibling after page content, visually docked with the footer. */
.rv-footer-theme-dock{
  max-width:1240px;
  width:100%;
  margin:-.35rem auto 0;
  padding:0 1rem .85rem;
  display:flex;
  justify-content:flex-end;
  background:var(--rv-paper);
}
@media(max-width:819px){
  .rv-footer-theme-dock{justify-content:flex-start;padding-bottom:calc(.85rem + env(safe-area-inset-bottom))}
}
'''
if '/* Homepage performance: avoid persistent compositor-heavy glass blur on six cards. */' not in text:
    text += append
write(path, text)

# Override old two-photo layout rules without risky broad regex surgery.
path = 'app/roavio/responsive-v2.css'
text = read(path)
append = '''

/* v3 dossier composition: media is the outer section background; no duplicate inset image. */
.rv-dossier-media,.rv-dossier-media__secondary{display:none!important}
.rv-dossier-intro .rv-dossier-hero__copy{max-width:760px!important}
@media(max-width:819px){
  .rv-dossier-intro .rv-dossier-hero__copy{max-width:100%!important}
  .rv-dossier-intro .rv-dossier-hero__copy p{max-width:100%!important}
}
'''
if '/* v3 dossier composition: media is the outer section background; no duplicate inset image. */' not in text:
    text += append
write(path, text)

print('Roavio current fixes applied')
