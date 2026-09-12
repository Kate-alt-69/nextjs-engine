from pathlib import Path

ROOT = Path('.')

# 1) Dark-mode decision-layer heading: --rv-paper becomes the dark surface in dark mode.
page = ROOT / 'app/page.tsx'
text = page.read_text(encoding='utf-8')
old = '{ type: "heading", props: { level: 2, content: es ? "Los rankings explican por qué, no solo quién gana." : "Rankings explain why — not just who won.", size: { xs: "2rem", md: "2.8rem" }, color: "var(--rv-paper)", style: { margin: ".8rem 0" } } },'
new = '{ type: "heading", props: { level: 2, content: es ? "Los rankings explican por qué, no solo quién gana." : "Rankings explain why — not just who won.", size: { xs: "2rem", md: "2.8rem" }, color: "#f3faf6", style: { margin: ".8rem 0" } } },'
if old not in text:
    raise SystemExit('decision-layer heading target not found')
page.write_text(text.replace(old, new, 1), encoding='utf-8')

# 2) Dossier summary CTA: use a stable lime surface + dark text in either theme.
dossier = ROOT / 'app/roavio/CityDossier.tsx'
text = dossier.read_text(encoding='utf-8')
old = '{ type: "button", props: { href: `/compare?cities=${city.slug}`, label: labels.compare, variant: "elevated", accentColor: "var(--rv-ink)" } },'
new = '{ type: "button", props: { href: `/compare?cities=${city.slug}`, label: labels.compare, variant: "elevated", accentColor: "var(--rv-lime)", color: "#10231f" } },'
if old not in text:
    raise SystemExit('dossier compare CTA target not found')
dossier.write_text(text.replace(old, new, 1), encoding='utf-8')

# 3) Image resolver: localized city names need canonical article aliases; add verified Commons
# fallbacks for the exact destinations reported broken.
route = ROOT / 'app/api/city-photo/route.ts'
text = route.read_text(encoding='utf-8')
anchor = 'const LANDMARK_MEDIA_HINT = /\\b(landmark|monument|tower|towers|mosque|cathedral|church|temple|palace|castle|fort|museum|square|plaza|bridge|gate|old[ _-]?town|historic|heritage|waterfront|marina|corniche|avenue|boulevard|promenade|market|bazaar|garden|park)\\b/i;\n'
insert = '''const LANDMARK_MEDIA_HINT = /\\b(landmark|monument|tower|towers|mosque|cathedral|church|temple|palace|castle|fort|museum|square|plaza|bridge|gate|old[ _-]?town|historic|heritage|waterfront|marina|corniche|avenue|boulevard|promenade|market|bazaar|garden|park)\\b/i;\n\n// Roavio stores display names in Spanish. English Wikipedia does not consistently\n// redirect those names, so try the exact supplied title first and then a known\n// canonical article title. This stays deterministic; it is not a broad image search.\nconst CITY_ARTICLE_ALIASES: Record<string, string> = {\n  "abu dabi": "Abu Dhabi",\n  "aman": "Amman",\n  "atenas": "Athens",\n  "belgrado": "Belgrade",\n  "ciudad de mexico": "Mexico City",\n  "ciudad del cabo": "Cape Town",\n  "copenhague": "Copenhagen",\n  "cracovia": "Kraków",\n  "dubai": "Dubai",\n  "el cairo": "Cairo",\n  "estambul": "Istanbul",\n  "florencia": "Florence",\n  "hanoi": "Hanoi",\n  "ho chi minh": "Ho Chi Minh City",\n  "liubliana": "Ljubljana",\n  "londres": "London",\n  "mascate": "Muscat",\n  "milan": "Milan",\n  "munich": "Munich",\n  "oporto": "Porto",\n  "pekin": "Beijing",\n  "praga": "Prague",\n  "roma": "Rome",\n  "seul": "Seoul",\n  "sevilla": "Seville",\n  "shanghai": "Shanghai",\n  "sidney": "Sydney",\n  "singapur": "Singapore",\n  "sofia": "Sofia",\n  "taipei": "Taipei",\n  "tallin": "Tallinn",\n  "tiflis": "Tbilisi",\n  "tokio": "Tokyo",\n  "varsovia": "Warsaw",\n  "viena": "Vienna",\n};\n\n// Verified cityscape files from Wikimedia Commons. These are deliberately narrow\n// fallbacks for destinations that were returning transparent fallback images.\nconst CURATED_COMMONS_FILES: Record<string, string> = {\n  "taipei": "File:2026 Taipei Skyline.jpg",\n  "wellington": "File:Wellington Skyline (34319401232).jpg",\n  "oporto": "File:Porto skyline.jpg",\n};\n'''
if anchor not in text:
    raise SystemExit('route constants anchor not found')
