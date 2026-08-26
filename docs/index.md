# Next.js Engine — Documentation Index

The component docs below are maintained against the current `src/engine`
implementation. When a legacy example conflicts with a component page, prefer
the component page and current TypeScript types.

## Start here

| I want to… | Read |
|---|---|
| Understand the engine | [`readme.md`](./readme.md) |
| Learn schemas and responsive props | [`readme.md`](./readme.md) |
| Build layouts and controls | [`engine-components/primitives.md`](./engine-components/primitives.md) |
| Understand current runtime/performance behavior | [`runtime-performance.md`](./runtime-performance.md) |

## Engine components

| Component | Documentation | Summary |
|---|---|---|
| Primitives | [`primitives.md`](./engine-components/primitives.md) | Box, Stack, Grid, Text, Heading, Button, Card, Section, Slot |
| EngineCanvas | [`enginecanvas.md`](./engine-components/enginecanvas.md) | Canvas lifecycle, adaptive DPR, EC 2D/3D/SVG runtime |
| EngineScroll | [`enginescroll.md`](./engine-components/enginescroll.md) | Point navigation, URL protocol, one-RAF scheduler |
| EngineBrowser | [`enginebrowser.md`](./engine-components/enginebrowser.md) | Browser capabilities and interaction APIs |
| EngineManim | [`enginemanim.md`](./engine-components/enginemanim.md) | 2D animation and Three.js 3D model animation |
| EngineImage / Video | [`engineimage.md`](./engine-components/engineimage.md) | Viewport-aware media and responsive image quality |
| EngineMarkdown | [`enginemarkdown.md`](./engine-components/enginemarkdown.md) | Markdown rendering and heading anchors |
| EngineNav | [`enginenav.md`](./engine-components/enginenav.md) | Navigation bar and menus |
| EngineHero | [`enginehero.md`](./engine-components/enginehero.md) | Centered/split/full-bleed heroes and parallax |
| EngineSuspense | [`enginesuspense.md`](./engine-components/enginesuspense.md) | Loading fallbacks and suspense helpers |
| EngineForms | [`engineforms.md`](./engine-components/engineforms.md) | Native form primitives and named handlers |
| EngineAPI | [`engineapi.md`](./engine-components/engineapi.md) | Request resolver, auth, `.api` configuration |
| EngineMobile / Device | [`enginemobile.md`](./engine-components/enginemobile.md) | Server schema patching and device detection |

## Abbreviations

| Abbreviation | Module |
|---|---|
| EC | EngineCanvas |
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
| EMO | EngineMobile |
| ED | EngineDevice |
