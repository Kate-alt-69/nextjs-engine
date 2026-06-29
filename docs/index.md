# Next.js Engine — Documentation Index

## Where to start

| I want to… | Read |
|------------|------|
| Understand what the engine is | [`readme.md`](./readme.md#what-it-is) |
| Learn the schema system | [`readme.md → Schema Node Reference`](./readme.md#schema-node-reference) |
| Understand PROP vs CPROP | [`readme.md → cprop`](./readme.md#cprop--custom-css-props) |
| Set up a new page | [`readme.md → createPage API`](./readme.md#createpage-api) |
| Use responsive values | [`readme.md → Responsive System`](./readme.md#responsive-system) |

---

## Engine Components

| File | Component | Short description |
|------|-----------|-------------------|
| [`primitives.md`](./engine-components/primitives.md) | Box, Stack, Grid, Text, Heading, Card, Link, Section, Slot | Core layout building blocks |
| [`enginecanvas.md`](./engine-components/enginecanvas.md) | EC — EngineCanvas | GPU canvas with RAF loop, adaptive DPR, pause-when-offscreen |
| [`enginescroll.md`](./engine-components/enginescroll.md) | ES — EngineScroll | Point navigation, URL protocol (`#-es?`), `useEngineScroll` hook |
| [`enginebrowser.md`](./engine-components/enginebrowser.md) | EB — EngineBrowser | Browser detection, clipboard, media, speech, network |
| [`enginemanim.md`](./engine-components/enginemanim.md) | EM — EngineManim | 2D Manim-style animation + Three.js 3D renderer |
| [`engineimage.md`](./engine-components/engineimage.md) | EI — EngineImage / EngineVideo | Lazy image (AVIF/WebP blur-up) + lazy video |
| [`enginemarkdown.md`](./engine-components/enginemarkdown.md) | EMD — EngineMarkdown | Markdown with animations and heading scroll anchors |
| [`enginenav.md`](./engine-components/enginenav.md) | EN — EngineNav | Nav bar, sticky, logo, dropdowns, mobile hamburger |
| [`enginehero.md`](./engine-components/enginehero.md) | EH — EngineHero | Hero sections — centered, split, fullbleed, parallax |
| [`enginesuspense.md`](./engine-components/enginesuspense.md) | ESU — EngineSuspense | Suspense with skeleton / shimmer / spinner / pulse / blur |
| [`engineforms.md`](./engine-components/engineforms.md) | EF — EngineForms | Form, Input, Textarea, Checkbox, Label |
| [`engineapi.md`](./engine-components/engineapi.md) | EA — EngineAPI | EngineAPIResolver + `.EngineAPIConfig` file format |
| [`enginemobile.md`](./engine-components/enginemobile.md) | EMO — EngineMobile | Server-side UA patching + EngineDevice detection |
| [`enginebrowser.md`](./engine-components/enginebrowser.md) | EB — EngineBrowser | Clipboard, interactions, media, speech, network |

---

## Quick abbreviation guide

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
