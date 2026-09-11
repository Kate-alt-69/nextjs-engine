from pathlib import Path
import re

# PreferencesShell: move theme control into the footer slot.
p = Path("app/roavio/PreferencesShell.tsx")
s = p.read_text()
s = s.replace('import { useRouter } from "next/navigation";', 'import { usePathname, useRouter } from "next/navigation";\nimport { createPortal } from "react-dom";')
s = s.replace('  const router = useRouter();\n  const [theme, setTheme] = useState<RoavioThemeMode>(initialTheme);', '  const router = useRouter();\n  const pathname = usePathname();\n  const [theme, setTheme] = useState<RoavioThemeMode>(initialTheme);')
s = s.replace('  const [personalization, setPersonalization] = useState(true);\n  const cookieIndex', '  const [personalization, setPersonalization] = useState(true);\n  const [footerThemeSlot, setFooterThemeSlot] = useState<HTMLElement | null>(null);\n  const cookieIndex')
anchor = '  useEffect(() => setLocale(initialLocale), [initialLocale]);\n'
insert = '  useEffect(() => setLocale(initialLocale), [initialLocale]);\n\n  useEffect(() => {\n    const frame = window.requestAnimationFrame(() => {\n      setFooterThemeSlot(document.getElementById("rv-footer-theme-slot"));\n    });\n    return () => window.cancelAnimationFrame(frame);\n  }, [pathname]);\n'
if anchor not in s:
    raise SystemExit("Preferences locale effect anchor missing")
s = s.replace(anchor, insert, 1)
old = '  const phaseLabel = modeLabel(theme, moon.phase, spanish);\n\n  return (\n    <>\n      <button\n        type="button"\n        className={`rv-theme-toggle${showConsent ? " rv-theme-toggle--consent" : ""}`}\n        onClick={chooseTheme}\n        aria-label={theme === "dark" ? (spanish ? "Cambiar a modo claro" : "Switch to light mode") : (spanish ? "Cambiar a modo oscuro" : "Switch to dark mode")}\n        title={theme === "dark" ? `${moon.phase} · ${Math.round(moon.illumination)}%` : (spanish ? "Modo claro · sol" : "Light mode · sun")}\n      >\n        <CelestialGlyph mode={theme} moon={moon} />\n        <span>{phaseLabel}</span>\n      </button>\n'
new = '  const phaseLabel = modeLabel(theme, moon.phase, spanish);\n  const themeControl = (\n    <button\n      type="button"\n      className="rv-theme-toggle"\n      onClick={chooseTheme}\n      aria-label={theme === "dark" ? (spanish ? "Cambiar a modo claro" : "Switch to light mode") : (spanish ? "Cambiar a modo oscuro" : "Switch to dark mode")}\n      title={theme === "dark" ? `${moon.phase} · ${Math.round(moon.illumination)}%` : (spanish ? "Modo claro · sol" : "Light mode · sun")}\n    >\n      <CelestialGlyph mode={theme} moon={moon} />\n      <span>{phaseLabel}</span>\n    </button>\n  );\n\n  return (\n    <>\n      {footerThemeSlot ? createPortal(themeControl, footerThemeSlot) : null}\n'
if old not in s:
    raise SystemExit("Preferences floating theme block missing")
s = s.replace(old, new, 1)
p.write_text(s)

# Theme/footer: reserve a proper inline theme slot.
p = Path("app/roavio/theme.ts")
s = p.read_text()
old_toggle = re.search(r"    \.rv-theme-toggle\{[^\n]*\}", s)
if not old_toggle:
    raise SystemExit("theme toggle CSS not found")
