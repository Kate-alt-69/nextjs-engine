# Next.js Engine

A schema-driven rendering engine for Next.js. Define pages as TypeScript objects — the engine handles every optimization automatically.

No raw HTML. No raw JSX. Just fast pages.

---

## Why

Raw React and Next.js hand you the tools but apply nothing for you. Every optimization — lazy loading, memoization, responsive layout, image sizing, video buffering — you have to wire up yourself, every single time.

This engine does all of it by default. You write a schema. The engine produces an optimised Next.js page.

---

## What It Handles Automatically

| Problem | Engine Solution |
|---------|----------------|
| Unnecessary re-renders | `React.memo` on every component |
| JS-based responsive = layout shifts | CSS custom properties + `@media` — zero JS |
| Images not optimised | Always uses `next/image` |
| Images loading too early or too late | `IntersectionObserver` with size-aware pre-load distance |
| No blur placeholder on images | Blur-up progressive loading built in |
| Videos fetching on page load | `src` never injected into DOM until near viewport |
| Off-screen sections wasting render budget | `content-visibility: auto` applied automatically |
| Heavy sections blocking interactivity | `LazyMount` — children don't exist in DOM until near viewport |
| Layout shift from lazy content | Reserved placeholder height on every lazy element |
| No Suspense boundaries | Auto-wrapped around every lazy subtree |
| Scattered CSS | One deduplicated `<style>` tag per page |
| Repetitive in-house API files | APIStatic compiles `data/endpoint/**/*.route` to static endpoint programs |

---

## Quick Start

Drop the `src/engine/` folder into any Next.js project, add the path alias, and start defining pages.

**1. Add the alias in `tsconfig.json`:**

```json
{
	"compilerOptions": {
		"paths": {
			"@/engine": ["./src/engine/index.ts"]
		}
	}
}
```

**2. Define and export a page:**

```ts
// app/page.tsx
import { createPage, defineSchema } from "@/engine"

const HomeSchema = defineSchema({
	meta: {
		title: "My Site",
		description: "Built with the Next.js Engine"
	},
	root: {
		type: "section",
		props: { contentMaxWidth: "1100px" },
		children: [
			{
				type: "heading",
				props: {
					level: 1,
					content: "Hello World",
					subheading: "Fast by default.",
					align: "center"
				}
			},
			{
				type: "image",
				props: {
					src: "/hero.jpg",
					alt: "Hero image",
					width: 1200,
					height: 600,
					priority: true
				}
			},
			{
				type: "video",
				props: {
					src: "/demo.mp4",
					poster: "/demo-thumb.jpg"
				}
			}
		]
	}
})

export default createPage({ schema: HomeSchema })
```

That's it. The engine handles the rest.

---

## APIStatic — In-house Static APIs

APIStatic removes the need to create a new Next.js `route.ts` for small browser-safe in-house API operations.

Create files under:

```text
data/endpoint/**/*.route
```

For example:

```text
data/endpoint/math.route
```

```ts
createEndpoint([
	{
		name: "add"
		query: {
			a: "number"
			b: "number"
		}
		run.query(query.a + query.b)
	}
])
```

The plugin compiles that to a stable hashed module under `/_static/endpoint/*`, but application code uses only the logical route name:

```ts
import { APIStatic } from "nextjs-engine"

const response = await APIStatic.resolve(
	"math",
	"add",
	{ a: 20, b: 30 }
)
```

Or use the normal resolver explicitly:

```ts
import { APIStatic, EngineAPIResolver } from "nextjs-engine"

const resolver = new EngineAPIResolver({
	endpoint: APIStatic.endpoint("math", "add")
})

const response = await resolver.resolveRequest({
	input: { a: 20, b: 30 }
})
```

Discover compiled logical names when needed:

```ts
await APIStatic.names()
await APIStatic.has("math")
await APIStatic.getEndpoints()
```

Normal execution does not require discovery first. APIStatic owns the hash and generated `/_static/endpoint/...js` path internally.

`.route` programs execute in the browser. Do not put secrets or private server state in them; use an explicitly configured `proxy()` bridge for server-only work.

See [`docs/engine-components/apistatic.md`](./docs/engine-components/apistatic.md) for the full DSL, manifest, proxy, response, error, and plugin reference.