text = text.replace(anchor, insert, 1)

fold_anchor = '''function folded(value: string): string {\n  return value\n    .normalize("NFD")\n    .replace(/[\\u0300-\\u036f]/g, "")\n    .replace(/[_-]+/g, " ")\n    .toLowerCase();\n}\n'''
fold_insert = fold_anchor + '''\nfunction articleNamesForCity(city: string): string[] {\n  const alias = CITY_ARTICLE_ALIASES[folded(city)];\n  return alias && folded(alias) !== folded(city) ? [city, alias] : [city];\n}\n'''
if fold_anchor not in text:
    raise SystemExit('folded helper anchor not found')
text = text.replace(fold_anchor, fold_insert, 1)

old_resolve = '''async function resolveImage(city: string, width: number, height: number, slot: number): Promise<ResolvedCandidate | null> {\n  const pages: Array<{ language: "es" | "en"; page: ArticlePage }> = [];\n\n  for (const language of ["es", "en"] as const) {\n    try {\n      const page = await exactArticle(language, city, width);\n      if (!page) continue;\n      pages.push({ language, page });\n      const lead = safeLead(page);\n      if (slot === 0 && lead) return { source: lead, article: `${language}:${page.title ?? city}` };\n    } catch {\n      // Try the next exact-language article only.\n    }\n  }\n'''
new_resolve = '''async function resolveImage(city: string, width: number, height: number, slot: number): Promise<ResolvedCandidate | null> {\n  if (slot === 0) {\n    const curatedTitle = CURATED_COMMONS_FILES[folded(city)];\n    if (curatedTitle) {\n      try {\n        const infos = await imageInfo([curatedTitle], width, height);\n        const info = infos.get(curatedTitle) ?? infos.values().next().value;\n        const source = info?.thumburl ?? info?.url;\n        if (source && (!info?.mime || /^image\\/(?:jpeg|png|webp|avif)$/i.test(info.mime))) {\n          return { source, article: `commons:${curatedTitle}` };\n        }\n      } catch {\n        // Fall through to the exact article resolver.\n      }\n    }\n  }\n\n  const pages: Array<{ language: "es" | "en"; page: ArticlePage }> = [];\n  const seenPageIds = new Set<string>();\n\n  for (const language of ["es", "en"] as const) {\n    for (const articleName of articleNamesForCity(city)) {\n      try {\n        const page = await exactArticle(language, articleName, width);\n        if (!page) continue;\n        const pageKey = `${language}:${page.pageid ?? page.title ?? articleName}`;\n        if (seenPageIds.has(pageKey)) continue;\n        seenPageIds.add(pageKey);\n        pages.push({ language, page });\n        const lead = safeLead(page);\n        if (slot === 0 && lead) return { source: lead, article: `${language}:${page.title ?? articleName}` };\n      } catch {\n        // Try the next deterministic article candidate.\n      }\n    }\n  }\n'''
if old_resolve not in text:
    raise SystemExit('resolveImage opening block not found')
text = text.replace(old_resolve, new_resolve, 1)
route.write_text(text, encoding='utf-8')

# 4) Bump city photo cache key so previously cached transparent fallbacks are bypassed.
thumb = ROOT / 'app/roavio/CityThumb.tsx'
text = thumb.read_text(encoding='utf-8')
if 'const CITY_PHOTO_VERSION = "8";' not in text:
    raise SystemExit('CityThumb photo version target not found')
thumb.write_text(text.replace('const CITY_PHOTO_VERSION = "8";', 'const CITY_PHOTO_VERSION = "9";', 1), encoding='utf-8')

# Dossier background uses the same route directly, so invalidate that URL too.
text = dossier.read_text(encoding='utf-8')
if '&v=8`;' not in text:
    raise SystemExit('dossier backdrop cache version target not found')
dossier.write_text(text.replace('&v=8`;', '&v=9`;', 1), encoding='utf-8')

print('Roavio dark-mode contrast and city-image resolver fixes applied.')
# workflow trigger
