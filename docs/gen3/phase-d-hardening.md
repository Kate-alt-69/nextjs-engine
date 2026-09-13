# Generation 3 Phase D — Compatibility, debug, and hardening

> Branch: `main-3`
>
> Status: D.1 used-feature manifest complete

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

## Phase D implementation order

1. D.2 fallback compiler and D.3 best-effort legacy rendering;
2. D.4 browser compatibility dialog;
3. D.5–D.15 dev-only EngineDebug and compiler explanations;
4. D.16–D.17 incremental compilation and HMR integration;
5. D.18 build budgets;
6. D.19 static security diagnostics;
7. D.20 production tree-shaking proofs;
8. D.21–D.22 device, network, browser, torture, and visual tests.

The production invariant remains strict: debug surfaces must be absent from `next build` and `next start`, while unused feature runtimes must not enter production bundles.