---

## EngineAPIResolver

For external HTTP APIs, auth, provider config, version macros, HMAC/PNP signing, and `.EngineAPIConfig/*.api`, use `EngineAPIResolver`.

```ts
import { EngineAPIResolver } from "nextjs-engine"

const resolver = new EngineAPIResolver({
	endpoint: "https://api.example.com/users",
	method: "GET"
})

const response = await resolver.resolveRequest()
```

See [`docs/engine-components/engineapi.md`](./docs/engine-components/engineapi.md).

---

## Responsive Layout

Pass a breakpoint map to any spacing, sizing, or layout prop. The engine converts it to CSS custom properties — the browser does the switching, not JavaScript.

```ts
props: {
	px: { xs: "1rem", md: "2rem", xl: "3rem" },
	columns: { xs: 1, md: 2, lg: 3 },
	display: { xs: "block", md: "flex" }
}
```

No resize listeners. No hydration mismatches. No layout shifts.

---

## Theme

Set CSS custom properties once, used everywhere:

```ts
defineSchema({
	theme: {
		vars: {
			"--e-accent": "#7c3aed",
			"--e-bg": "#0f0f1a",
			"--e-card-bg": "#1a1a2e",
			"--e-muted": "#94a3b8"
		},
		fonts: [
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
		],
		globalStyles: `
			body { background: var(--e-bg); font-family: 'Inter', sans-serif; }
		`
	},
	root: { … }
})
```

---

## Custom Components

Register any React component under a custom node type:

```ts
import { memo } from "react"
import { registerComponent } from "@/engine"

registerComponent(
	"my-card",
	memo(function MyCard({ title, children }) {
		return <div className="card"><h3>{title}</h3>{children}</div>
	})
)
```

```ts
{ type: "my-card", props: { title: "Hello" }, children: […] }
```

---

## Lazy Loading Rules

The engine decides laziness automatically based on element type and position in the tree. Override with `props.priority = true` or `props.lazy = true/false`.

| Type | Default Behaviour |
|------|------------------|
| `video` | Always lazy, pre-fetches 800px ahead |
| `image` (large, >640×480) | Lazy, pre-fetches 400–800px ahead based on size |
| `image` (small) | Native `loading="lazy"` via next/image |
| `image` (priority) | Eager, next/image preload in `<head>` |
| `section` / `hero` (deep, below fold) | Full lazy mount |
| `section` / `hero` (shallow, below fold) | `content-visibility: auto` only |
| `grid` / `stack` (many items, below fold) | Lazy mount |
| Everything at depth 0 | Eager |

---

## Node Types

`box` `stack` `grid` `text` `heading` `image` `video` `section` `hero` `card` `button` `spacer` `divider` `slot`

Full prop reference for each type is in `DOCUMENT.md`.

---

## Event Handlers

Named handlers are provided at the `createPage` level and referenced by name in the schema:

```ts
export default createPage({
	schema: MySchema,
	handlers: {
		openModal: () => setOpen(true)
	}
})
```

```ts
{ type: "button", props: { label: "Open", onClick: "openModal" } }
```

---

## Slots

Inject React components into specific points in the schema tree:

```ts
createPage({
	schema: MySchema,
	slots: { sidebar: <MySidebar /> }
})
```

```ts
{ type: "slot", props: { name: "sidebar" } }
```

---

## File Structure

```text
src/engine/
├── schema/types.ts
├── core/
│   ├── resolver.ts
│   ├── StyleCollector.ts
│   ├── registry.ts
│   ├── lazyDetect.ts
│   ├── SchemaRenderer.tsx
│   ├── EngineAPIResolver.ts
│   └── APIStatic.ts
├── plugins/
│   ├── engineApiPlugin.js
│   └── apiStaticCompiler.js
├── hooks/
├── providers/
├── components/
├── createPage.tsx
└── index.ts

data/endpoint/**/*.route
	↓ compile
public/_static/endpoint/*.js
public/_static/endpoint/manifest.json
```

---

## Docs

Start with [`docs/index.md`](./docs/index.md). The large technical reference remains in `DOCUMENT.md`, while current component/runtime-specific behavior lives under `docs/engine-components/`.

---

Built by Kate-alt-69 for the Kastrick platform.
