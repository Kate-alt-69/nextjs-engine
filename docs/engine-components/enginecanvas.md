# EngineCanvas (EC)

Schema type: `"canvas"`.

EngineCanvas is Next.js Engine's canvas/GPU surface component. It can run in three different ways:

```text
callback mode
	→ you draw with Canvas 2D / WebGL callbacks

graphics mode
	→ ECScene + Engine2D / Engine3D / EngineSVG

shader mode
	→ a compiled EngineShader `.shed` program owns the canvas
```

Use **one** of those rendering paths for a canvas. EngineCanvas still owns the common sizing/lifecycle contract, but shader mode switches rendering ownership to EngineShader instead of stacking another canvas on top.

---

## Quick start: callback mode

```tsx
import { EngineCanvas } from "nextjs-engine";

export function DemoCanvas() {
	return (
		<EngineCanvas
			mode="2d"
			style={{ height: 420 }}
			onSetup={(context) => {
				context.fillStyle = "#0f172a";
			}}
			onDraw={(context, canvas) => {
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.fillRect(20, 20, 120, 80);
				return false;
			}}
		/>
	);
}
```

`return false` from `onDraw` when the callback has finished producing frames. EngineCanvas then stops requesting animation frames instead of running an idle RAF forever.

Schema callbacks may also be named handlers from `createPage({ handlers })`:

```ts
{
	type: "canvas",
	props: {
		mode: "2d",
		onSetup: "setupChart",
		onDraw: "drawChart",
		onResize: "resizeChart",
	},
}
```

---

## Quick start: graphics mode

Graphics mode renders the retained EngineCanvas scene model.

```ts
import {
	ecCircle,
	ecScene,
} from "nextjs-engine";

const scene = ecScene([
	ecCircle(60, {
		material: {
			fill: "#60a5fa",
		},
	}),
]);
```

Use the scene in schema:

```ts
{
	type: "canvas",
	props: {
		graphics: {
			engine: "2d",
			scene,
		},
		style: {
			height: 420,
		},
	},
}
```

Or JSX:

```tsx
<EngineCanvas
	graphics={{
		engine: "2d",
		scene,
	}}
	style={{ height: 420 }}
/>
```

Built-in graphics engines:

| Engine | Purpose | Current behavior |
|---|---|---|
| `2d` | Canvas 2D retained rendering | caches compiled topology and stable `Path2D` geometry |
| `3d` | Three.js-backed retained 3D | reuses Three.js objects and disposes removed GPU resources |
| `svg` | DOM SVG retained renderer | renders ECScene topology into a retained SVG DOM surface |
| `skia` | reserved CanvasKit backend | recognized but intentionally not implemented yet |

See [`enginesvg.md`](./enginesvg.md) for SVG-specific geometry/import/export behavior.

---

## Quick start: EngineShader mode

Give EngineCanvas a logical `.shed` name:

```ts
{
	type: "canvas",
	props: {
		shader: "aurora",
		style: {
			height: 420,
		},
	},
}
```

JSX:

```tsx
<EngineCanvas
	shader="aurora"
	style={{ height: 420 }}
/>
```

Override shader variables:

```tsx
<EngineCanvas
	shader={{
		src: "aurora",
		variables: {
			speed: .8,
			intensity: .65,
		},
	}}
	style={{ height: 420 }}
/>
```

When `shader` is present, the compatibility component renders EngineShader directly on that canvas surface. It does **not** start the normal EC graphics renderer and does not create a second shader canvas over the first one.

Current rule:

```text
shader
OR
graphics / onDraw
```

Do not expect shader mode to post-process an existing `graphics.engine = "3d"` frame yet. Real color/depth/normal/history post-processing belongs to the future EngineShader compositor/buffer work.

Full `.shed` language reference: [`engineshader.md`](./engineshader.md).

---

