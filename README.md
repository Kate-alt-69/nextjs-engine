# Next.js Engine

**Next.js Engine (NE)** is a schema-driven rendering/runtime layer for React 19 and Next.js 16.

Instead of rebuilding the same rendering, responsive, lazy-loading, navigation, graphics, API, motion, and browser plumbing in every app, NE lets you describe UI as typed schema objects and routes that schema through shared Engine systems.

**Current development / release target:** **NE v2.6.1**  
**Latest stability notes:** [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md)  
**Latest major feature notes:** [`docs/release/NE-v2-6-0.md`](./docs/release/NE-v2-6-0.md)  
**Latest published GitHub release:** [NE v2.5.0](https://github.com/Kate-alt-69/nextjs-engine/releases/tag/Release-v2.5.0)

> v2.6.x is the Shader + Motion + Scroll + Overlay generation of NE. v2.6.1 focuses on React 19 hydration, App Router stability, primitive style correctness, routing consistency, and regression coverage.

---

## What is in the current Engine?

| System | Purpose |
|---|---|
| Schema renderer | Turns `PageSchema` / `SchemaNode` trees into React components |
| Responsive style runtime | Compiles responsive Engine props into CSS variables + media queries |
| Primitive styling | Box, Stack, Grid, Text, Heading, Section, Button, Card, Spacer, Divider |
| Component registry | Built-in, split/lazy, and custom schema node types |
| EngineTransitions+ | 20 page/layout transition presets, shared morphs, programmatic navigation |
| EngineShader | Compiled `.shed` GPU surfaces, render stages, graph scheduling, runtime inputs |
| EngineCanvas | Callback mode, retained 2D, Three.js 3D, SVG, and EngineShader mode |
| EngineSVG | Retained SVG rendering plus ECScene import/export |
| EngineScroll | Points, movement, URL protocol, timelines, ranges, tracking, snapping, Director |
| EngineOverlay | Dialog, Drawer, Popover, focus management, stacking, portals, scroll lock |
| EngineManim | 2D timeline animation and demand-driven 3D model animation |
| EngineImage / Video | Viewport-aware media loading and responsive image behavior |
| EngineBrowser | SSR-safe capability, clipboard, media, speech, network, and interaction helpers |
| EngineForms | Schema-native form controls wired to named handlers |
| EngineMarkdown | Markdown rendering, heading anchors, styling, and safe links |
| EngineNav / Link | Next.js-aware internal routing plus optional Transitions+ navigation |
| EngineAPIResolver | External HTTP/API orchestration, provider config, auth, HMAC/PNP, FormData |
| APIStatic | Compiled browser-side `.route` endpoint programs under `/_static/endpoint` |
| EngineDevice / Mobile | Shared device detection and server-side mobile schema patching |
| Diagnostics | Runtime validation plus deeper analyzer diagnostics |

The public API is exported from [`src/engine/index.ts`](./src/engine/index.ts).

---

## What changed in v2.6?

### EngineTransitions+

Transitions are now a first-class runtime instead of a single page-to-page effect.

Built-in presets:

```text
fade        slide       zoom        morph       layout
reveal      wipe        split       curtain     pixel
dissolve    liquid      smear       depth       flip
page-turn   spring      scatter     rgb         portal
```

Use them from schema links/Nav or programmatically through `useEngineTransitions()`.

Read [`docs/engine-components/enginetransitions.md`](./docs/engine-components/enginetransitions.md).

### EngineShader + `.shed`

NE now has a compiled GPU-surface system.

```shed
shader <= aurora => [
	before.aurora => [
		time <= system.time
		speed => .6
	]
]
```

`.shed` programs can use staged `before`, `render`, `after`, and `overlay` processing, runtime system/pointer/scroll/viewport inputs, build-time validation, render-graph optimization, and demand-aware runtime scheduling.

Read [`docs/engine-components/engineshader.md`](./docs/engine-components/engineshader.md).

### EngineScroll orchestration

EngineScroll now goes far beyond `move()`:

- named points and groups;
- start/center/end/nearest alignment;
- timelines with normalized progress;
- ranges and reusable boundary resolution;
- active/nearest point tracking;
- snapping;
- numeric timeline tracks;
- CSS bindings;
- crossing/activity events;
- `EngineScrollDirector` for coordinating multiple named timelines through one runtime subscription.

Read [`docs/engine-components/enginescroll.md`](./docs/engine-components/enginescroll.md).

### EngineOverlay

The Engine now includes three first-class overlay primitives:

```text
dialog
	dialog / EngineDialog

drawer
	drawer / EngineDrawer

popover
	popover / EnginePopover
```

They share focus handling, top-overlay ownership, Escape behavior, portals, focus restoration, and reference-counted body scroll locking.

Use them to compose sheets, inspectors, confirmation prompts, account menus, dropdowns, and command palettes instead of adding redundant core node types.

Read [`docs/engine-components/engineoverlay.md`](./docs/engine-components/engineoverlay.md).

---

## v2.6.1 stability work

v2.6.1 is the React 19 / Next.js 16 stability patch for the v2.6 generation.

Important fixes and hardening include:

- primitive style precedence now follows `defaults < schema props < style={} < required runtime state`;
- Card defaults no longer silently overwrite schema `bg` / `borderRadius`;
- Button variant defaults no longer defeat schema colors/weight;
- Text/Heading variant typography no longer defeats explicit schema typography;
- EngineShader development hot-polling is serialized and failing hot-reload listeners are isolated;
- hydration-focused fixes are tracked for generated Engine CSS, initially-open overlays, reduced-motion behavior, rewrite-sensitive Nav state, and nested interactive markup;
- route matching is being hardened so `/about` does not incorrectly match `/about-us`;
- primitive/internal routing is being aligned with the same Next.js navigation pipeline used by EngineLink/Nav;
- static Engine stylesheet/keyframe ownership is being tightened for SSR and Fast Refresh;
- real SSR → `hydrateRoot()` coverage is being added so hydration regressions can fail CI.

Full breakdown: [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md).

---

## Repository layout — read this first

This repository uses **four permanent branches across two release streams**.

### `main-2` and `main-3` — workspace / source branches

`main-2` owns the stable NE 2.6.x source and integration workspace. `main-3` owns the Generation 3 compiler/runtime source and integration workspace.

```text
main-2                         main-2-package
main-3                         main-3-package
source/src/engine/  ───────▶   package/engine/
source/docs/        ───────▶   package/docs/
source/DOCUMENT.md  ───────▶   package/DOCUMENT.md
```

### `main-2-package` and `main-3-package` — distributable package branches

Each source branch has an isolated package-sync workflow. Package branches contain the publishable Engine layout rather than the full Next.js development workspace. Package-only metadata remains owned by its matching package branch.

---

## Package entrypoints

Main runtime:

```ts
import {
	createPage,
	defineSchema,
	EngineCanvas,
	EngineScroll,
	EngineDialog,
	EngineDrawer,
	EnginePopover,
	EngineBrowser,
	EngineAPIResolver,
	APIStatic
} from "nextjs-engine"
```

Server-only request helpers:

```ts
import { getServerDevice } from "nextjs-engine/server"
```

Combined Next.js build plugin:

```js
const withEngine = require("nextjs-engine/plugin")

module.exports = withEngine({})
```

Specialized plugin entrypoints remain available for advanced setups:

```js
const withEngineAPI = require("nextjs-engine/api-plugin")
const withEngineShader = require("nextjs-engine/shader-plugin")
```

---

## Quick start

```ts
// app/page.tsx
import { createPage, defineSchema } from "nextjs-engine"

const home = defineSchema({
	meta: {
		title: "My Site",
		description: "Rendered by Next.js Engine"
	},
	root: {
		type: "section",
		props: {
			contentMaxWidth: "1100px",
			px: { xs: "1rem", md: "2rem" },
			py: { xs: "3rem", md: "5rem" }
		},
		children: [
			{
				type: "heading",
				props: {
					level: 1,
					content: "Hello from NE"
				}
			},
			{
				type: "link",
				props: {
					href: "/docs",
					content: "Open docs",
					cprop: {
						link: {
							transition: "reveal"
						}
					}
				}
			}
		]
	}
})

export default createPage({ schema: home })
```

`createPage()` supplies Engine context and the core EngineScroll provider automatically.

For reusable schema-rendered application chrome, use `createComponent()` and named slots.

---

## Responsive styling

Responsive Engine values are generally compiled to CSS instead of reading `window.innerWidth` during component render:

```ts
props: {
	px: { xs: "1rem", md: "2rem", xl: "3rem" },
	columns: { xs: 1, md: 2, lg: 3 },
	bg: { xs: "#111827", md: "#030712" }
}
```

The intended primitive style precedence is:

```text
component defaults
	< schema/direct Engine props
	< explicit style={}
	< required runtime state
```

Full styling reference: [`docs/styling.md`](./docs/styling.md).

---

## APIStatic

APIStatic is NE's browser-executed static endpoint system.

Source:

```text
data/endpoint/**/*.route
```

Compiled output:

```text
public/_static/endpoint/
├── <route>-<stable-hash>.js
└── manifest.json
```

Application code addresses logical endpoint names rather than generated hashes:

```ts
import { APIStatic } from "nextjs-engine"

const response = await APIStatic.resolve(
	"math",
	"add",
	{ a: 20, b: 30 }
)
```

`.route` programs execute in the browser. Do not put secrets, private environment values, database credentials, or server-only session state in them. Use an explicitly configured backend/proxy bridge for trusted work.

Read [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md).

---

## Performance model

Current NE performance work includes:

- lazy module split-points for optional/heavier Engine systems;
- pooled `IntersectionObserver`s;
- shared RAF-coalesced viewport/breakpoint updates;
- responsive CSS instead of JS breakpoint branching for normal style props;
- retained EngineCanvas / EngineSVG / Three.js resources;
- demand-driven Canvas, Shader, Scroll, and Manim scheduling;
- offscreen and hidden-tab pausing;
- bounded responsive resolver caching;
- provider-scoped generated style collection;
- production client-bundle inventory in CI.

NE removes repeated framework plumbing; it cannot make arbitrary expensive application code, huge scenes, or oversized media free.

Read [`docs/runtime-performance.md`](./docs/runtime-performance.md).

---

## Validation and diagnostics

```ts
import {
	analyzeSchema,
	validateSchema
} from "nextjs-engine"

const validation = validateSchema(schema.root)
const analysis = analyzeSchema(schema)
```

The analyzer handles deeper diagnostics including unknown node types, duplicate navigation targets, schema-object reuse, accessibility hints, large/deep trees, mobile-patch ambiguity, and EngineScroll metadata mistakes.

Read [`docs/schema-diagnostics.md`](./docs/schema-diagnostics.md).

---

## Development and CI

Workspace development:

```bash
npm install
npm run type-check
npm run dev
```

Production validation:

```bash
npm run build
```

Current CI coverage includes APIStatic, EngineShader, EngineBrowser SSR safety, EngineTransitions+, EngineScroll, EngineOverlay, primitive/style compiler regressions, TypeScript, a full optimized Next.js integration build, and production bundle reporting.

Hydration-specific SSR → client regression coverage is part of the v2.6.1 stability work.

---

## Documentation

Start at [`docs/index.md`](./docs/index.md).

| Goal | Read |
|---|---|
| Release history | [`docs/release/index.md`](./docs/release/index.md) |
| v2.6.1 stability changes | [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md) |
| v2.6.0 feature release | [`docs/release/NE-v2-6-0.md`](./docs/release/NE-v2-6-0.md) |
| Layouts and primitives | [`docs/engine-components/primitives.md`](./docs/engine-components/primitives.md) |
| Transitions+ | [`docs/engine-components/enginetransitions.md`](./docs/engine-components/enginetransitions.md) |
| EngineShader | [`docs/engine-components/engineshader.md`](./docs/engine-components/engineshader.md) |
| EngineOverlay | [`docs/engine-components/engineoverlay.md`](./docs/engine-components/engineoverlay.md) |
| EngineScroll | [`docs/engine-components/enginescroll.md`](./docs/engine-components/enginescroll.md) |
| Canvas / EC graphics | [`docs/engine-components/enginecanvas.md`](./docs/engine-components/enginecanvas.md) |
| Styling | [`docs/styling.md`](./docs/styling.md) |
| Runtime/performance | [`docs/runtime-performance.md`](./docs/runtime-performance.md) |
| APIStatic | [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md) |
| External APIs | [`docs/engine-components/engineapi.md`](./docs/engine-components/engineapi.md) |
| Diagnostics | [`docs/schema-diagnostics.md`](./docs/schema-diagnostics.md) |

`DOCUMENT.md` is the large technical/history reference. For recently changed behavior, prefer the current TypeScript types and focused docs when an old historical section disagrees.

---

Built by **Kate-alt-69** for the Kastrick platform.
