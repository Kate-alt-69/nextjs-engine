# EngineCanvas (EC)

Schema type: `"canvas"` — GPU-accelerated HTML canvas with automatic DPR
management, a pause-aware RAF loop, adaptive pixel density, and SSR safety.

Used directly for custom 2D or WebGL drawing. Also used **internally** by
`EngineManim` (2D animation), `EngineManim3D` (Three.js), and optionally by
`EngineSuspense` custom presets.

---

## Context types

Each `mode` gives you a different context type in your handlers:

| `mode` | Context type | Notes |
|--------|-------------|-------|
| `"2d"` | `CanvasRenderingContext2D` | Adds `desynchronized: true` — removes main-thread compositor wait |
| `"webgl"` | `WebGLRenderingContext` | WebGL 1 |
| `"webgl2"` | `WebGL2RenderingContext` | WebGL 2 — instanced drawing, VAOs, UBOs |
| `"auto"` | `WebGL2 → WebGL → 2D` | Tries in order, uses best available |

---

## Handler signatures

All three handlers receive the same context type determined by `mode`.
Cast it inside the handler when you need type-narrowing:

```ts
type AnyCtx = CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext;

onSetup: (ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void
onDraw:  (ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number) => void
onResize:(ctx: AnyCtx, canvas: HTMLCanvasElement, w: number, h: number) => void
```

- **`delta`** — ms since the previous frame. Use this instead of fixed values to keep animations frame-rate independent (same speed at 30 fps and 120 fps).
- **`frame`** — cumulative integer counter starting at 0. Useful for mod-based effects: `frame % 60 === 0` fires once per second at 60 fps.
- **`onSetup`** return value — a cleanup function called when the component unmounts. Release GPU resources, cancel timers, disconnect observers here.

Handler refs must be **stable** (use `useCallback` or define outside the component) — they are intentionally excluded from the setup effect's dependency array.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `"2d" \| "webgl" \| "webgl2" \| "auto"` | `"auto"` | Rendering context |
| `width` | `number` | — | Fixed CSS pixel width. Omit for responsive. |
| `height` | `number` | — | Fixed CSS pixel height. Omit for responsive. |
| `responsive` | `boolean` | `true` when no `width`/`height` | Fill container, resize automatically via `ResizeObserver` |
| `dpr` | `number \| "auto"` | `"auto"` | Device pixel ratio. `"auto"` = `window.devicePixelRatio` capped at `maxDpr` |
| `maxDpr` | `number` | `2` | DPR cap — prevents 3× rendering on high-DPI displays |
| `adaptive` | `boolean` | `true` | Drop DPR when FPS < 30, restore when FPS > 55 |
| `pauseWhenOffscreen` | `boolean` | `true` | Stop RAF loop when canvas leaves the viewport |
| `pauseWhenHidden` | `boolean` | `true` | Stop RAF loop when the browser tab is hidden |
| `alpha` | `boolean` | `false` | Transparent canvas. `false` = free GPU win (skips alpha compositing) |
| `antialias` | `boolean` | `true` | WebGL MSAA. Disable for particle systems to save fill-rate |
| `powerPreference` | `"default" \| "high-performance" \| "low-power"` | `"high-performance"` | GPU hint — requests discrete GPU on dual-GPU systems |
| `onSetup` | `string` | — | Handler name. Called once after context creation. |
| `onDraw` | `string` | — | Handler name. Called every animation frame. |
| `onResize` | `string` | — | Handler name. Called on resize in responsive mode. |
| `style` | `CSSProperties` | — | CSS applied to the canvas wrapper `<div>` |
| `className` | `string` | — | Class applied to the canvas wrapper |

---

## Why it's faster than a plain `<canvas>`

- **`desynchronized: true`** (2D) — canvas presents without waiting for the main-thread compositor. Eliminates a full frame of latency on every `drawImage` / `fillRect` call.
- **`powerPreference: "high-performance"`** — on laptops with integrated + discrete GPU, this requests the discrete card from the OS.
- **`contain: strict`** on the wrapper — prevents the canvas layout from triggering reflows in sibling elements during animation.
- **`transform: translateZ(0)` + `will-change: transform`** — promotes the canvas to its own GPU compositor layer.
- **Adaptive DPR** — if frame time exceeds 33 ms (< 30 fps), DPR is halved automatically and restored when headroom returns. Prevents jank on low-end hardware without any code changes.
- **Pause when hidden/offscreen** — `Page Visibility API` + `IntersectionObserver` cancel the RAF loop when the canvas is invisible. Saves battery and prevents frame queuing.

---

## 2D example