new_toggle = "    .rv-footer-theme-slot{display:flex;align-items:center;justify-content:flex-end;min-height:40px;flex:0 0 auto}.rv-theme-toggle{position:static;z-index:auto;border:1px solid var(--rv-line);border-radius:999px;padding:.25rem .62rem .25rem .25rem;background:var(--rv-card-soft);color:var(--rv-ink);box-shadow:none;backdrop-filter:none;display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;font-size:.72rem;font-weight:800;transition:background .2s ease,border-color .2s ease,transform .2s ease}.rv-theme-toggle:hover{border-color:color-mix(in srgb,var(--rv-green) 44%,var(--rv-line));background:color-mix(in srgb,var(--rv-card-soft) 82%,var(--rv-green) 18%)}.rv-theme-toggle:active{transform:scale(.97)}.rv-theme-toggle canvas{display:block}"
s = s[:old_toggle.start()] + new_toggle + s[old_toggle.end():]
s = s.replace('.rv-theme-toggle--consent{bottom:12.5rem}', '')
old_footer = '{ type: "text", props: { content: copyFor(locale).footer, color: "var(--rv-muted)", size: ".76rem" } },'
new_footer = old_footer + '\n        { type: "box", props: { id: "rv-footer-theme-slot", className: "rv-footer-theme-slot" } },'
if old_footer not in s:
    raise SystemExit("footer text node anchor missing")
s = s.replace(old_footer, new_footer, 1)
p.write_text(s)

# Explorer: 18 desktop / 12 mobile cards, actual page mounting.
p = Path("app/roavio/ClientWidgets.tsx")
s = p.read_text()
state_anchor = '  const [sort, setSort] = useState("fit");\n  const [compare, setCompare] = useState<string[]>([]);'
state_new = '  const [sort, setSort] = useState("fit");\n  const [page, setPage] = useState(0);\n  const [pageSize, setPageSize] = useState(18);\n  const [compare, setCompare] = useState<string[]>([]);'
if state_anchor not in s:
    raise SystemExit("Explorer state anchor missing")
s = s.replace(state_anchor, state_new, 1)
effect_anchor = '  useEffect(() => {\n    if (initialSearch) return;\n    const fromUrl = new URLSearchParams(window.location.search).get("search");\n    if (fromUrl) setQuery(fromUrl);\n  }, [initialSearch]);\n'
effect_new = effect_anchor + '\n  useEffect(() => {\n    const mobile = window.matchMedia("(max-width: 700px)");\n    const syncPageSize = () => setPageSize(mobile.matches ? 12 : 18);\n    syncPageSize();\n    mobile.addEventListener?.("change", syncPageSize);\n    return () => mobile.removeEventListener?.("change", syncPageSize);\n  }, []);\n\n  useEffect(() => {\n    setPage(0);\n  }, [query, continent, beachOnly, sort, pageSize]);\n'
if effect_anchor not in s:
    raise SystemExit("Explorer URL effect anchor missing")
s = s.replace(effect_anchor, effect_new, 1)
results_end = '  }, [catalog, query, continent, beachOnly, sort, locale]);\n\n  const toggleCompare = (slug: string) => {'
pagination_logic = '  }, [catalog, query, continent, beachOnly, sort, locale]);\n\n  const pageCount = Math.max(1, Math.ceil(results.length / pageSize));\n  const safePage = Math.min(page, pageCount - 1);\n  const visibleResults = results.slice(safePage * pageSize, safePage * pageSize + pageSize);\n  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index);\n  const rangeStart = results.length ? safePage * pageSize + 1 : 0;\n  const rangeEnd = Math.min(results.length, safePage * pageSize + pageSize);\n\n  useEffect(() => {\n    if (page !== safePage) setPage(safePage);\n  }, [page, safePage]);\n\n  const goToPage = (nextPage: number) => {\n    const bounded = Math.max(0, Math.min(pageCount - 1, nextPage));\n    setPage(bounded);\n    window.requestAnimationFrame(() => {\n      const target = document.getElementById("rv-city-results");\n      if (!target) return;\n      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;\n      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });\n    });\n  };\n\n  const toggleCompare = (slug: string) => {'
if results_end not in s:
    raise SystemExit("Explorer results end anchor missing")
