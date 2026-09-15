# Generation 3 Phase D — Compatibility, debug, and hardening

> Branch: `main-3`
>
> Status: D.1–D.10 compatibility and dev-only EngineDebug workbench complete
> Status: D.1–D.4 and D.11–D.22 complete; D.5–D.10 debug route/shell work remains separately owned

Phase D makes the Generation 3 compiler understandable, compatible, measurable, secure, and release-ready. It builds on the compiler/runtime graph from Phases A and B and the secure command layer from Phase C.

## D.1 — Used-feature manifest

Every `compilePage()` result now contains a deterministic `featureManifest`. It lists only browser and rendering features that the compiled page actually uses and records the exact compiled nodes responsible for each feature.

```ts
const plan = compilePage(productSchema, { pageId: "/products" });

console.log(plan.featureManifest);
// {
//   version: 1,
//   pageId: "/products",
//   uses: [{
//     feature: "webgl2",
//     requiredBy: [{
//       nodeId: "...",
//       path: "root.2",
//       nodeType: "canvas",
//       runtime: "client"
//     }]
//   }]
// }
```

The manifest is deeply frozen, feature names are sorted, and source nodes use stable compiler paths. Recompiling an unchanged page therefore produces the same artifact. Multiple nodes using the same feature produce one feature entry with multiple `requiredBy` records.

`plan.capabilities` remains available for compatibility and is now derived from `featureManifest.uses`, preventing the two views from drifting apart.

Static platform dependencies count too: an `EngineGrid` records `css-grid` even though it needs no client island. An ordinary link does not record View Transitions, while a link requesting an animated transition does. Pages that do not use camera, speech, WebGPU, or another capability do not contain those names at all; future compatibility checks must evaluate only `uses` entries.

## D.2 — Fallback compiler

Every compiled page also contains a deterministic, frozen `fallbackPlan`. Each used feature begins with its native implementation followed by only the fallbacks the engine can actually provide:

| Feature | Ordered strategies |
| --- | --- |
| View Transitions | native → Web Animations → instant navigation |
| IntersectionObserver | native → eager rendering |
| Container queries | native → media-query layout → normal flow |
| VisualViewport | native → layout viewport |
| CSS Grid | native → normal flow |

Advanced capabilities do not receive fictional compatibility. For example, `webgl2` remains native-only unless an application registers an explicit feature-specific policy such as a static poster. Calling `resolveEngineFallbackPlan()` with a browser-support resolver chooses the first viable strategy and reports `native`, `fallback`, or `unavailable` for every feature the page actually uses.

The default policies match existing runtime behavior. Engine Transitions checks `startViewTransition`, then `HTMLElement.animate`, then performs the navigation immediately. Engine Scheduler treats work as visible when IntersectionObserver is absent. EngineViewport reads layout-viewport dimensions when VisualViewport is absent. The container-query policy is emitted for registered components that declare `container-queries`; it prefers the engine's media-query compatibility layout and finally preserves normal document flow.

Custom policies are page-compiler input, not global browser claims:

```ts
const fallbackPlan = compileEngineFallbackPlan(featureManifest, root, [{
	feature: "webgl2",
	fallbacks: [{
		id: "static-poster",
		kind: "rendering",
		requires: [],
		fidelity: "structural",
	}],
}]);
```

## D.3 — Best-effort older-browser rendering

`fallbackPlan.legacy` is deliberately separate from full runtime support. It records the durable content present in the compiled server tree—HTML, CSS, text, images, links, and basic form structure—and lists client enhancement boundaries by stable compiler path.

This is not a second renderer and it does not pretend an unsupported GPU or media API works. The Generation 3 server renderer already sends static markup and passes nested server-rendered children through client-island boundaries. The legacy plan makes that contract explicit so compatibility UI and future build diagnostics can distinguish “the enhancement is unavailable” from “the page content is unavailable.”

## D.4 — Browser compatibility dialog

`EngineCompatibilityDialog` resolves a compiled page's `fallbackPlan` after hydration and opens only when a feature the page actually uses needs a fallback or is unavailable. A fully native page renders no trigger and no dialog. Server rendering stays empty until real browser support can be measured, preventing false warnings and hydration mismatches.

