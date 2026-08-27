# Next.js Engine

**Next.js Engine (NE)** is a schema-driven rendering/runtime layer for React 19 and Next.js 16.

This is the **distributable `main-empty` package branch**. The development workspace and source of truth live on the repository's [`main`](https://github.com/Kate-alt-69/nextjs-engine/tree/main) branch under `src/engine/`.

**Current GitHub release:** [NE v2.5.0](https://github.com/Kate-alt-69/nextjs-engine/releases/tag/Release-v2.5.0)

---

## Package entrypoints

The package exposes three main entrypoints:

```ts
import {
	createPage,
	defineSchema,
	APIStatic,
	EngineAPIResolver,
	EngineCanvas,
	EngineScroll,
	EngineBrowser
} from "nextjs-engine"
```

Server-only request helpers:

```ts
import { getServerDevice } from "nextjs-engine/server"
```

Next.js build plugin:

```js
const withEngineAPI = require("nextjs-engine/plugin")
```

The server entrypoint keeps request-only Next.js APIs such as `next/headers` out of the universal/browser graph.

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
				type: "button",
				props: {
					label: "Click me",
					onClick: "clicked"
				}
			}
		]
	}
})

export default createPage({
	schema: home,
	handlers: {
		clicked: () => console.log("clicked")
	}
})
```

Responsive values are normally compiled to CSS variables/media queries so breakpoint switching is handled by CSS rather than a resize hook in every component.

---

## What is included?

- typed schema renderer and primitive component system;
- responsive style runtime and pseudo-state styling;
- custom component registry and slots;
- EngineCanvas retained 2D / Three.js 3D / SVG runtime;
- EngineManim 2D + 3D animation;
- EngineScroll named points, movement, URL protocol, and scheduler;
- EngineImage / EngineVideo viewport-aware media;
- EngineMarkdown;
- EngineHero / EngineNav / EngineSuspense / EngineForms;
- SSR-safe EngineBrowser facade;
- shared/client device detection plus `nextjs-engine/server` request helpers;
- EngineAPIResolver and `.EngineAPIConfig/*.api` provider configuration;
- APIStatic `.route` compiler/runtime;
- schema validation and deeper analyzer diagnostics.

NE automates repeated performance plumbing, but it is not a guarantee that arbitrary application code, custom callbacks, huge scenes, or oversized media will be fast. See [`docs/runtime-performance.md`](./docs/runtime-performance.md) for the current performance contract.

---

## APIStatic

APIStatic compiles NE-owned browser endpoint programs from:

```text
data/endpoint/**/*.route
```

Example:

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

Enable compilation:

```js
// next.config.js
const withEngineAPI = require("nextjs-engine/plugin")

module.exports = withEngineAPI({})
```

Then call the logical route name:

```ts
import { APIStatic } from "nextjs-engine"

const response = await APIStatic.resolve(
	"math",
	"add",
	{ a: 20, b: 30 }
)
```

The plugin generates stable route modules and `manifest.json` under `public/_static/endpoint/`.

APIStatic supports typed/coerced inputs, defaults, optional fields, multiple operations, `run.query`, `run.body`, `run.input`, `run.proxy`, async functions, public `fetch()`, explicit responses/errors, manifest discovery, development watching, scope-aware compilation, and atomic last-known-good endpoint publication.

`.route` files execute in the browser. **Do not put secrets or server-only state in them.** Use a configured `proxy()` bridge for trusted backend work.

Full APIStatic docs: [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md).

---

## Package layout

```text
nextjs-engine/
├── engine/                      Package engine source
│   ├── components/
│   ├── core/
│   │   ├── enginecanvas/
│   │   ├── enginescroll/
│   │   ├── APIStatic.ts
│   │   ├── EngineAPIResolver.ts
│   │   ├── EngineBrowserSafe.ts
│   │   └── EngineDevice*.ts
│   ├── hooks/
│   ├── plugins/
│   ├── providers/
│   ├── schema/
│   ├── createPage.tsx
│   ├── server.ts
│   └── index.ts
├── docs/
├── DOCUMENT.md
├── index.ts                     Root package re-export
├── package.json
└── README.md
```

The `main` workspace automatically synchronizes validated `src/engine/`, `docs/`, and `DOCUMENT.md` changes into this package branch while preserving package-only metadata.

---

## Documentation

Start at [`docs/index.md`](./docs/index.md).

Useful references:

- [`docs/styling.md`](./docs/styling.md) — responsive styling contract
- [`docs/runtime-performance.md`](./docs/runtime-performance.md) — current optimization/runtime behavior
- [`docs/schema-diagnostics.md`](./docs/schema-diagnostics.md) — validation/analyzer diagnostics
- [`docs/engine-components/enginecanvas.md`](./docs/engine-components/enginecanvas.md)
- [`docs/engine-components/enginescroll.md`](./docs/engine-components/enginescroll.md)
- [`docs/engine-components/engineapi.md`](./docs/engine-components/engineapi.md)
- [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md)
- [`docs/engine-components/enginebrowser.md`](./docs/engine-components/enginebrowser.md)

When an old section of `DOCUMENT.md` disagrees with a focused current doc or the TypeScript types, prefer the current focused doc/types.

---

Built by **Kate-alt-69** for the Kastrick platform.
