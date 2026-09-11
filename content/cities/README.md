# Roavio city content

The proposal treats a city as **content + structured facts**, not as a bespoke React page.

```text
content/cities/valencia/
├─ city.json   # structured metadata, scraped strengths/cautions and metric fallbacks
└─ guide.md    # long-form editorial guide
```

`app/cities/[slug]/page.tsx` loads that folder and renders it through the reusable NE Gen 3 `CityDossier` EngineComponent. The route itself does not contain city-specific UI or copy.

## Adding a city

1. Create `content/cities/<slug>/city.json`.
2. Add `guide.md` when editorial content exists.
3. Add or refresh live metrics in Roavio's normal structured data/API layer.
4. Done. No new page component is required.

Missing values remain missing. The proposal intentionally does not infer legal, tax, healthcare or metric data that is absent from the supplied source.

## Imported scrape

The source scrape is temporarily stored in `content/cities/.scrape/` as a compressed import snapshot. Run:

```bash
node scripts/roavio-materialize-scrape.js
```

to expand the snapshot into human-editable city folders. Existing edited files are preserved unless `--force` is supplied.

The import snapshot can be deleted after materialization; the runtime reads only the city folders.