```tsx
<EngineCompatibilityDialog
	plan={enginePlan.fallbackPlan}
	showSources={process.env.NODE_ENV === "development"}
/>
```

The dialog distinguishes two outcomes:

- `fallback` — NE selected the first viable compiled fallback and names it;
- `unavailable` — no native implementation or honest fallback can run, while the dialog explains that durable server-rendered content remains available when possible.

Built-in probes cover the compiler's DOM, Canvas/WebGL, scheduling, viewport, transition, CSS, clipboard, media, speech, and network capabilities. They live in a small isolated compatibility module rather than importing the full `EngineBrowser` interaction runtime. Unknown or application-defined capabilities fail closed unless the application supplies an explicit support override:

```tsx
<EngineCompatibilityDialog
	plan={enginePlan.fallbackPlan}
	support={{
		"company-ar-renderer": true, // Result from the application's client probe.
	}}
/>
```

`autoOpen` defaults to `true`. Set it to `false` to expose only the manual “Browser compatibility” trigger. `showSources` reveals the stable compiled node paths responsible for each issue and defaults to `false` for user-facing dialogs.

## D.5 — Development-only EngineDebug route

The combined Engine plugin generates `app/%5Fengine/debug/page.tsx` only while Next.js runs in development. Next exposes that encoded private-looking directory as `/_engine/debug`. The generated module points at the package's EngineDebug implementation and is protected by an ownership marker, so the plugin never replaces or removes an application-owned page.

Production is an absence guarantee, not an authentication rule. When `NODE_ENV` is not `development`, the plugin removes its generated page and Next's stale development type cache before Next discovers and validates production routes. CI builds the application and proves the route is absent from the App Router manifests and compiled server/client output. There is no hidden production endpoint to protect.

## D.6 — Page explorer and live preview

EngineDebug discovers App Router and Pages Router page files, normalizes route groups and dynamic segments, and presents the resulting application routes in a sidebar. Selecting a route updates a same-origin live preview without leaving the workbench. Private framework directories and the debug page itself never enter the explorer.

## D.7 — Visual node picker

Picker mode inspects the real compiler metadata attached to rendered Engine roots. The inspector reports the stable compiler id and path, node type, server/static/client rendering decision, the reason for that decision, hydration work, estimated client JavaScript class, current runtime status, and declared capabilities. Canvas islands also expose their measured frame rate and the simulated display refresh target.

The metadata is development-only. Server/static nodes report zero client bytes; browser-dependent nodes identify the lazy runtime boundary rather than claiming an imprecise byte count.

## D.8 — Runtime-boundary overlay

The preview overlay labels the actual rendered boundaries as `STATIC`, `SERVER`, `CLIENT`, or `DEFERRED`. Color and text are injected into the preview document by the workbench and can be disabled without changing the application tree.

## D.9 — Live scheduler inspector

`EngineScheduler` publishes a development-only snapshot whenever observed work changes state. The workbench displays the exact task identity, compiler path, frame pressure, and transitions among:

- `VISIBLE / RUNNING`;
- `NEAR / PRELOADING`;
- `SLEEPING`;
- `DEFERRED`.

The bridge is attached only in development and retains a bounded transition history. When a rendered Engine node has not registered direct scheduled work, the inspector can still explain its current inferred DOM visibility without presenting that inference as a scheduler transition.

## D.10 — Device and viewport simulator

Desktop, tablet, phone, and custom profiles control the preview's CSS viewport, device-pixel ratio probe, refresh target, touch and hover capability probes, orientation, and VisualViewport availability. The panel compares the selected profile with measured layout results—for example, the number of computed grid columns—so a developer can see why a schema lays out differently.

The simulator does not claim to change physical hardware. In particular, its refresh control changes the Engine debug target and explanation while the live FPS meter continues to report the browser's actual animation cadence.

## Phase D implementation order

1. D.11–D.15 remaining compiler explanations and EngineDebug diagnostics;
2. D.16–D.17 incremental compilation and HMR integration;
3. D.18 build budgets;
4. D.19 static security diagnostics;
5. D.20 production tree-shaking proofs;
6. D.21–D.22 device, network, browser, torture, and visual tests.
## D.11–D.15 — Development inspector data

