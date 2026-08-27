# EngineSVG

EngineSVG is the SVG renderer inside EngineCanvas.

It uses the same `ECScene` / `ECMesh` graphics model as Engine2D, but renders that scene as retained DOM SVG instead of painting pixels into Canvas 2D.

Use it when you want:

```text
ECScene authoring
+
SVG DOM output
+
sharp scalable vector rendering
+
SVG import/export helpers
```

The implementation lives at:

```text
src/engine/core/enginecanvas/EngineSVG.ts
```

---

## Quick start

Create a normal EngineCanvas scene:

```ts
import {
	ecCircle,
	ecRect,
	ecScene,
} from "nextjs-engine";

const scene = ecScene([
	ecRect(180, 100, {
		material: {
			fill: "#312e81",
			stroke: "#818cf8",
			strokeWidth: 3,
		},
	}),
	ecCircle(36, {
		material: {
			fill: "#22d3ee",
		},
	}),
]);
```

Render it through SVG:

```tsx
import { EngineCanvas } from "nextjs-engine";

export function VectorScene() {
	return (
		<EngineCanvas
			graphics={{
				engine: "svg",
				scene,
			}}
			style={{
				height: 420,
			}}
		/>
	);
}
```

Schema form:

```ts
{
	type: "canvas",
	props: {
		graphics: {
			engine: "svg",
			scene,
		},
		style: {
			height: 420,
		},
	},
}
```

The EngineCanvas host still handles size/lifecycle. EngineSVG creates an SVG element beside that host canvas, hides the canvas while SVG mode owns the visual output, and restores the previous canvas display value on dispose.

---

## Same scene, different renderer

One useful part of the EC model is that the scene is renderer-independent.

```ts
const graphics2D = {
	engine: "2d",
	scene,
};

const graphicsSVG = {
	engine: "svg",
	scene,
};

const graphics3D = {
	engine: "3d",
	scene,
};
```

That does **not** mean every renderer has identical visual capabilities, but the scene/topology model stays shared.

For vector-style 2D geometry, Engine2D and EngineSVG intentionally follow the same mesh topology rules so changing renderer does not reinterpret the triangles completely differently.

---

## Retained SVG rendering

EngineSVG does not delete and rebuild the entire SVG tree every frame.

It keeps retained nodes keyed by the EC node id:

```text
EC node id
	↓
retained <g>
	├─ fill <path>
	└─ outline <path>
```

On later renders it updates existing elements in place.

Transform/material changes can update without rebuilding geometry:

```text
position
rotation
scale
opacity
fill
stroke
strokeWidth
```

Geometry is rebuilt when structural geometry inputs change:

```text
mesh.vertices typed-array reference
mesh.indices typed-array reference
mesh.topology
```

If you edit a typed array **in place**, the renderer still sees the same array reference. Replace the typed array when you need the retained path to rebuild.

Example:

```ts
mesh.vertices = new Float32Array([
	-50, -50, 0,
	 50, -50, 0,
	  0,  50, 0,
]);
```

rather than mutating the old array and expecting retained geometry invalidation automatically.

---

## Mesh topology

EngineSVG understands the EC mesh topology values:

```text
strip
fan
triangles
```

### `strip`

A strip follows vertex order.

If indices exist, index order is used:

```text
indices[0]
→ indices[1]
→ indices[2]
→ ...
```

A strip is rendered as a stroked SVG path rather than a filled triangle surface.

For line strips:

```text
material.stroke
	↓ fallback
material.fill
	↓ fallback
none
```

### Indexed triangle meshes

When a non-strip mesh has indices, EngineSVG consumes them in triangle triples:

```text
[a, b, c]
[d, e, f]
...
```

### `fan` without indices

A fan expands around vertex `0`:

```text
0, 1, 2
0, 2, 3
0, 3, 4
...
```

### `triangles` without indices

Sequential groups of three vertices become triangles:

```text
0, 1, 2
3, 4, 5
6, 7, 8
...
```

---

## Fill and outline behavior

Triangle fills are emitted as closed SVG subpaths.

Outlines use **boundary edges only**.

That means two triangles sharing an internal edge do not automatically get an ugly line through the middle of the filled shape.

Conceptually:

```text
triangle A edge ─┐
                 ├─ same edge appears twice → internal → do not stroke
triangle B edge ─┘

edge appears once → outer boundary → stroke
```

This keeps indexed triangulated shapes closer to the way Engine2D presents their outer outline.

---

## Groups and transforms

EC groups become retained SVG `<g>` elements.

The renderer maps the EC transform into SVG transform operations:

```text
translate(x y)
rotate(z)
scale(x y)
```

Nested groups remain nested SVG groups, and children are synchronized under their retained parent.

---

## Scene background

A non-void EC scene can provide a background.

```ts
const scene = ecScene(nodes, {
	background: "#020617",
});
```

