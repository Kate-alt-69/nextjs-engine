# Generation 3 Phase D — Compatibility, debug, and hardening

> Branch: `main-3`
>
> Status: D.1–D.3 compatibility compiler and legacy-render plan complete

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

## Phase D implementation order

1. D.4 browser compatibility dialog;
2. D.5–D.15 dev-only EngineDebug and compiler explanations;
3. D.16–D.17 incremental compilation and HMR integration;
4. D.18 build budgets;
5. D.19 static security diagnostics;
6. D.20 production tree-shaking proofs;
7. D.21–D.22 device, network, browser, torture, and visual tests.

The production invariant remains strict: debug surfaces must be absent from `next build` and `next start`, while unused feature runtimes must not enter production bundles.
