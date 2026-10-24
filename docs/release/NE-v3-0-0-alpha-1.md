# Next.js Engine v3.0.0-alpha.1 — A Modern, Server-First Generation

> **Release track:** Generation 3 alpha candidate  
> **Status:** Validation completed; alpha candidate not yet published as a GitHub Release  
> **Target branch:** `main-3`  
> **Previous stable generation:** Next.js Engine 2.6.x  
> **Runtime baseline:** React 19 and Next.js 16

Generation 3 is a **substantial architectural update from Generation 2**, not just another feature patch. It moves the Engine toward a more modern compiler-first model: typed page schemas are compiled into a deterministic execution plan, durable content stays server-first, and browser work is restricted to the interactive islands and runtime features that actually need it.

The goal is to make page behavior more explicit and inspectable—what renders on the server, what runs in the browser, when work is scheduled, and which compatibility fallback is selected—rather than relying on an increasingly large client-side runtime to do everything.

This is an alpha track. The stable 2.x line remains the reference for existing Generation 2 applications; evaluate Gen 3 against the current documentation and migration notes before switching production applications.

## Highlights

### A compiler-first page architecture

- `compilePage()` turns a typed schema into a deterministic execution plan and used-feature manifest.
- `createPage()` uses the Generation 3 compilation/server-rendering path for schemas that meet the Gen 3 contract.
- Static, server-owned, client-island, and deferred work are represented explicitly, giving build tooling and diagnostics a clearer view of the page.
- Compatibility and fallback planning is based on the features a page actually uses, instead of assuming every application requires every browser capability.

### Server-first by default, with narrower client work

Generation 3 keeps durable content in server-rendered output and isolates browser-dependent behavior behind targeted client islands. This is intended to reduce unnecessary client work while preserving the interactive behavior a page explicitly needs.

This is not a promise that every page automatically becomes faster: results still depend on the schema, selected components, data access, and how an application uses the runtime. The architecture makes the work and ownership more explicit so it can be measured and improved.

### Shared scheduling and adaptive behavior

- Shared scheduler, viewport, and model systems coordinate expensive or deferred browser work.
- Adaptive compilation supports phone/tablet-specific plans where configured.
- Canvas, image/video, lazy, scroll, and transition systems can participate in the shared runtime model rather than independently scheduling everything.
- Browser capability and compatibility fallbacks are made explicit in the compiled plan.

### Better development visibility

The development-only `/_engine/debug` workbench now provides a compact, VS Code-inspired workspace with route exploration, a live preview, node picking, runtime-boundary overlays, scheduler inspection, and device/viewport simulation.

The new **Errors / Problems** inspector collects preview runtime errors, unhandled promise rejections, console errors (including many hydration mismatch messages), and visible Next.js dev-overlay text when accessible. It classifies likely hydration, SSR, runtime, and console problems; shows a heuristic source-owner hint; supports filtering/copying; and uses a loading state while waiting for the development preview. The owner hint is advisory—it does not automatically modify application files.

The route is development-only and is removed before production route discovery.

### EngineSEO and generated metadata

EngineSEO supports structured metadata, canonical/Open Graph/Twitter tags, robots and sitemap output, safe JSON-LD, and social preview generation. Automatic static-route sitemap dates prefer trustworthy Git modification dates; explicit content dates take precedence, and unknown dates are omitted rather than invented.

### Networking and security boundaries

The Generation 3 line includes the NENC command pipeline and server-side security helpers for application-owned flows. The existence of these primitives does not automatically secure a consuming app: authentication, authorization, replay/rate policy, and server-side validation still need to match the application's threat model.

## Why this is a bigger change than Gen 2

| Generation 2 direction | Generation 3 direction |
|---|---|
| Runtime/component-centric integration | Compiler-first execution plans |
| Rendering and browser work often coordinated at runtime | Static/server/client/deferred ownership made explicit before rendering |
| Optimizations are largely runtime/component behavior | Build-time feature manifests and compatibility/fallback planning |
| Inspect runtime behavior through browser tools and logs | Development workbench connects routes, boundaries, scheduling, and captured preview errors |
| Standalone provider compiler writes `.engine-api-compiled.json` at the root | Combined Gen 3 plugin writes `.nextjs-engine/config/.apiconfig.json` under the Engine config tree |
| Existing 2.x APIs and behavior define the stable contract | A distinct alpha contract with its own migration and compatibility checks |

The table describes architectural direction, not a claim that every Gen 2 API has a one-to-one Gen 3 replacement.

## Developer experience

During `next dev`, open:

```text
http://localhost:3000/_engine/debug
```

The preview displays a waiting/building state until its response arrives, a ready state after loading, and an error state when a problem is captured. Server errors that occur before a usable preview document is delivered may still require the normal Next.js development overlay or terminal output.

## Compatibility and migration

- Target baseline: React 19 and Next.js 16.
- Treat Generation 3 as a separate alpha track, not a drop-in replacement for every Generation 2 application.
- Keep existing stable 2.x applications on their supported 2.x line until the app's schemas, custom components, plugins, and build integration have been verified against Gen 3.
- Prefer the current Gen 3 overview, Phase A/B compiler/runtime guide, Phase C networking guide, Phase D compatibility/debug guide, and the Kastrick integration migration notes over older 2.x documentation where the contracts differ.
- Pin the exact branch/commit or package snapshot used by your application while the alpha is evolving.

## Validation status

The validation evidence below supports this alpha candidate; it does not mean a GitHub Release has been published.

Validation on merged upstream commit `7c373ffd1d54859dde3a7a1900e823a14264eba2`:

- Engine runtime CI passed: [workflow run #340](https://github.com/Kate-alt-69/nextjs-engine/actions/runs/39845431110).
- Chromium, Firefox and WebKit browser compatibility passed: [workflow run #143](https://github.com/Kate-alt-69/nextjs-engine/actions/runs/39845431494).
- The distributable package sync completed `npm run type-check` and `npm run pack:check`. Its final direct push was rejected by protection on `main-3-package`; the same validated package snapshot was then merged through [PR #33](https://github.com/Kate-alt-69/nextjs-engine/pull/33).
- Kastrick's vendored update is merged and its Vercel deployment status is green.

The Engine repository still reports a red Vercel status targeting the `roavio` deployment project. Its build logs were not accessible in this workflow, so that status remains separately unresolved rather than being presented as a failing Engine runtime test. The Engine Actions runtime and browser suites above are green.

Generation 3 remains an alpha candidate. The latest published stable release is `Release-v2.6.2`; `v3.0.0-alpha.1` has not yet been published as an official GitHub Release or tag.

## Links

- [Generation 3 overview](../gen3/overview.md)
- [Compiler and server-first runtime](../gen3/phase-a-b.md)
- [Networking and NENC](../gen3/phase-c-network.md)
- [Compatibility and EngineDebug](../gen3/phase-d-hardening.md)
- [EngineDebug isolation contract](../gen3/engine-debug-isolation.md)
- [Generation 3 migration](https://github.com/Kate-alt-69/kastrick/blob/main/docs/gen3-migration.md)
- [Current development branch](https://github.com/Kate-alt-69/nextjs-engine/tree/main-3)
- [Latest published v2.6.2 release](https://github.com/Kate-alt-69/nextjs-engine/releases/tag/Release-v2.6.2)