Live EngineSVG rendering inserts a background `<rect>` when:

```text
scene.environment !== "void"
and
scene.background exists
```

A `void` environment stays transparent.

`exportSVG()` follows the same rule so live SVG and exported SVG do not disagree about the background.

---

## Export SVG

Use `exportSVG()` when you want SVG markup from an EC scene.

```ts
import {
	exportSVG,
	ecCircle,
	ecScene,
} from "nextjs-engine";

const scene = ecScene([
	ecCircle(40, {
		material: {
			fill: "#38bdf8",
		},
	}),
]);

const markup = exportSVG(scene, 800, 600);
```

`markup` is an SVG string.

You can save/send it using your own application code:

```ts
const blob = new Blob([markup], {
	type: "image/svg+xml",
});
```

The exporter uses the same topology compiler rules as the retained live renderer, including indexed triangle handling and boundary-only outline generation.

Material values written into XML attributes are escaped before export so XML-sensitive characters are not blindly interpolated into attributes.

---

## Import SVG

`importSVG()` converts a basic SVG source string into EC nodes.

```ts
import {
	importSVG,
	ecScene,
} from "nextjs-engine";

const source = `
<svg xmlns="http://www.w3.org/2000/svg">
	<circle cx="0" cy="0" r="40" fill="#22d3ee" />
	<line x1="-50" y1="0" x2="50" y2="0" stroke="#fff" />
</svg>
`;

const nodes = importSVG(source);
const scene = ecScene(nodes);
```

Current imported element types:

```text
path
circle
rect
line
polygon
```

`line` reads its real `x1`, `y1`, `x2`, and `y2` attributes.

Imported shapes are lowered into EngineCanvas path/mesh geometry through `ecPath()`.

### Browser-only rule

`importSVG()` requires `DOMParser`, so it is browser-only.

Calling it where `DOMParser` does not exist throws a clear error instead of silently returning broken geometry.

If you need server-side SVG parsing, use a server SVG parser in your app and convert the result into EC geometry yourself.

---

## What importSVG is not

It is intentionally a **basic shape importer**, not a replacement browser SVG engine.

Do not assume it fully handles:

```text
external stylesheets
complex CSS cascade
filters
masks
text layout
foreignObject
all path/CSS interactions
animations
full SVG spec round-tripping
```

For complex source SVG, either keep it as native SVG in the app or preprocess it with a more complete SVG tool before converting into EC geometry.

---

## Direct EngineSVGEngine use

Most applications should select `graphics.engine = "svg"` through EngineCanvas.

The class is still public for advanced renderer integrations:

```ts
import { EngineSVGEngine } from "nextjs-engine";

const renderer = new EngineSVGEngine();
```

It implements the standard EngineCanvas `RenderingEngine` contract:

```ts
interface RenderingEngine {
	readonly name: string;
	init(context: ECRenderContext): void | Promise<void>;
	render(scene: ECScene, delta: number, frame: number): void;
	resize(width: number, height: number, dpr?: number): void;
	dispose(): void;
}
```

Manual lifecycle ownership is advanced usage; EngineCanvas normally handles these calls for you.

---

## When to use EngineSVG vs Engine2D

| Need | Better starting point |
|---|---|
| lots of frequently painted raster-style vector frames | Engine2D |
| inspectable/selectable SVG DOM output | EngineSVG |
| export matching SVG markup | EngineSVG |
| very sharp vector surface at arbitrary CSS scale | EngineSVG |
| direct Canvas API drawing | Engine2D callback mode |
| Three.js 3D | Engine3D |

EngineSVG creates DOM nodes, so it is not automatically the cheapest option for thousands of rapidly changing primitives. Choose the renderer based on the scene and output you need.

---

## Performance notes

EngineSVG reduces avoidable work by:

- retaining SVG groups/paths by EC node id;
- updating attributes only when their string value changes;
- rebuilding geometry only when vertices/indices/topology references change;
- removing retained elements when their scene ids disappear;
- separating fill and boundary-outline paths;
- reusing the same topology compiler logic for live rendering/export behavior.

For extremely large scenes, DOM node count can still dominate. A retained Canvas/WebGL renderer may be more appropriate when you do not need SVG DOM/export characteristics.

---

## Troubleshooting

### My geometry did not update

If you mutated `mesh.vertices` or `mesh.indices` in place, replace the typed array so the retained renderer can detect structural geometry change.

### My strip has no visible line

Give it `material.stroke` or `material.fill`.

```ts
material: {
	stroke: "#fff",
	strokeWidth: 2,
}
```

### I see no internal triangle seams

That is intentional. EngineSVG strokes boundary edges rather than every triangle edge.

### `importSVG()` throws on the server

Expected. It requires browser `DOMParser`.

### My complex SVG loses features after import/export

The importer is deliberately a basic geometry importer. Keep complex SVG as native SVG or preprocess it with a full SVG parser/toolchain.