```ts
export default createPage({
  schema: defineSchema({
    root: {
      type: "canvas",
      props: {
        mode:       "2d",
        responsive: true,
        style:      { height: "400px" },
        onSetup:    "setup2d",
        onDraw:     "draw2d",
        onResize:   "resize2d",
      },
    },
  }),

  handlers: {
    setup2d(ctx, canvas) {
      const c = ctx as CanvasRenderingContext2D;
      c.font = "bold 14px 'Inter', sans-serif";
      c.textBaseline = "top";
      return () => {
        // cleanup on unmount (optional)
      };
    },

    draw2d(ctx, canvas, delta, frame) {
      const c = ctx as CanvasRenderingContext2D;
      c.clearRect(0, 0, canvas.width, canvas.height);

      // Frame-rate independent rotation (delta-based)
      const angle = (frame * 0.02) % (Math.PI * 2);
      const cx = canvas.width  / 2;
      const cy = canvas.height / 2;

      c.save();
      c.translate(cx, cy);
      c.rotate(angle);
      c.fillStyle = "#60a5fa";
      c.fillRect(-40, -40, 80, 80);
      c.restore();

      c.fillStyle = "rgba(255,255,255,.4)";
      c.fillText(`frame ${frame} · ${delta.toFixed(1)} ms`, 12, 12);
    },

    resize2d(ctx, canvas, w, h) {
      const c = ctx as CanvasRenderingContext2D;
      // Re-set font after resize — 2D context state resets on canvas resize
      c.font = "bold 14px 'Inter', sans-serif";
      c.textBaseline = "top";
    },
  },
});
```

---

## WebGL example

```ts
handlers: {
  setup3d(ctx, canvas) {
    const gl = ctx as WebGL2RenderingContext;
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // compile shaders, create buffers, VAOs…
    // const program = compileShaders(gl, vertSrc, fragSrc);

    return () => {
      // release GPU resources on unmount
      // gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  },

  draw3d(ctx, canvas, delta) {
    const gl = ctx as WebGL2RenderingContext;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // draw calls…
  },
}
```

---

## How EngineManim uses EngineCanvas

`EngineManim` wraps `EngineCanvas` internally. It compiles the `cprop.manim`
config into a `Float32Array` geometry pool once (cached via `WeakMap`), then
drives the canvas via `onSetup` and `onDraw` callbacks that it generates
itself. You don't interact with the canvas context directly when using
`type: "manim"` — the manim runtime owns the draw loop.

If you need access to the raw context alongside a manim animation (e.g. to
add a HUD overlay), use `type: "canvas"` directly and call into
`compileManimConfig` + the manim draw utilities manually.

---

## Using EngineCanvas as a custom EngineSuspense fallback

