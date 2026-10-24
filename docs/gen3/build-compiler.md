# Generation 3 build compiler

The Generation 3 build adapter runs a small Engine-owned analysis pass alongside Next.js. It does not replace, patch, or reconstruct the Next.js/Turbopack compiler. Next.js remains responsible for TypeScript/TSX transformation, React Server Component boundaries, bundling, chunk splitting, route rendering, and final JavaScript/CSS output.

## Performance-first route and module pass

The pre-build pass discovers App Router and Pages Router entry files (including route handlers and supported metadata routes), then follows their reachable local imports. Type-only imports, dependency directories, hidden build output, and unrelated Engine modules are not treated as runtime compile jobs. AST reads and module resolution are cached within the pass, and each reached Engine module is indexed once even if many routes import it.

NENC terminal output uses one live status row pinned to the terminal bottom while work is in progress. Completed work is written above it as [NENC] DONE ... lines; the current operation is rewritten in place. NENC route analysis reports a percentage only because its route count is known before the pass starts. During Next.js on-demand compilation, if Next prints a batch of route names, NENC reports the number of those route targets completed out of that observed batch (for example, 1/3 = 33.3%). This is a route-completion percentage, not a claim about progress through Turbopack's internal work for one route. When Next does not provide an end event per route, NENC keeps the active batch visible and never fabricates a per-file completion percentage. When Next.js emits a real count (for example, static pages 3/8), the percentage is calculated from that count. Without an interactive TTY, normalized progress is printed as ordinary log output rather than silently swallowed.

```text
[NENC] COMPILING PAGE : app/page.tsx  (live bottom row)
[NENC] DONE COMPILED EC : src/engine/components/EngineCanvas.tsx — Engine dependency metadata prepared
[NENC] DONE COMPILED PAGE : app/page.tsx — 3 Engine modules indexed; Next.js retains JS/TSX emission
```

A resolved Engine import logs its source path. An Engine symbol coming from an installed package or an unresolved source alias uses a stable import name such as `@engine/EngineCanvas`. Module completion means Engine's dependency/usage metadata is ready; it does **not** mean Engine emits a replacement JS chunk. The imported code continues through Next.js as usual.

## Mirroring Next.js build activity

During `next build`, the Engine adapter also watches Next.js's terminal output for recognizable phase messages. Messages such as optimized-build compilation, type checking, page-data collection, static-page generation, and build-trace collection update the same bottom status row. Recognized one-line progress/completion messages are normalized to the NENC display; successful milestones become `[NENC] DONE ...` lines. Unrecognized output—including detailed diagnostics—is passed through without rewriting.

The adapter currently has only configuration and build-completion lifecycle hooks; it does not expose a supported per-file Turbopack compile callback. This bridge therefore parses known CLI messages as a best-effort display feature, not as a stable Next.js internal API. New or changed Next.js wording can simply remain ordinary output until the parser is updated.

The Generation 3 worker sends structured status/completion messages to the parent adapter over IPC. The parent adapter owns the terminal cursor and reapplies the pinned row after Next.js writes to the terminal, preventing two processes from fighting over the same row. Redirected logs and CI cannot pin a cursor, so only completion/failure events are printed there.

## Helping Next.js compile faster

The combined Engine plugin opts into Next.js's supported Turbopack filesystem cache for development and production builds. This warm-cache optimization lets Next.js restore prior work on subsequent sessions/builds; it does not promise that the first cold build is faster, and Next.js still owns JS/TSX transformation and bundling. Apps can explicitly override either setting with `experimental.turbopackFileSystemCacheForDev: false` or `experimental.turbopackFileSystemCacheForBuild: false`; other `experimental` values are preserved.

## Schema plans remain conservative

For statically resolvable `createPage({ schema })` schemas and `defineSchema({...})` wrappers, the pass also invokes the existing Generation 3 page compiler. It produces the normal runtime classification, custom-node classification, assets, feature manifests, fallback plans, and diagnostics.

If a page's schema depends on runtime values, imports, object spreads, computed properties, or arbitrary function execution, Engine skips only static **schema planning** for that page. It still analyzes that route's import graph, and Next.js continues to compile and render the route normally. This is why route-entry count and static-schema-plan count are separate numbers.

## Manifest

After Next.js succeeds, the adapter emits `nextjs-engine/compiler-manifest.json` under the configured build output directory. The manifest includes:

- discovered route entry metadata and the Engine modules reachable from each route;
- deduplicated module records, source paths or package fallback import names, usage paths, and module dependency IDs;
- static Engine page-schema plans, summary counts, diagnostics, and compile timings;
- actual Next.js adapter output counts and pathnames when Next.js supplies them in `onBuildComplete`.

The manifest excludes full source files, complete source schemas, arbitrary component props, request data, and prop contents. Output paths are validated to remain inside the project build directory.

## Existing adapters and CI

If an application already configured a Next.js adapter, `withEngine()` chains its `modifyConfig` and `onBuildComplete` callbacks through the Engine adapter.

The Generation 3 CI lane runs the phase A/B contracts, the build-compiler and module-compiler smoke tests, type-checking, and the Next.js production build.
