# Next.js Engine

**Next.js Engine (NE)** is a schema-driven rendering/runtime layer for React 19 and Next.js 16.

Instead of building every page directly from JSX, NE lets you describe UI as typed schema objects and routes that schema through shared rendering, responsive styling, lazy loading, navigation, graphics, media, forms, diagnostics, browser helpers, and API tooling.

**Current release:** [NE v2.5.0](https://github.com/Kate-alt-69/nextjs-engine/releases/tag/Release-v2.5.0)

> NE automates a lot of repeated rendering and performance work, but it is not a magic optimizer. Large scenes, expensive callbacks, oversized media, application code, and custom components can still dominate performance. See [`docs/runtime-performance.md`](./docs/runtime-performance.md) for the current runtime contract.

---

## What is in v2.5?

The engine currently includes:

| System | Purpose |
|---|---|
| Schema renderer | Turns `PageSchema` / `SchemaNode` trees into React components |
| Responsive style runtime | Converts responsive engine props into CSS variables + media queries |
| Component registry | Built-in and custom schema node types |
| EngineCanvas | Retained 2D, Three.js 3D, and SVG graphics runtime |
| EngineManim | 2D timeline animation and demand-driven 3D model animation |
| EngineScroll | Named points, smooth movement, URL protocol, one-RAF scheduler |
| EngineImage / Video | Viewport-aware media loading and responsive image quality |
| EngineBrowser | SSR-safe browser capability, media, clipboard, speech, network, and interaction helpers |
| EngineForms | Schema-native form controls wired to named handlers |
| EngineMarkdown | Markdown rendering, heading anchors, styling, and safe links |
| EngineAPIResolver | External HTTP/API orchestration, auth, provider config, HMAC/PNP, FormData |
| APIStatic | Compiled browser-side `.route` endpoint programs under `/_static/endpoint` |
| EngineDevice / Mobile | Shared device detection and server-side mobile schema patching |
| Diagnostics | Lightweight validation plus deeper analyzer diagnostics |

The public API is exported from [`src/engine/index.ts`](./src/engine/index.ts).

---

## Repository layout — read this first

This repository intentionally has **two branches with different jobs**.

### `main` — engine workspace / source of truth

`main` is where NE is developed and tested.

```text
nextjs-engine/
├── app/                         Next.js integration/demo app used by the workspace
├── src/
│   └── engine/                  ← ENGINE SOURCE OF TRUTH
│       ├── components/          React components and schema primitives
│       │   └── EngineManim/     2D + 3D animation runtime
│       ├── core/                Core runtimes and infrastructure
│       │   ├── enginecanvas/    EC scene model + 2D / 3D / SVG renderers
│       │   ├── enginescroll/    ES scheduler, navigation, points, viewport, URL protocol
│       │   ├── APIStatic.ts     Browser-side static endpoint runtime
│       │   ├── EngineAPIResolver.ts
│       │   ├── EngineAPIConfigParser.ts
│       │   ├── EngineBrowserSafe.ts
│       │   ├── EngineDevice*.ts
│       │   ├── EngineMobilePatcher.ts
│       │   ├── SchemaRenderer.tsx
│       │   ├── StyleCollector.ts
│       │   ├── schemaAnalyzer.ts
│       │   └── validateSchema.ts
│       ├── hooks/               Styling + pooled viewport hooks
│       ├── plugins/             EngineAPI / APIStatic Next.js build plugin
│       ├── providers/           Engine React context
│       ├── schema/              Public schema/type definitions
│       ├── createPage.tsx       Page/component factory
│       ├── server.ts            Server-only public entrypoint
│       └── index.ts             Main public entrypoint
├── docs/                        Maintained current documentation
│   ├── engine-components/       Component/system references
│   ├── styling.md
│   ├── runtime-performance.md
│   └── schema-diagnostics.md
├── scripts/                     CI smoke/regression tests
├── .github/workflows/           Runtime CI + package synchronization
├── DOCUMENT.md                  Large historical/technical reference
└── README.md                    You are here
```

### `main-empty` — distributable package branch

`main-empty` is the package-shaped branch. It does **not** mirror the whole development workspace.

The sync workflow copies validated engine source and docs from `main` into its package layout:

```text
main                         main-empty
──────────────               ─────────────────
src/engine/       ───────▶   engine/
docs/             ───────▶   docs/
DOCUMENT.md       ───────▶   DOCUMENT.md
                             package.json
                             index.ts
```

Package-only metadata stays owned by `main-empty`.

The package exposes three important entrypoints:

```ts
import { createPage, APIStatic, EngineCanvas } from "nextjs-engine"
import { getServerDevice } from "nextjs-engine/server"
const withEngineAPI = require("nextjs-engine/plugin")
```

Every relevant source/docs push to `main` runs validation before the package branch is synchronized.

---

## Quick start — schema page

If you are working directly from this repository or vendoring `src/engine`, point an alias at the engine entrypoint:

```json
{
	"compilerOptions": {
		"paths": {
			"@/engine": ["./src/engine/index.ts"]
		}
	}
}
```

Then define a page:

```ts
// app/page.tsx
import { createPage, defineSchema } from "@/engine"

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
					content: "Hello from NE",
					align: "center"
				}
			},
			{
				type: "button",
				props: {
					label: "Do something",
					onClick: "doSomething"
				}
			}
		]
	}
})

export default createPage({
	schema: home,
	handlers: {
		doSomething: () => console.log("clicked")
	}
})
```

`createPage()` supplies the engine context and the core EngineScroll provider automatically.

For reusable schema pieces, use `createComponent()`. For ordinary React content inside schema trees, use named slots.

---

## Responsive styling

Responsive engine props are normally handled in CSS rather than by reading `window.innerWidth` in every component:

```ts
props: {
	px: { xs: "1rem", md: "2rem", xl: "3rem" },
	columns: { xs: 1, md: 2, lg: 3 },
	bg: { xs: "#111827", md: "#030712" }
}
```

The engine emits CSS variables/media rules with base-value fallbacks so the browser performs breakpoint selection.

Not every CSS property is automatically responsive just because it exists in `CSSProperties`; the TypeScript types are the contract.

Full styling reference: [`docs/styling.md`](./docs/styling.md).

---

## APIStatic quick guide

APIStatic is NE's browser-executed static endpoint system.

Create a route:

```text
data/endpoint/math.route
```

```ts
function add(a: number, b: number) {
	return a + b
}

createEndpoint([
	{
		name: "add"
		query: {
			a: "number"
			b: "number"
		}
		run.query(add[query.a, query.b])
	}
])
```

Enable the plugin in a package-based app:

```js
// next.config.js
const withEngineAPI = require("nextjs-engine/plugin")

module.exports = withEngineAPI({})
```

Or from the source workspace:

```js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin")

module.exports = withEngineAPI({})
```

The compiler generates stable endpoint modules and a manifest under:

```text
public/_static/endpoint/
├── math-<stable-route-hash>.js
└── manifest.json
```

Application code uses logical names, not generated hashes:

```ts
import { APIStatic } from "nextjs-engine"

const response = await APIStatic.resolve(
	"math",
	"add",
	{ a: 20, b: 30 }
)
```

APIStatic currently supports typed/coerced inputs, defaults, optional fields, multiple operations, `run.query`, `run.body`, `run.input`, `run.proxy`, normal async functions/fetch, explicit `response(...)`, controlled `error(...)`, endpoint discovery, development watching, scope-aware compilation, and last-known-good atomic endpoint + manifest publication.

**Important:** `.route` programs run in the browser. Do not put secrets, private environment values, database credentials, or server-only session state in them. Use an explicitly configured `proxy()` bridge when an operation must cross into a trusted backend.

Full guide: [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md).

---

## External APIs vs APIStatic

They solve different problems:

```text
EngineAPIResolver
└── external/provider HTTP APIs
	├── auth
	├── provider configuration
	├── request overrides
	├── HMAC / PNP
	├── FormData
	└── .EngineAPIConfig/*.api

APIStatic
└── NE-owned browser endpoint programs
	├── data/endpoint/**/*.route
	├── static compiled JavaScript
	├── manifest discovery
	└── optional backend proxy bridge
```

Read [`engineapi.md`](./docs/engine-components/engineapi.md) for external API/provider configuration.

---

## Graphics and animation

### EngineCanvas

`EngineCanvas` is the graphics host. Its current V2 runtime lives under `src/engine/core/enginecanvas/` and supports retained 2D, Three.js 3D, and SVG rendering.

The runtime includes offscreen/hidden-tab pausing, demand-aware RAF behavior, adaptive DPR, retained geometry/output objects, and dynamic loading of selected graphics engines.

Read [`enginecanvas.md`](./docs/engine-components/enginecanvas.md).

### EngineManim

EngineManim builds animation behavior on top of NE's rendering stack:

- Manim2D compiles shape/timeline work outside hot RAF paths where possible;
- finite animations can release RAF when complete;
- Manim3D loads Three.js/model loaders on demand and pauses while hidden/offscreen.

Read [`enginemanim.md`](./docs/engine-components/enginemanim.md).

---

## EngineScroll

Every `createPage()` page is wrapped in the core EngineScroll provider.

Schema nodes can expose semantic scroll points:

```ts
{
	type: "section",
	props: {
		id: "pricing-section",
		point: "pricing"
	}
}
```

`id` and `point` may be different names for the same mounted element.

```ts
const scroll = useEngineScroll()
scroll.move("pricing")
```

EngineScroll owns named-point resolution, movement, offset/duration handling, URL protocol support, and its shared RAF scheduler.

Read [`enginescroll.md`](./docs/engine-components/enginescroll.md).

---

## Browser and server-only APIs

The normal root entrypoint exports the SSR-safe EngineBrowser facade and shared/client device helpers:

```ts
import {
	EngineBrowser,
	detectDevice,
	useMobileDevice
} from "nextjs-engine"
```

Request-aware helpers stay behind the server entrypoint so `next/headers` is not pulled into browser code:

```ts
import { getServerDevice } from "nextjs-engine/server"
```

Read [`enginebrowser.md`](./docs/engine-components/enginebrowser.md) and [`enginemobile.md`](./docs/engine-components/enginemobile.md).

---

## Performance model

Current NE performance work includes:

- lazy module boundaries for optional/heavy schema components;
- pooled `IntersectionObserver`s for matching viewport configurations;
- a shared RAF-coalesced breakpoint listener that updates only on breakpoint changes;
- viewport-aware media loading;
- CSS-driven responsive values;
- retained EngineCanvas 2D/3D/SVG output;
- demand-driven Canvas/Manim animation loops;
- offscreen and hidden-tab pausing;
- per-render generated CSS deduplication;
- production bundle inventory in CI.

There are still known architectural limits. In particular, generated styling currently uses a process-level `globalStyleCollector`; full per-request collector isolation remains future work.

The maintained truth for optimization behavior is [`docs/runtime-performance.md`](./docs/runtime-performance.md), not marketing claims in old examples.

---

## Validation and diagnostics

Use the lightweight validator when you need structural validation:

```ts
import { validateSchema } from "nextjs-engine"

const result = validateSchema(schema.root)
```

Use the analyzer for deeper diagnostics, accessibility/performance hints, duplicate navigation targets, and typo suggestions:

```ts
import { analyzeSchema } from "nextjs-engine"

const analysis = analyzeSchema(schema)
```

Read [`docs/schema-diagnostics.md`](./docs/schema-diagnostics.md).

---

## Custom components

NE is not limited to built-ins. Register your own React component under a schema node type:

```tsx
import { memo } from "react"
import { registerComponent } from "@/engine"

registerComponent(
	"my-card",
	memo(function MyCard({ title, children }) {
		return (
			<div className="card">
				<h3>{String(title)}</h3>
				{children}
			</div>
		)
	})
)
```

Then use it in a schema:

```ts
{
	type: "my-card",
	props: { title: "Hello" },
	children: [
		{ type: "text", props: { content: "Custom schema node" } }
	]
}
```

---

## Development

For the `main` workspace:

```bash
npm install
npm run type-check
npm run dev
```

Production validation:

```bash
npm run build
```

GitHub Actions additionally run APIStatic compiler/runtime tests, APIStatic artifact transaction tests, EngineBrowser SSR tests, TypeScript validation, a real optimized Next.js build, bundle reporting, and package-branch validation.

---

## Where should I read next?

Start at [`docs/index.md`](./docs/index.md).

| Goal | Read |
|---|---|
| Learn the engine/schema model | [`docs/readme.md`](./docs/readme.md) |
| Layouts and built-in primitives | [`docs/engine-components/primitives.md`](./docs/engine-components/primitives.md) |
| Styling / responsive props | [`docs/styling.md`](./docs/styling.md) |
| Runtime / performance behavior | [`docs/runtime-performance.md`](./docs/runtime-performance.md) |
| APIStatic | [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md) |
| External APIs / auth | [`docs/engine-components/engineapi.md`](./docs/engine-components/engineapi.md) |
| Canvas | [`docs/engine-components/enginecanvas.md`](./docs/engine-components/enginecanvas.md) |
| Scroll | [`docs/engine-components/enginescroll.md`](./docs/engine-components/enginescroll.md) |
| Browser APIs | [`docs/engine-components/enginebrowser.md`](./docs/engine-components/enginebrowser.md) |
| Diagnostics | [`docs/schema-diagnostics.md`](./docs/schema-diagnostics.md) |

`DOCUMENT.md` is the large technical/history reference. For behavior that changed recently, prefer the current TypeScript types and focused files under `docs/` when they disagree with an old historical section.

---

Built by **Kate-alt-69** for the Kastrick platform.