s = s.replace(results_end, pagination_logic, 1)
info_old = '<p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>{results.length} {copy.destinations} · {catalog.length} {copy.catalog} · {copy.compareHint}</p>\n      <div className="rv-result-grid">\n        {results.map((city) => ('
info_new = '<p style={{ color: "var(--rv-muted)", margin: ".55rem 0 1rem", fontSize: ".86rem" }}>{results.length} {copy.destinations} · {catalog.length} {copy.catalog} · {copy.compareHint} · {locale === "es" ? `mostrando ${rangeStart}–${rangeEnd}` : `showing ${rangeStart}–${rangeEnd}`}</p>\n      <div className="rv-cities-folder">\n        {pageCount > 1 ? (\n          <div className="rv-cities-folder__tabs" role="navigation" aria-label={locale === "es" ? "Páginas de destinos" : "Destination pages"}>\n            {pageNumbers.map((pageIndex) => (\n              <button key={pageIndex} type="button" className="rv-cities-page-tab" data-active={pageIndex === safePage} aria-current={pageIndex === safePage ? "page" : undefined} onClick={() => goToPage(pageIndex)}>\n                <span>{locale === "es" ? "Pág." : "Page"}</span> {pageIndex + 1}\n              </button>\n            ))}\n          </div>\n        ) : null}\n        <div className="rv-result-grid" id="rv-city-results">\n        {visibleResults.map((city) => ('
if info_old not in s:
    raise SystemExit("Explorer result grid anchor missing")
s = s.replace(info_old, info_new, 1)
grid_close_old = '        ))}\n      </div>\n      {results.length === 0 ? ('
grid_close_new = '        ))}\n        </div>\n        {pageCount > 1 ? (\n          <div className="rv-cities-folder__footer">\n            <button type="button" className="rv-cities-page-nav" disabled={safePage === 0} onClick={() => goToPage(safePage - 1)}>← {locale === "es" ? "Anterior" : "Previous"}</button>\n            <span>{locale === "es" ? "Página" : "Page"} <strong>{safePage + 1}</strong> / {pageCount}</span>\n            <button type="button" className="rv-cities-page-nav" disabled={safePage >= pageCount - 1} onClick={() => goToPage(safePage + 1)}>{locale === "es" ? "Siguiente" : "Next"} →</button>\n          </div>\n        ) : null}\n      </div>\n      {results.length === 0 ? ('
if grid_close_old not in s:
    raise SystemExit("Explorer grid close anchor missing")
s = s.replace(grid_close_old, grid_close_new, 1)
p.write_text(s)

# Folder pagination visual layer.
p = Path("app/roavio/responsive-v2.css")
s = p.read_text()
pagination_css = '\n\n/* Paged destination directory: only the current sheet is mounted. */\n.rv-cities-folder{position:relative;margin-top:.25rem;padding:.8rem;border:1px solid var(--rv-line);border-radius:0 24px 24px 24px;background:color-mix(in srgb,var(--rv-card) 82%,transparent);box-shadow:0 18px 50px color-mix(in srgb,var(--rv-shadow) 70%,transparent)}\n.rv-cities-folder__tabs{display:flex;align-items:flex-end;gap:.25rem;overflow-x:auto;margin:-2.55rem -.8rem .8rem;padding:1.75rem .8rem 0;scrollbar-width:none}\n.rv-cities-folder__tabs::-webkit-scrollbar{display:none}\n.rv-cities-page-tab{flex:0 0 auto;border:1px solid var(--rv-line);border-bottom-color:var(--rv-line);border-radius:12px 12px 4px 4px;padding:.5rem .68rem;background:var(--rv-card-soft);color:var(--rv-muted);font-size:.75rem;font-weight:800;cursor:pointer;transition:transform .16s ease,background .16s ease,color .16s ease,border-color .16s ease}\n.rv-cities-page-tab span{font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;opacity:.72}\n.rv-cities-page-tab[data-active=\'true\']{transform:translateY(1px);background:var(--rv-card);color:var(--rv-ink);border-color:color-mix(in srgb,var(--rv-green) 38%,var(--rv-line));border-bottom-color:var(--rv-card)}\n.rv-cities-folder__footer{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.75rem;margin-top:.85rem;padding-top:.75rem;border-top:1px solid var(--rv-line);color:var(--rv-muted);font-size:.78rem}\n.rv-cities-folder__footer>span{text-align:center}\n.rv-cities-page-nav{justify-self:start;border:1px solid var(--rv-line);border-radius:11px;background:var(--rv-card);color:var(--rv-ink);padding:.55rem .72rem;font-weight:750;cursor:pointer}\n.rv-cities-page-nav:last-child{justify-self:end}\n.rv-cities-page-nav:disabled{opacity:.38;cursor:not-allowed}\n.rv-cities-page-nav:not(:disabled):hover{border-color:color-mix(in srgb,var(--rv-green) 45%,var(--rv-line));background:var(--rv-card-soft)}\n'
marker = '@media (max-width:819px){'
if marker not in s:
    raise SystemExit("responsive mobile marker missing")
