# Next.js Engine — Documentation Index

These docs are maintained against the current `src/engine` implementation.

`DOCUMENT.md` is the large historical/technical reference. When an older example in `DOCUMENT.md` conflicts with a component page here or with the current TypeScript types, prefer the component page and current source types.

---

## Start here

| I want to… | Read |
|---|---|
| Understand what NE is | [`readme.md`](./readme.md) |
| Learn schemas / `createPage()` | [`readme.md`](./readme.md) |
| Learn styling and responsive props | [`styling.md`](./styling.md) |
| Add page/layout transitions | [`engine-components/enginetransitions.md`](./engine-components/enginetransitions.md) |
| Write `.shed` GPU effects | [`engine-components/engineshader.md`](./engine-components/engineshader.md) |
| Draw with Canvas / ECScene / shader mode | [`engine-components/enginecanvas.md`](./engine-components/enginecanvas.md) |
| Render/import/export SVG from ECScene | [`engine-components/enginesvg.md`](./engine-components/enginesvg.md) |
| Add scroll points / programmatic scrolling | [`engine-components/enginescroll.md`](./engine-components/enginescroll.md) |
| Validate/analyze schemas | [`schema-diagnostics.md`](./schema-diagnostics.md) |
| Build layouts and controls | [`engine-components/primitives.md`](./engine-components/primitives.md) |
| Build in-house static APIs | [`engine-components/apistatic.md`](./engine-components/apistatic.md) |
| Configure/call external APIs | [`engine-components/engineapi.md`](./engine-components/engineapi.md) |
| Understand current runtime/performance behavior | [`runtime-performance.md`](./runtime-performance.md) |

---

## Visual systems — which one do I use?

NE now has several visual/motion systems. They solve different jobs.

```text
EngineTransitions+
	→ how UI/page state A changes into state B

EngineScroll
	→ movement/navigation driven by scroll position or named points

EngineCanvas
	→ canvas lifecycle + EC graphics surface

EngineSVG
	→ SVG renderer/import/export for ECScene

EngineShader
	→ compiled GPU-owned visual surfaces and `.shed` effects
```

### If you want a page change animation

Use **EngineTransitions+**.

```ts
cprop: {
	link: {
		transition: "portal",
	},
}
```

It currently ships 20 named presets and shared-element morph support.

Read: [`enginetransitions.md`](./engine-components/enginetransitions.md).

### If you want a GPU effect/background

Use **EngineShader** and write a `.shed` file.

```shed
shader <= aurora => [
	before.aurora => [
		time <= system.time
		speed => .6
	]
]
```

Then:

```ts
{
	type: "section",
	props: {
		shader: "aurora",
	},
}
```

Read: [`engineshader.md`](./engine-components/engineshader.md).

### If you want your own drawing/scene

Use **EngineCanvas**.

```ts
{
	type: "canvas",
	props: {
		graphics: {
			engine: "2d",
			scene,
		},
	},
}
```

Read: [`enginecanvas.md`](./engine-components/enginecanvas.md).

### If you want SVG output from an ECScene

Use the **EngineSVG** graphics engine.

```ts
graphics: {
	engine: "svg",
	scene,
}
```

Read: [`enginesvg.md`](./engine-components/enginesvg.md).

---

## Current shader/transition boundary

EngineTransitions+ and EngineShader are designed so they can integrate more deeply later, but their current responsibilities are intentionally separate:

```text
EngineTransitions+
	→ native View Transition snapshots + preset animation

EngineShader
	→ GPU surfaces owned by ESH / EngineCanvas shader mode
```

Transition names such as `pixel`, `liquid`, and `dissolve` are currently native snapshot animations, **not** `.shed` framebuffer passes.

Likewise, the planned whole-page Minecraft-shader-like global compositor / `styles.shed` direction is not a current surface ESH API yet. Current `.shed` programs attach to supported Engine surfaces or EngineCanvas shader mode.