Inspector contracts live behind the direct development entrypoint `nextjs-engine/debug`; the main browser-safe barrel does not import them. They provide data to the separately owned debug UI without creating a second route or shell:

- NENC logical name, runtime owner, opaque compiled command, auth, permission, `EngineAPIResolver` use, and an explicit `privateEndpointExposed: false` result;
- EngineCookie owner, creator, purpose, device binding, allowed commands, and expiry—never storage ids, ciphertext, public-key material, or raw credentials;
- named `EngineModel` state, computed values, actions, and registered React consumers, plus dev-only state editing and subscriptions;
- `USED`/`UNUSED` capabilities, native support, selected fallback, and responsible compiled nodes;
- a `why` explanation for every runtime, scheduling, responsive, and fallback decision.

All inspector calls reject in production. `EngineModel` consumer tracking is a development no-op in production.

## D.16–D.17 — Artifact graph and scoped HMR

`compileEngineArtifact()` caches schema, style, asset, command, model, device, and capability artifacts by stable fingerprints. Dependency edges support targeted invalidation through `invalidateEngineArtifacts()`, while `inspectEngineArtifactGraph()` exposes hit/rebuild metadata only in development.

The NENC and Shader plugins use the same scoped-artifact rule at build-tool level. A schema edit recompiles the page plan and its dependent styles without rebuilding unrelated commands or shaders; command and shader source edits rebuild only their own artifacts. The runtime registry revision participates in page fingerprints so plugin/profile changes cannot reuse a stale plan.

## D.18 — Optional build budgets

`evaluateEngineBuildBudgets()` accepts limits for initial JavaScript, route JavaScript, critical CSS, request count, and hydrated island count. Each configured limit returns `PASS` or `FAIL` with the actual value, unit, and sorted contributor attribution. `assertEngineBuildBudgets()` converts failures into a build error.

```ts
const report = evaluateEngineBuildBudgets(measurements, {
	initialJS: 180_000,
	routeJS: 90_000,
	criticalCSS: 18_000,
	requestCount: 12,
	hydratedIslands: 4,
}, attribution);

assertEngineBuildBudgets(report);
```

After `next build`, `scripts/gen3-production-proof.js` reads Next's emitted build and route manifests for real byte/request measurements. CI or applications can provide JSON limits through `ENGINE_BUILD_BUDGETS`; hydrated-island measurements can be supplied through `ENGINE_HYDRATED_ISLANDS`.

## D.19 — Static security diagnostics

Schema compilation rejects serious findings by default: literal client-visible secrets, `javascript:` URLs, client imports of private database/server modules, credentialed wildcard CORS, `SameSite=None` cookies without `Secure`, and protected commands that explicitly disable device proof. Messages identify the property path but never reproduce a secret value. Upload forms without byte or MIME allowlists receive warnings.

Use `security: "report"` to collect diagnostics without throwing while migrating, or `security: "off"` only for a deliberately external validation pipeline.

## D.20 — Production tree-shaking proof

The production proof reads the actual route chunks and verifies that development inspectors and unused NENC, EngineModel, Canvas, EngineBrowser, and EngineCookies markers are absent. A separate minimal Next client build selects only the budget evaluator and proves all five optional runtimes disappear together. This tests emitted production JavaScript rather than source imports.

## D.21–D.22 — Device, network, and browser matrix

The automated matrix covers desktop, phone, and tablet viewports; 60, 90, 120, 144, 165, and 240 Hz timing; fast, normal, high-latency, slow, and offline→reconnect delivery; reduced motion; Chromium, Firefox, and WebKit; and an older-browser mode with modern capabilities removed. Responsive tests guard against horizontal overflow and runtime warnings.

Adaptive pressure never reduces image, video, Canvas, Shader, or geometry resolution. It may change layout, postpone dynamic work, pause invisible work, or adjust animation timing.

The production invariant remains strict: debug surfaces are absent from `next build` and `next start`, while unused feature runtimes do not enter route bundles.