See [enginesuspense.md → Custom fallback](./enginesuspense.md#custom-fallback)
for the full pattern. In summary: register a component with `registerComponent`
that creates its own canvas element with `useRef`, runs a minimal RAF loop in
`useEffect`, and returns a `<canvas>` element. Then use that type as the
`preset` override via the `fallback` slot.

---

## SSR behaviour

On the server `EngineCanvas` renders a sized `<div>` placeholder with the
same `width` / `height` (or `style.height` in responsive mode). This
reserves layout space and prevents CLS. The canvas element itself and the
`onSetup` call only happen client-side after the component mounts.

If `canvasMounted` state is declared after the setup `useEffect` in the
source, setup runs before the `<canvas>` is in the DOM (bug). The engine
fixes this by declaring `canvasMounted` before the setup effect and adding
it to the dependency array — so setup re-runs once the canvas element exists.

---

## EngineCanvas V2 — Graphics Runtime (opt-in)

EngineCanvas can drive a **pluggable rendering engine** through the `graphics`
prop. This is purely opt-in per `<canvas>` instance — nothing else in the
engine changes. DOM components (button, box, text, etc.) are never routed
through canvas, and this does not replace `onSetup`/`onDraw` for raw usage.

```
Developer
    │
    ▼
EngineCanvas (unchanged: RAF loop, adaptive DPR, pause, SSR, resize)
    │
    ├── Engine2D   — custom vector runtime, flat/rim artistic shading
    ├── Engine3D   — Three.js, flat materials, Void environment
    ├── EngineSVG  — DOM-backed import/export
    └── EngineSkia — stub (future: CanvasKit)
```

`onDraw` is ignored while `graphics` is set — they are mutually exclusive
draw paths on the same canvas. `onSetup`/`onResize` still fire normally
alongside `graphics` if you pass them (e.g. for a HUD overlay).

**Note on bones/skeletons:** none of these rendering engines expose a
bone or skeleton API. That responsibility stays entirely with
`EngineManim3D`, which uses raw Three.js directly and does not route
through `Engine3D`.

---

### `graphics` prop

```ts
graphics?: {
  engine: "2d" | "3d" | "svg" | "skia" | string;  // string = custom registered engine
  scene:  ECScene;
}
```

---

### Graphics model

Every shape becomes vertices — this is the same principle `EngineManim`
uses internally, now available as a public API.

```ts
import { ecCircle, ecRect, ecPath, ecGroup, ecScene, ecMaterial } from "@/engine";

const ring = ecCircle(50, {
  material: ecMaterial({ fill: "#60a5fa", shading: "flat" }),
});

const scene = ecScene([ring], { environment: "void" });
```

| Factory | Produces | Notes |
|---------|----------|-------|
| `ecVec2(x, y)` | `ECVector2` | |
| `ecVec3(x, y, z?)` | `ECVector3` | `z` defaults to `0` |
| `ecTransform(overrides?)` | `ECTransform` | position/rotation (deg)/scale, all default identity |
| `ecMaterial(overrides?)` | `ECMaterial` | `shading` defaults to `"flat"` |
| `ecCircle(radius, opts?)` | `ECMesh` | Ring + center vertex, fan-filled |
| `ecRect(width, height, opts?)` | `ECMesh` | 4 corners, fan-filled |
| `ecPath(source, opts?)` | `ECMesh` | `source` = SVG-like `"M L C Z"` string or `ECVector2[]` |
| `ecLine(points, opts?)` | `ECMesh` | Alias of `ecPath` — stroke only, no fill |
| `ecPolygon(points, opts?)` | `ECMesh` | Closed, fan-filled |
| `ecGroup(children, transform?)` | `ECGroup` | Nested transforms apply to all children |
| `ecScene(children, opts?)` | `ECScene` | `environment` defaults to `"void"` |

---

### Vertex inspection

Every `ECMesh` exposes inspection methods — useful for procedural graphics
and advanced animation:

```ts
const mesh = ecCircle(50);

mesh.vertexCount();  // number of vertices
mesh.faceCount();     // number of triangles (fan/indexed topology)
mesh.bounds();        // { min: ECVector3, max: ECVector3 }
mesh.center();         // ECVector3 — bounding-box center
mesh.vertices;         // raw Float32Array — read directly for custom processing
```

---

### Artistic shading

EngineCanvas V2 deliberately avoids physically-based lighting. Two modes:

| `material.shading` | Effect |
|---------------------|--------|
| `"none"` | No lighting pass — pure fill/stroke |
| `"flat"` (default) | Solid fill, high contrast, no gradient |
| `"rim"` | Flat fill + a soft edge highlight in `rimColor` at `rimIntensity` (0–1) — cartoon/illustration look |

```ts
ecMaterial({
  fill:         "#1a1a2e",
  shading:      "rim",
  rimColor:     "#60a5fa",
  rimIntensity: 0.6,
})
```

---

### The Void

Default environment for both 2D and 3D scenes — no background, no HDRI,
no sky, no fog, no floor. Infinite empty space.

```ts
ecScene(children, { environment: "void" })   // default, can be omitted
ecScene(children, { environment: "custom", background: "#0c1220" })
```

---

### Engine2D example

```ts
{
  type: "canvas",
  props: {
    mode: "2d",
    width: 400,
    height: 400,
    graphics: {
      engine: "2d",
      scene: ecScene([
        ecCircle(60, { material: ecMaterial({ fill: "#60a5fa", shading: "flat" }) }),
        ecRect(80, 40, {
          transform: ecTransform({ position: ecVec3(100, 0, 0) }),
          material: ecMaterial({ fill: "#a78bfa", shading: "rim", rimColor: "#f472b6" }),
        }),
      ]),
    },
  },
}
```

---

### Engine3D example

Three.js is dynamically imported — only fetched on pages that actually
set `graphics.engine: "3d"`.

```ts
{
  type: "canvas",
  props: {
    mode: "webgl2",
    width: 500,
    height: 400,
    graphics: {
      engine: "3d",
      scene: ecScene(
        [
          ecRect(1, 1, { material: ecMaterial({ fill: "#60a5fa", shading: "rim", rimColor: "#a78bfa" }) }),
        ],
        {
          environment: "void",
          camera: { position: ecVec3(0, 0, 5), fov: 60, lookAt: ecVec3(0, 0, 0) },
        },
      ),
    },
  },
}
```

---

### EngineSVG — import / export

```ts
import { importSVG, exportSVG, ecScene } from "@/engine";

// Import an existing SVG file's shapes as ECMesh nodes
const nodes = importSVG(svgFileContents);
const scene = ecScene(nodes);

// Export a scene back to a standalone SVG string
const svgString = exportSVG(scene, 400, 400);
```

Or render live as DOM-backed SVG via the canvas graphics prop:

```ts
{
  type: "canvas",
  props: {
    graphics: { engine: "svg", scene: myScene },
  },
}
```

In `"svg"` mode the underlying `<canvas>` element is hidden and an `<svg>`
element is injected alongside it — giving crisp vector output that scales
to any zoom level, unlike the pixel-based `"2d"`/`"3d"` engines.

---

### EngineSkia — not yet implemented

`engine: "skia"` is a registered, forward-compatible name. Calling it
currently throws a clear error pointing to `"2d"` or `"3d"` as alternatives.
The real implementation is planned for a future release using CanvasKit
(Skia compiled to WebAssembly) for GPU-accelerated vector rendering,
professional text rendering, and high-quality clipping/gradients.

---

### Registering a custom rendering engine

```ts
import { registerRenderingEngine, type RenderingEngine } from "@/engine";

class MyEngine implements RenderingEngine {
  readonly name = "my-engine";
  init(context) { /* ... */ }
  render(scene, delta, frame) { /* ... */ }
  resize(width, height) { /* ... */ }
  dispose() { /* ... */ }
}

registerRenderingEngine("my-engine", () => new MyEngine());

// Now usable anywhere:
{ type: "canvas", props: { graphics: { engine: "my-engine", scene } } }
```