## Main props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `mode` | `"2d" \| "webgl" \| "webgl2" \| "auto"` | `"auto"` | context selection for normal callback/graphics mode |
| `shader` | `EngineShaderInput` | — | switches the component into EngineShader-owned rendering |
| `width` / `height` | `number` | — | fixed CSS size when supplied |
| `responsive` | `boolean` | inferred | defaults true when width and height are omitted |
| `dpr` | `number \| "auto"` | `"auto"` | target device-pixel ratio |
| `maxDpr` | `number` | `2` | upper DPR cap |
| `adaptive` | `boolean` | `true` | enables performance-driven density adjustment |
| `pauseWhenOffscreen` | `boolean` | `true` | suspends useless offscreen work |
| `pauseWhenHidden` | `boolean` | `true` | suspends work while the tab is hidden |
| `alpha` | `boolean` | `false` | alpha buffer hint in normal Canvas/WebGL mode |
| `antialias` | `boolean` | `true` | WebGL antialias hint in normal mode |
| `powerPreference` | WebGL power preference | `"high-performance"` | GPU preference hint |
| `onSetup` | function or handler name | — | one-time callback after normal context creation; may return cleanup |
| `onDraw` | function or handler name | — | frame callback; return `false` when complete |
| `onResize` | function or handler name | — | receives CSS width/height |
| `graphics` | `{ engine, scene }` | — | retained EC graphics runtime |
| `className` / `style` | React values | — | apply to the canvas/surface |

Shader mode maps the common `dpr`, `maxDpr`, `adaptive`, `pauseWhenOffscreen`, `pauseWhenHidden`, and `powerPreference` values into EngineShader's runtime configuration.

Responsive shader canvases use the same `100% × 100%` surface idea and keep a `150px` minimum height unless your style supplies something more useful.

---

## Context selection

`mode="auto"` tries:

```text
WebGL2
	↓ fallback
WebGL
	↓ fallback
Canvas 2D
```

Built-in graphics engines can force a compatible effective mode:

```text
graphics.engine = "2d" / "svg"
	→ 2D-compatible host context path

graphics.engine = "3d"
	→ WebGL-capable path
```

Built-in renderer implementations are dynamically imported only when selected, so using an ordinary 2D canvas does not require eagerly evaluating the 3D/SVG renderer modules.

Shader mode bypasses this normal context selection and lets EngineShader request the WebGL context it owns.

---

## Demand-driven callback RAF

Callback mode does not run an animation loop just because a canvas exists.

```text
no onDraw
	→ no callback RAF

onDraw returns true/void
	→ request next frame

onDraw returns false
	→ callback is complete; stop RAF
```

A backing-store resize clears the native canvas bitmap. If a callback previously finished with `false`, EngineCanvas wakes it for one redraw after resize so the static/final image can be restored. If it returns `false` again, the RAF stops again.

Replacing the `onDraw` callback also wakes callback mode, which lets new data/state produce a new frame without keeping the old callback spinning forever.

The `false` completion signal belongs to callback mode. Graphics engines control their own scene renderer lifecycle.

---

## Adaptive DPR

High DPR can make a canvas dramatically more expensive because fragment/pixel work grows with the backing-store area.

EngineCanvas tracks frame timing and considers a density change at most once every **750 ms**:

```text
average FPS below ~32
	→ DPR - 0.25, down to 0.5

average FPS above ~56
	→ DPR + 0.25, toward configured target
```

The rate limit prevents the backing store from repeatedly resizing every few frames.

Graphics engines receive the new DPR with the resize event, so EngineCanvas and Three.js do not fight over pixel dimensions.

EngineShader has its own adaptive density logic when `shader` mode owns the canvas; the facade forwards the relevant configuration instead of running two adaptive systems at once.

---

## Offscreen and hidden-tab behavior

Offscreen and hidden-tab pauses are independent.

```text
canvas leaves viewport
	→ offscreen pause

browser tab hidden
	→ hidden pause
```

Returning to the viewport does not resume a canvas while its tab is still hidden, and showing the tab does not resume a canvas that remains offscreen.

Normal EngineCanvas uses an IntersectionObserver margin so rendering can resume shortly before the surface becomes visible again. EngineShader mode uses ESH's own visibility/scheduler path.