s = s.replace(marker, pagination_css + '\n' + marker, 1)
mobile_extra = '  .rv-cities-folder{padding:.55rem;border-radius:0 18px 18px 18px}\n  .rv-cities-folder__tabs{margin:-2.35rem -.55rem .6rem;padding:1.6rem .55rem 0}\n  .rv-cities-page-tab{padding:.48rem .62rem}\n  .rv-cities-folder__footer{grid-template-columns:1fr 1fr;gap:.45rem}\n  .rv-cities-folder__footer>span{grid-column:1/-1;grid-row:1;text-align:center}\n  .rv-cities-page-nav{grid-row:2;width:100%;justify-content:center}\n  .rv-footer-theme-slot{justify-content:flex-start}\n'
mobile_anchor = '  .rv-explore-hero-section{\n'
if mobile_anchor not in s:
    raise SystemExit("mobile CSS insertion anchor missing")
s = s.replace(mobile_anchor, mobile_extra + '\n' + mobile_anchor, 1)
p.write_text(s)

# Real Roavio mobile drawer trigger: 3 lines <-> X using EngineManim.
p = Path("app/roavio/RoavioMobileNav.tsx")
s = p.read_text()
import_anchor = 'import { EngineDrawer, EngineManim, EngineTransitionLink } from "@/engine";'
s = s.replace(import_anchor, import_anchor + '\nimport { EngineNavManimIcon } from "@/src/engine/components/EngineNavManimIcon";')
s = s.replace('  const [open, setOpen] = useState(false);', '  const [open, setOpen] = useState(false);\n  const [menuTouched, setMenuTouched] = useState(false);')
s = s.replace('        onOpenChange={setOpen}', '        onOpenChange={(next) => { setMenuTouched(true); setOpen(next); }}')
old_trigger = '        trigger={(\n          <span className="rv-mobile-nav-trigger__icon" aria-hidden="true">\n            <span />\n            <span />\n          </span>\n        )}'
new_trigger = '        trigger={(\n          <span className="rv-mobile-nav-trigger__icon" aria-hidden="true">\n            {menuTouched ? (\n              <EngineNavManimIcon open={open} size={22} />\n            ) : (\n              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">\n                <path d="M4 6h14M4 11h14M4 16h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />\n              </svg>\n            )}\n          </span>\n        )}'
if old_trigger not in s:
    raise SystemExit("Roavio mobile trigger anchor missing")
s = s.replace(old_trigger, new_trigger, 1)
p.write_text(s)

p = Path("app/roavio/mobile-nav.css")
s = p.read_text()
s = re.sub(r'  \.rv-mobile-nav-trigger__icon\{[^\n]*\}\n  \.rv-mobile-nav-trigger__icon span\{[^\n]*\}\n  \.rv-mobile-nav-trigger__icon span:first-child\{[^\n]*\}\n  \.rv-mobile-nav-trigger__icon span:last-child\{[^\n]*\}', '  .rv-mobile-nav-trigger__icon{position:relative;width:22px;height:22px;display:grid;place-items:center;color:inherit}\n  .rv-mobile-nav-trigger__icon>span,.rv-mobile-nav-trigger__icon canvas,.rv-mobile-nav-trigger__icon svg{display:block!important;width:22px!important;height:22px!important}', s, count=1)
p.write_text(s)
