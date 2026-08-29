# Next.js Engine

**Next.js Engine (NE)** is a schema-driven rendering/runtime layer for React 19 and Next.js 16.

This is the **distributable `main-empty` package branch**. The development workspace and Engine source of truth live on [`main`](https://github.com/Kate-alt-69/nextjs-engine/tree/main) under `src/engine/`.

**Current development / release target:** **NE v2.6.1**  
**Latest stability notes:** [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md)  
**Latest major feature notes:** [`docs/release/NE-v2-6-0.md`](./docs/release/NE-v2-6-0.md)  
**Latest published GitHub release:** [NE v2.5.0](https://github.com/Kate-alt-69/nextjs-engine/releases/tag/Release-v2.5.0)

> v2.6.x is the Shader + Motion + Scroll + Overlay generation of NE. v2.6.1 focuses on React 19 hydration, App Router stability, primitive style correctness, routing consistency, and regression coverage.

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

Specialized plugin entrypoints are also available:

```js
const withEngineAPI = require("nextjs-engine/api-plugin")
const withEngineShader = require("nextjs-engine/shader-plugin")
```

The server entrypoint keeps request-only Next.js APIs such as `next/headers` out of the universal/browser graph.

---

## What is included?

| System | Package capability |
|---|---|
| Schema renderer | Typed `PageSchema` / `SchemaNode` rendering |
| Responsive style runtime | CSS-variable/media-query responsive values |
| Primitives | Box, Stack, Grid, Text, Heading, Section, Button, Card, Spacer, Divider |
| EngineTransitions+ | 20 transition presets, shared morphs, programmatic navigation |
| EngineShader | Compiled `.shed` GPU surfaces and runtime scheduling |
| EngineCanvas | Callback, retained 2D, Three.js 3D, SVG, Shader mode |
| EngineSVG | Retained SVG rendering and ECScene import/export |
| EngineScroll | Points, movement, timelines, ranges, trackers, snapping, Director |
| EngineOverlay | Dialog, Drawer, Popover, focus/stack/portal/scroll-lock runtime |
| EngineManim | 2D timeline animation and demand-driven 3D model animation |
| EngineImage / Video | Viewport-aware media loading |
| EngineNav / Link | Next.js-aware internal routing and optional Transitions+ |
| EngineMarkdown | Markdown rendering and heading anchors |
| EngineForms | Schema-native controls and named handlers |
| EngineBrowser | SSR-safe browser capability and interaction APIs |
| EngineDevice / Mobile | Shared/client detection plus server request helpers |
| EngineAPIResolver | External provider APIs, auth, HMAC/PNP, FormData |
| APIStatic | Compiled browser `.route` endpoint programs |
| Diagnostics | Runtime validation plus deeper analyzer diagnostics |

---

## v2.6 highlights

### EngineTransitions+

Current preset set:

```text
fade        slide       zoom        morph       layout
reveal      wipe        split       curtain     pixel
dissolve    liquid      smear       depth       flip
page-turn   spring      scatter     rgb         portal
```

Read [`docs/engine-components/enginetransitions.md`](./docs/engine-components/enginetransitions.md).

### EngineShader

Shader sources use the `.shed` extension and compile into static shader artifacts during the Next.js build.

```shed
shader <= aurora => [
	before.aurora => [
		time <= system.time
		speed => .6
	]
]
```

Read [`docs/engine-components/engineshader.md`](./docs/engine-components/engineshader.md).

### EngineScroll orchestration

EngineScroll now includes named points/groups, alignment, timelines, ranges, point tracking, snapping, CSS bindings, crossing/activity events, and `EngineScrollDirector` for coordinating multiple timelines through shared runtime work.

Read [`docs/engine-components/enginescroll.md`](./docs/engine-components/enginescroll.md).

### EngineOverlay

First-class schema/component primitives:

```text
dialog / EngineDialog
drawer / EngineDrawer
popover / EnginePopover
```

These share focus behavior, top-overlay ownership, portals, Escape handling, focus restoration, and body scroll locking.

Read [`docs/engine-components/engineoverlay.md`](./docs/engine-components/engineoverlay.md).

---

## v2.6.1 stability work

v2.6.1 is the React 19 / Next.js 16 stability patch for the v2.6 generation.

Current release work includes:

- fixed primitive style precedence so Card/Button/Text defaults no longer defeat schema styling;
- explicit style priority of `defaults < schema props < style={} < required runtime state`;
- EngineShader hot-reload polling serialization and failing-listener isolation;
- hydration-focused hardening for generated Engine CSS and nested Engine boundaries;
- initially-open Overlay hydration work;
- reduced-motion hydration hardening;
- rewrite-sensitive EngineNav active-state hardening;
- stricter route-segment matching;
- internal primitive routing alignment with Next.js navigation;
- nested interactive markup diagnostics/protection;
- Engine stylesheet/keyframe ownership cleanup for SSR and Fast Refresh;
- real SSR → `hydrateRoot()` regression coverage as part of the v2.6.1 stability pass.

Full breakdown: [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md).

---

## Quick start

```ts
// app/page.tsx
import { createPage, defineSchema } from "nextjs-engine"

const home = defineSchema({
	meta: {
		title: "My Site"
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

Responsive values are normally compiled to CSS variables/media queries, so normal breakpoint switching is handled by CSS instead of viewport branching during render.

---

## APIStatic

APIStatic compiles NE-owned browser endpoint programs from:

```text
data/endpoint/**/*.route
```

The compiler publishes logical route artifacts and a manifest under:

```text
public/_static/endpoint/
├── <route>-<stable-hash>.js
└── manifest.json
```

Application code calls logical names:

```ts
import { APIStatic } from "nextjs-engine"

const response = await APIStatic.resolve(
	"math",
	"add",
	{ a: 20, b: 30 }
)
```

`.route` programs execute in the browser. **Do not put secrets or server-only state in them.** Use a configured backend/proxy bridge for trusted work.

Read [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md).

---

## Package layout

```text
nextjs-engine/
├── engine/
│   ├── components/
│   │   ├── EngineOverlay/
│   │   └── EngineManim/
│   ├── core/
│   │   ├── enginecanvas/
│   │   ├── enginescroll/
│   │   ├── engineshader/
│   │   ├── enginetransitions/
│   │   └── engineoverlay/
│   ├── hooks/
│   ├── plugins/
│   ├── providers/
│   ├── schema/
│   ├── createPage.tsx
│   ├── server.ts
│   └── index.ts
├── docs/
│   ├── engine-components/
│   └── release/
├── DOCUMENT.md
├── index.ts
├── package.json
└── README.md
```

The `main` workspace synchronizes validated Engine source and docs into this package branch while preserving package-owned metadata.

---

## Performance model

Current NE performance work includes:

- lazy split-points for optional/heavier systems;
- pooled viewport observers;
- shared RAF-coalesced breakpoint updates;
- responsive CSS instead of JS breakpoint branching for normal styles;
- retained Canvas / SVG / Three.js resources;
- demand-driven Canvas, Shader, Scroll, and Manim work;
- offscreen and hidden-tab pausing;
- bounded responsive resolver caching;
- provider-scoped generated style collection;
- production client-bundle reporting in CI.

NE automates repeated framework plumbing, but arbitrary application code, custom callbacks, giant scenes, and oversized media can still dominate performance.

Read [`docs/runtime-performance.md`](./docs/runtime-performance.md).

---

## Documentation

Start at [`docs/index.md`](./docs/index.md).

| Goal | Read |
|---|---|
| Release history | [`docs/release/index.md`](./docs/release/index.md) |
| v2.6.1 stability changes | [`docs/release/NE-v2-6-1.md`](./docs/release/NE-v2-6-1.md) |
| v2.6.0 feature release | [`docs/release/NE-v2-6-0.md`](./docs/release/NE-v2-6-0.md) |
| Primitives | [`docs/engine-components/primitives.md`](./docs/engine-components/primitives.md) |
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

When an old section of `DOCUMENT.md` disagrees with a focused current doc or the TypeScript types, prefer the focused current doc/types.

---

Built by **Kate-alt-69** for the Kastrick platform.