---

## Engine2D retained geometry

Engine2D separates geometry compilation from painting.

For an unchanged `ECMesh`, it can retain:

```text
triangle topology
boundary edges
strip paths
fill paths
outline paths
Path2D geometry
```

Transform/material values are still read each frame, so moving, rotating, scaling, recoloring, changing opacity, or changing stroke does not require rebuilding stable geometry.

Geometry invalidates when the mesh changes structural source, including its typed-array references/topology. If you mutate a typed array in place, replace that typed array when the renderer needs to rebuild geometry.

Browsers without `Path2D` support fall back to direct Canvas path construction.

---

## Engine3D retained mode

Engine3D keeps a map keyed by EC node id.

Stable nodes reuse Three.js objects across frames. Transform/material values update in place. Geometry is rebuilt when the mesh source/topology changes. Removed nodes dispose their Three.js geometry/material resources.

This is important for larger scenes because rendering does not recreate every BufferGeometry/material/mesh on every RAF.

---

## EngineSVG retained mode

SVG mode renders the same ECScene/ECMesh model into DOM SVG.

It retains generated SVG groups and paths between frames, updates transforms/materials, understands indexed/fan/triangle/strip topology, and can import/export basic SVG geometry.

Example:

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

See [`enginesvg.md`](./enginesvg.md) for the full renderer/export reference.

---

## Custom rendering engines

Rendering engines implement:

```ts
interface RenderingEngine {
	readonly name: string;
	init(context: ECRenderContext): void | Promise<void>;
	render(scene: ECScene, delta: number, frame: number): void;
	resize(width: number, height: number, dpr?: number): void;
	dispose(): void;
}
```

Register one with:

```ts
registerRenderingEngine("my-engine", () => new MyRenderingEngine());
```

Then:

```ts
graphics: {
	engine: "my-engine",
	scene,
}
```

Built-in names use their direct dynamic imports first; the registry is the fallback for custom engines.

---

## `useEngineCanvas`

For imperative integrations:

```tsx
"use client";

import { useEffect } from "react";
import { useEngineCanvas } from "nextjs-engine";

export function CustomCanvas() {
	const { canvasRef, setup } = useEngineCanvas({
		mode: "webgl2",
	});

	useEffect(() => setup({
		maxDpr: 2,
		adaptive: true,
		onDraw(gl, canvas) {
			// custom drawing
			if (finished) return false;
		},
	}), [setup]);

	return <canvas ref={canvasRef} />;
}
```

The low-level hook avoids RAF when `onDraw` is absent and honors `return false` as completion.

Unlike the full component, the hook does not own all resize/offscreen/tab observer conveniences; those lifecycle pieces remain the caller's responsibility.

---

## Choosing the right mode

| Need | Use |
|---|---|
| quick custom Canvas 2D drawing | callback mode |
| raw custom WebGL drawing | callback mode with `mode="webgl"` / `webgl2` |
| retained 2D vector ECScene | `graphics.engine = "2d"` |
| retained Three.js ECScene | `graphics.engine = "3d"` |
| retained/exportable SVG ECScene | `graphics.engine = "svg"` |
| `.shed` procedural GPU surface | `shader` mode |
| shader post-processing of an existing 3D frame | not implemented yet; future compositor/buffers |

---

## Troubleshooting

### Canvas is only 150px tall

Responsive Canvas keeps a minimum height as a safety fallback. Give the canvas or its parent a real height:

```tsx
<EngineCanvas style={{ height: 500 }} />
```

### Static callback keeps animating

Return `false` after drawing the completed frame.

### Shader and graphics do not combine

That is the current v1 contract. `shader` makes EngineShader own the surface. Use either shader mode or normal callback/graphics mode until framebuffer post-processing lands.

### SVG looks different from 2D

Check mesh topology and typed-array replacement rules, then see [`enginesvg.md`](./enginesvg.md). The SVG renderer now follows the same triangle/strip topology rules and boundary-edge outline model as Engine2D.