The docs call out future/reserved APIs clearly so examples do not pretend an unimplemented compositor already exists.

---

## Engine components and systems

| Component / system | Documentation | Summary |
|---|---|---|
| Primitives | [`primitives.md`](./engine-components/primitives.md) | Box, Stack, Grid, Text, Heading, Button, Card, Section, Slot |
| EngineCanvas | [`enginecanvas.md`](./engine-components/enginecanvas.md) | callback mode, EC graphics engines, adaptive DPR, EngineShader mode |
| EngineSVG | [`enginesvg.md`](./engine-components/enginesvg.md) | retained SVG renderer, EC topology, SVG import/export |
| EngineShader | [`engineshader.md`](./engine-components/engineshader.md) | `.shed` language, compiler, GPU surfaces, stages, render graph, scheduling |
| EngineTransitions+ | [`enginetransitions.md`](./engine-components/enginetransitions.md) | 20 page/layout presets, shared morphs, programmatic transitions |
| EngineScroll | [`enginescroll.md`](./engine-components/enginescroll.md) | point navigation, URL protocol, one-RAF scheduler |
| EngineBrowser | [`enginebrowser.md`](./engine-components/enginebrowser.md) | browser capabilities and interaction APIs |
| EngineManim | [`enginemanim.md`](./engine-components/enginemanim.md) | 2D animation and demand-driven Three.js 3D model animation |
| EngineImage / Video | [`engineimage.md`](./engine-components/engineimage.md) | viewport-aware media and responsive image quality |
| EngineMarkdown | [`enginemarkdown.md`](./engine-components/enginemarkdown.md) | Markdown rendering and heading anchors |
| EngineNav | [`enginenav.md`](./engine-components/enginenav.md) | navigation bar, normal/animated routing pipeline, menus |
| EngineHero | [`enginehero.md`](./engine-components/enginehero.md) | centered/split/full-bleed heroes, backgrounds, parallax |
| EngineSuspense | [`enginesuspense.md`](./engine-components/enginesuspense.md) | loading fallbacks and suspense helpers |
| EngineForms | [`engineforms.md`](./engine-components/engineforms.md) | native form primitives and named handlers |
| EngineAPI | [`engineapi.md`](./engine-components/engineapi.md) | HTTP request resolver, auth, `.api` provider configuration |
| APIStatic | [`apistatic.md`](./engine-components/apistatic.md) | `data/endpoint/**/*.route`, endpoint DSL, discovery manifest, static resolver facade |
| EngineMobile / Device | [`enginemobile.md`](./engine-components/enginemobile.md) | server schema patching and device detection |

---

## Cross-cutting references

| Topic | Documentation |
|---|---|
| Styling, responsive values, at-rules, pseudo states | [`styling.md`](./styling.md) |
| Page/layout transitions and shared morphs | [`engine-components/enginetransitions.md`](./engine-components/enginetransitions.md) |
| GPU `.shed` language and surface pipeline | [`engine-components/engineshader.md`](./engine-components/engineshader.md) |
| Canvas modes and rendering engines | [`engine-components/enginecanvas.md`](./engine-components/enginecanvas.md) |
| SVG geometry/import/export | [`engine-components/enginesvg.md`](./engine-components/enginesvg.md) |
| Schema validation/analyzer codes and scope | [`schema-diagnostics.md`](./schema-diagnostics.md) |
| Runtime, lazy behavior, bundle/runtime performance | [`runtime-performance.md`](./runtime-performance.md) |
| External API providers and resolver auth | [`engine-components/engineapi.md`](./engine-components/engineapi.md) |
| Static in-house endpoint programs | [`engine-components/apistatic.md`](./engine-components/apistatic.md) |

---

## Abbreviations

| Abbreviation | Module |
|---|---|
| EC | EngineCanvas |
| ESVG | EngineSVG |
| ESH | EngineShader |
| ET | EngineTransitions+ |
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
