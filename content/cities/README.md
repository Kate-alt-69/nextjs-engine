# Roavio city content

The proposal treats each destination as **structured facts + editorial Markdown**, not as a bespoke React page.

```text
content/cities/
├─ valencia/
│  ├─ city.json
│  └─ guide.md
├─ lisboa/
│  ├─ city.json
│  └─ guide.md
└─ ...
```

`app/cities/[slug]/page.tsx` is the only city route. It loads the requested content folder through `cityContent.server.ts` and renders it with the reusable NE Gen 3 `CityDossier` EngineComponent.

The corrected Roavio mapping supplied for this proposal contains **96 documents total**: **90 city dossiers** and 6 non-city routes. All 90 city folders are materialized here. Forty city pages currently expose the deeper visa/tax, healthcare, and neighborhoods/coworking editorial sections; the remaining cities still keep their common highlights, connectivity and source sections.

## One source of truth

The server content loader also exposes a lightweight city catalog for Explore, Compare, Match and Favorites. Those surfaces no longer keep a separate hard-coded city list.

Structured page text is authoritative when a metric is explicitly exposed. The earlier structured metric dataset is used only as a fallback when the mapped page copy does not state a value. Missing values stay `null`; the UI renders them as unavailable instead of inventing data.

## Adding a city

1. Create `content/cities/<slug>/city.json`.
2. Add `content/cities/<slug>/guide.md`.
3. Add/update live metrics in Roavio's normal API or structured-data layer when available.
4. Done — no new Next.js route or React page is required.

Start from `_template/` when authoring manually.

## Migration utility

`scripts/roavio-materialize-scrape.js` is a one-time migration helper for the exact 90-route map recovered from the corrected scrape. It is not part of runtime rendering. The materialized `city.json` and `guide.md` files are the runtime content.

The importer validates the mapped catalog signature before accepting a refresh so an unexpected source-layout change fails loudly rather than silently corrupting content.
