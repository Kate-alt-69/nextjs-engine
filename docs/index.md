# Next.js Engine — Documentation Index

The component docs below are maintained against the current `src/engine`
implementation. When a legacy example conflicts with a component page, prefer
the component page and current TypeScript types.

## Start here

| I want to… | Read |
|---|---|
| Understand the engine | [`readme.md`](./readme.md) |
| Learn schemas | [`readme.md`](./readme.md) |
| Learn styling and responsive props | [`styling.md`](./styling.md) |
| Validate/analyze schemas | [`schema-diagnostics.md`](./schema-diagnostics.md) |
| Build layouts and controls | [`engine-components/primitives.md`](./engine-components/primitives.md) |
| Build GPU shader surfaces | [`engine-components/engineshader.md`](./engine-components/engineshader.md) |
| Build in-house static APIs | [`engine-components/apistatic.md`](./engine-components/apistatic.md) |
| Configure/call external APIs | [`engine-components/engineapi.md`](./engine-components/engineapi.md) |
| Understand current runtime/performance behavior | [`runtime-performance.md`](./runtime-performance.md) |

## Engine components

| Component | Documentation | Summary |
|---|---|---|
| Primitives | [`primitives.md`](./engine-components/primitives.md) | Box, Stack, Grid, Text, Heading, Button, Card, Section, Slot |
| EngineCanvas | [`enginecanvas.md`](./engine-components/enginecanvas.md) | Canvas lifecycle, adaptive DPR, EC 2D/3D/SVG runtime |
| EngineShader | [`engineshader.md`](./engine-components/engineshader.md) | `.shed` language, `.shed.dat` compiler, GPU surfaces, automatic execution modes |
| EngineScroll | [`enginescroll.md`](./engine-components/enginescroll.md) | Point navigation, URL protocol, one-RAF scheduler |
| EngineBrowser | [`enginebrowser.md`](./engine-components/enginebrowser.md) | Browser capabilities and interaction APIs |
| EngineManim | [`enginemanim.md`](./engine-components/enginemanim.md) | 2D animation and demand-driven Three.js 3D model animation |
| EngineImage / Video | [`engineimage.md`](./engine-components/engineimage.md) | Viewport-aware media and responsive image quality |
| EngineMarkdown | [`enginemarkdown.md`](./engine-components/enginemarkdown.md) | Markdown rendering and heading anchors |
| EngineNav | [`enginenav.md`](./engine-components/enginenav.md) | Navigation bar, routing pipeline, menus |
| EngineHero | [`enginehero.md`](./engine-components/enginehero.md) | Centered/split/full-bleed heroes, responsive backgrounds, parallax |
| EngineSuspense | [`enginesuspense.md`](./engine-components/enginesuspense.md) | Loading fallbacks and suspense helpers |
| EngineForms | [`engineforms.md`](./engine-components/engineforms.md) | Native form primitives and named handlers |
| EngineAPI | [`engineapi.md`](./engine-components/engineapi.md) | HTTP request resolver, auth, `.api` provider configuration |
| APIStatic | [`apistatic.md`](./engine-components/apistatic.md) | `data/endpoint/**/*.route`, endpoint DSL, discovery manifest, static resolver facade |
| EngineMobile / Device | [`enginemobile.md`](./engine-components/enginemobile.md) | Server schema patching and device detection |

## Cross-cutting references

| Topic | Documentation |
|---|---|
| Styling, responsive values, at-rules, pseudo states | [`styling.md`](./styling.md) |
| Schema validation/analyzer codes and scope | [`schema-diagnostics.md`](./schema-diagnostics.md) |
| Runtime, lazy behavior, bundle/runtime performance | [`runtime-performance.md`](./runtime-performance.md) |
| GPU surfaces, `.shed` compilation and render scheduling | [`engine-components/engineshader.md`](./engine-components/engineshader.md) |
| External API providers and resolver auth | [`engine-components/engineapi.md`](./engine-components/engineapi.md) |
| Static in-house endpoint programs | [`engine-components/apistatic.md`](./engine-components/apistatic.md) |

## Abbreviations

| Abbreviation | Module |
|---|---|
| EC | EngineCanvas |
| ESH | EngineShader |
| ES | EngineScroll |
| EB | EngineBrowser |
| EM | EngineManim |
| EI | EngineImage |
| EMD | EngineMarkdown |
| EN | EngineNav |
| EH | EngineHero |
| ESU | EngineSuspense |
| EF | EngineForms |
| EA | EngineAPI |
| EAS | APIStatic |
| EMO | EngineMobile |
| ED | EngineDevice |
