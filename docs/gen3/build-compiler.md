# Generation 3 build compiler

The Generation 3 build adapter runs a small Engine-owned analysis pass alongside Next.js. It does not replace, patch, or reconstruct the Next.js/Turbopack compiler. Next.js remains responsible for TypeScript/TSX transformation, React Server Component boundaries, bundling, chunk splitting, route rendering, and final JavaScript/CSS output.

## Performance-first route and module pass

The pre-build pass discovers App Router and Pages Router entry files (including route handlers and supported metadata routes), then follows their reachable local imports. Type-only imports, dependency directories, hidden build output, and unrelated Engine modules are not treated as runtime compile jobs. AST reads and module resolution are cached within the pass, and each reached Engine module is indexed once even if many routes import it.

NENC's Engine schema compiler uses **three actual Node.js worker threads**. Statically resolvable schema jobs are queued across those three workers, and each worker reports completed schema-node visits against that job's node count. The three percentages therefore belong to three different active jobs; they are not guessed time estimates and do not purport to show Turbopack's private internal progress. Each worker has one status slot that can report compilation percentage or byte throughput for an I/O task. 

NENC also keeps persistent schema-plan outputs under `.nextjs-engine/.cache/gen3/schema-output/`. Each schema job has its own cache file keyed by source path and route/schema ID; the entry fingerprint includes the canonical static schema, only the registered custom component types used by that schema, the TypeScript version, and the compiler source fingerprint. An unchanged job reads its compiled page record from disk without starting a worker. Editing one schema rewrites only that job's cache file; unchanged route entries remain byte-for-byte untouched. A compiler/runtime source change changes the compiler fingerprint and safely forces stale entries to rebuild. Cache writes use a temporary file and replacement step, and a missing/corrupt/unwritable cache entry falls back to compilation rather than failing the build.

The cache intentionally stores schema compiler outputs, not the entire Next.js/Turbopack output. NENC still scans the project and analyzes route/import relationships to rebuild the dependency manifest, while Next.js remains responsible for transforming and bundling application code.

In an interactive terminal, the shared `[NENC]` status line is pinned to the bottom row of the terminal viewport. Normal output is constrained to the rows above it, and finished tasks are written to scrollback as `[NENC] DONE ...` lines. When active tasks share an operation, their targets and per-worker metrics are compacted into one line. For example, the three schema workers can display `Compiling /guide, emd, ec · (43% - 57% - 80%)`. Different kinds of work keep their own metrics, such as `Compiling /guide (33.3%) · Downloading ICON:google.com (8202 B/s)`.

The Next.js development-output bridge remains separate from the three NENC schema workers. If Next.js prints `Compiling /a, /b, /c`, NENC tracks those observed development route targets, then finishes them only from a real `Compiled /route` event or request log with an actual compile duration. That route percentage is not a claim about Turbopack's internal work. When Next.js emits a real count (for example, static pages 3/8), that exact count drives the displayed percentage. During `next build`, NENC instead reports recognized build phases and the durations/counters that Next.js actually supplies; it does not fabricate route-by-route production-build progress.

The same three-slot logger supports streaming EngineMarkdown favicon downloads. The EMD favicon endpoint measures bytes read and elapsed time from the response body and shows the measured byte rate (B/s) for that slot. On completion it logs the actual downloaded byte size, for example `[NENC] DONE downloaded icon:github.com (76 KB)`. Icon responses remain capped at 256 KiB. The download status uses the normalized hostname only, not the source link's path or query.

Next.js 16 does not reliably expose `dev` in `process.argv` while evaluating `next.config.js`; the development bridge also checks `NODE_ENV` and the development phase. Without an interactive TTY, terminal-cursor pinning is unavailable; CI/redirected output keeps completion and failure lines rather than pretending to maintain a viewport row.

```text
[NENC] Compiling /guide, emd, ec · (43% - 57% - 80%)
[NENC] DONE compiled /request (1050ms, 434 modules)
[NENC] DONE downloaded icon:github.com (76 KB)
[NENC] Compiling /guide (33.3%) · Downloading ICON:google.com (8202 B/s)
```

A resolved Engine import logs its source path. An Engine symbol coming from an installed package or an unresolved source alias uses a stable import name such as `@engine/EngineCanvas`. Module completion means Engine's dependency/usage metadata is ready; it does **not** mean Engine emits a replacement JS chunk. The imported code continues through Next.js as usual. Schema jobs are the work that NENC parallelizes; Next.js remains the owner of JS/TSX transformation, React Server Component boundaries, bundling, and final JavaScript/CSS output.

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
