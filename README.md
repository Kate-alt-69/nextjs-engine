# Next.js Engine

A schema-driven rendering engine for Next.js. Define pages as TypeScript objects and keep the page structure readable while the engine handles responsive layout, lazy rendering, navigation, media, and graphics plumbing underneath.

## Why

Raw React and TypeScript give you complete control, but even simple interface behavior quickly accumulates hooks, observers, viewport checks, cleanup logic, event wiring, and deeply nested JSX. Next.js Engine keeps that work behind a schema-oriented programming model so the code still reads like the website it describes.

```ts
import { createPage, defineSchema } from "nextjs-engine";

const schema = defineSchema({
	root: {
		type: "section",
		props: {
			px: { xs: "1rem", md: "3rem" },
			py: { xs: "3rem", md: "7rem" },
		},
		children: [
			{
				type: "heading",
				props: {
					level: 1,
					content: "Readable by default.",
				},
			},
		],
	},
});

export default createPage({ schema });
```

## 2.0 graphics update

The 2.0 package keeps the existing schema/page runtime and upgrades the graphics side substantially:

- EngineCanvas V2 is the wired Canvas implementation used by schema `canvas` nodes.
- Rendering engines declare the Canvas context they require instead of competing with `mode="auto"`.
- EngineCanvas tracks the current scene/callbacks, handles responsive backing-size/DPR changes, and exposes controlled initialization failures.
- EngineCanvas can drive EC 2D, WebGL/3D, SVG, and registered custom renderers.
- EC path support includes curved SVG-style geometry used by more complex vector scenes.
- EngineManim3D supports GLTF/GLB and OBJ models.
- OBJ models may optionally load an accompanying MTL file with `mtlSrc`.
- `autoFrame` calculates model bounds and positions the camera around imported models.
- `autoRotate` provides an optional presentation rotation for 3D showcases.

### OBJ + MTL example

```tsx
<EngineManim3D
	cprop={{
		manim3d: {
			src: "/models/build.obj",
			mtlSrc: "/models/build.mtl",
			format: "obj",
			settings: {
				autoFrame: true,
				autoRotate: 0.18,
			},
		},
	}}
	style={{ width: "100%", height: "540px" }}
/>
```

## Responsive values

Responsive values stay beside the property they control:

```ts
props: {
	px: { xs: "1rem", md: "2rem", xl: "3rem" },
	display: { xs: "block", md: "flex" },
	columns: { xs: 1, md: 2, lg: 3 },
}
```

The engine compiles those values into CSS instead of requiring page components to own viewport listeners.

## Custom components

Next.js Engine is not intended to replace React. Register ordinary React components whenever a feature is clearer as normal component code:

```ts
import { memo } from "react";
import { registerComponent } from "nextjs-engine";

registerComponent(
	"my-card",
	memo(function MyCard({ title, children }) {
		return <div className="card"><h3>{title}</h3>{children}</div>;
	}),
);
```

Then use it from a schema:

```ts
{
	type: "my-card",
	props: { title: "Hello" },
	children: [],
}
```

## Package

The distributable package lives on the repository's `main-empty` branch. It can be consumed as an npm-style source package or copied/vendorized directly into an application.

The complete engine reference remains in `DOCUMENT.md` and `docs/`.
