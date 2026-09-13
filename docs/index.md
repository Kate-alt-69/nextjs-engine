# Next.js Engine — Documentation Index

These docs follow the current `main-3` implementation unless a page explicitly describes an older release.

If a historical example conflicts with the current TypeScript source or a current component page, prefer the current source and current component page.

---

## Start here

| I want to… | Read |
| --- | --- |
| Understand the current Gen 3 stack | [`gen3/overview.md`](./gen3/overview.md) |
| Learn server-first `createPage()` and the compiler plan | [`gen3/phase-a-b.md`](./gen3/phase-a-b.md) |
| Learn schemas, props, and general page authoring | [`readme.md`](./readme.md) |
| Learn styling and responsive props | [`styling.md`](./styling.md) |
| Learn NENC, EngineCookies, sessions, replay/rate policy, and private backends | [`gen3/phase-c-network.md`](./gen3/phase-c-network.md) |
| Learn compatibility manifests and fallback compilation | [`gen3/phase-d-hardening.md`](./gen3/phase-d-hardening.md) |
| Run the device-bound private-search proof | [`gen3/private-search-example.md`](./gen3/private-search-example.md) |
| Read release history | [`release/index.md`](./release/index.md) |
| Read the large historical technical reference | [`../DOCUMENT.md`](../DOCUMENT.md) |

---

## Generation 3 stack

```text
schema
	↓
compilePage()
	↓
execution plan
	├─ static / server / client ownership
	├─ critical / visible / near / deferred / idle / sleeping work
	├─ used-feature manifest
	├─ fallback plan
	├─ assets
	└─ diagnostics
	↓
EngineServerRenderer
	↓
small client islands only where browser behavior is required
	↓
EngineScheduler + EngineViewport + EngineModel
	↓
optional EngineCommand / NENC / EngineCookies / EngineServer boundary
```

The normal Gen 3 page entrypoint is `createPage()`; a separate Gen 3 factory is not required.

Read [`gen3/overview.md`](./gen3/overview.md) first if you are starting a new page or migrating a v2 page.

---

## Page and UI authoring

| Topic | Documentation |
| --- | --- |
| Schema primitives | [`engine-components/primitives.md`](./engine-components/primitives.md) |
| Styling / responsive values | [`styling.md`](./styling.md) |
| Navigation | [`engine-components/enginenav.md`](./engine-components/enginenav.md) |
| Page and layout transitions | [`engine-components/enginetransitions.md`](./engine-components/enginetransitions.md) |
| Heroes | [`engine-components/enginehero.md`](./engine-components/enginehero.md) |
| Forms | [`engine-components/engineforms.md`](./engine-components/engineforms.md) |
| Markdown | [`engine-components/enginemarkdown.md`](./engine-components/enginemarkdown.md) |
| Suspense/loading surfaces | [`engine-components/enginesuspense.md`](./engine-components/enginesuspense.md) |
| Overlay/dialog/drawer/popover | [`engine-components/engineoverlay.md`](./engine-components/engineoverlay.md) |

---

## Graphics and motion

Use the system that owns the job instead of forcing everything through one renderer.

```text
EngineTransitions+
	→ page/layout state changes

EngineScroll
	→ scroll-driven movement and named points

EngineCanvas
	→ retained/immediate graphics surface

EngineSVG
	→ SVG rendering/import/export for ECScene

EngineShader
	→ compiled GPU effects and .shed programs

EngineManim
	→ higher-level animation/model choreography
```

| System | Documentation |
| --- | --- |
| EngineCanvas | [`engine-components/enginecanvas.md`](./engine-components/enginecanvas.md) |
| EngineSVG | [`engine-components/enginesvg.md`](./engine-components/enginesvg.md) |
| EngineShader | [`engine-components/engineshader.md`](./engine-components/engineshader.md) |
| EngineTransitions+ | [`engine-components/enginetransitions.md`](./engine-components/enginetransitions.md) |
| EngineScroll | [`engine-components/enginescroll.md`](./engine-components/enginescroll.md) |
| EngineManim | [`engine-components/enginemanim.md`](./engine-components/enginemanim.md) |
| EngineImage / EngineVideo | [`engine-components/engineimage.md`](./engine-components/engineimage.md) |

EngineTransitions+ and EngineShader remain separate responsibilities. Transition presets such as `pixel`, `liquid`, and `dissolve` are transition animations, not `.shed` framebuffer passes.

---

## Browser/runtime systems

| Topic | Documentation |
| --- | --- |
| Scheduler + server-first compiler | [`gen3/phase-a-b.md`](./gen3/phase-a-b.md) |
| Browser capabilities | [`engine-components/enginebrowser.md`](./engine-components/enginebrowser.md) |
| Device/adaptive layout | [`engine-components/enginemobile.md`](./engine-components/enginemobile.md) |
| Runtime/lazy/performance behavior | [`runtime-performance.md`](./runtime-performance.md) |
| Schema validation and diagnostics | [`schema-diagnostics.md`](./schema-diagnostics.md) |
| Compatibility/fallback compiler | [`gen3/phase-d-hardening.md`](./gen3/phase-d-hardening.md) |

For styling-only responsive differences, prefer responsive schema values/CSS. Use EngineViewport or request-time adaptive compilation only when behavior or structure genuinely depends on live/request device state.

---

## Network and backend systems

| Topic | Documentation |
| --- | --- |
| External API resolver and auth | [`engine-components/engineapi.md`](./engine-components/engineapi.md) |
| Static in-house endpoint programs | [`engine-components/apistatic.md`](./engine-components/apistatic.md) |
| NENC / EngineCookies / sessions / device proof | [`gen3/phase-c-network.md`](./gen3/phase-c-network.md) |
| Private-search end-to-end example | [`gen3/private-search-example.md`](./gen3/private-search-example.md) |

Browser-safe command/cookie APIs belong in `nextjs-engine/network`. Request-aware dispatch, CORS, session policy, and private backend helpers belong in `nextjs-engine/server`.

NENC is optional. Do not enable it merely because it exists; use it when the application has commands that benefit from the compiled single-endpoint boundary.

---

## Release history and compatibility

The maintained release archive lives under [`docs/release`](./release/index.md).

Release notes describe the Engine as it existed at that release. They are not the API contract for `main-3`.

| Version | Release notes |
| --- | --- |
| v2.6.2 | [`NE-v2-6-2.md`](./release/NE-v2-6-2.md) |
| v2.6.1 | [`NE-v2-6-1.md`](./release/NE-v2-6-1.md) |
| v2.6.0 | [`NE-v2-6-0.md`](./release/NE-v2-6-0.md) |
| v2.5.0 | [`NE-v2-5-0.md`](./release/NE-v2-5-0.md) |
| v2.0.0 | [`NE-v2-0-0.md`](./release/NE-v2-0-0.md) |
| v1.0.0 | [`NE-v1-0-0.md`](./release/NE-v1-0-0.md) |

---

## Abbreviations

| Abbreviation | Module |
| --- | --- |
| EC | EngineCanvas |
| ESVG | EngineSVG |
| ESH | EngineShader |
| ET | EngineTransitions+ |
| ES | EngineScroll |
| EB | EngineBrowser |
| EM | EngineManim |
| EMD | EngineMarkdown |
| EN | EngineNav |
| EH | EngineHero |
| ESU | EngineSuspense |
| EF | EngineForms |
| EA | EngineAPI |
| EAS | APIStatic |
| EMO | EngineMobile |
| ED | EngineDevice |
| NENC | Next.js Engine Network Commands |
