# EngineCanvas (EC)

Schema type: `"canvas"`.

EngineCanvas owns canvas lifecycle, context creation, one animation loop,
responsive backing-store sizing, adaptive DPR, viewport/tab pausing, and the
optional EngineCanvas graphics runtime.

## Basic callback mode

```tsx
<EngineCanvas
  mode="2d"
  style={{ height: 420 }}
  onSetup={(ctx, canvas) => {
    // allocate long-lived resources here
  }}
  onDraw={(ctx, canvas, delta, frame) => {
    // draw one frame
    if (animationFinished) return false; // stop callback RAF
  }}
/>
```

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

A named `onDraw` handler follows the same completion contract and may return
`false` when it has no more frames to produce.

## Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `mode` | `"2d" \| "webgl" \| "webgl2" \| "auto"` | `"auto"` | Context selection |
| `width` / `height` | `number` | — | Fixed CSS size when supplied |
| `responsive` | `boolean` | inferred | Defaults true when width and height are omitted |
| `dpr` | `number \| "auto"` | `"auto"` | Target device-pixel ratio |
| `maxDpr` | `number` | `2` | Upper DPR cap |
| `adaptive` | `boolean` | `true` | Performance-driven DPR adjustment |
| `pauseWhenOffscreen` | `boolean` | `true` | Pauses RAF outside the viewport margin |
| `pauseWhenHidden` | `boolean` | `true` | Pauses RAF while the tab is hidden |
| `alpha` | `boolean` | `false` | Canvas/WebGL alpha buffer |
| `antialias` | `boolean` | `true` | WebGL antialias hint |
| `powerPreference` | WebGL power preference | `"high-performance"` | GPU preference hint |
| `onSetup` | function or handler name | — | Runs once after context creation; may return cleanup |
| `onDraw` | function or handler name | — | Per-frame callback; return `false` when complete |
| `onResize` | function or handler name | — | Receives CSS width/height |
| `graphics` | `{ engine, scene }` | — | Uses the EC graphics runtime instead of `onDraw` |

`className` and `style` apply directly to the `<canvas>`. There is no
placeholder-wrapper swap during mount.

Responsive canvases keep a `150px` minimum height unless the supplied `style`
overrides it. Give the parent or the canvas an explicit height for real layouts.

## Demand-driven callback RAF

Callback mode does not own an idle animation loop just because a canvas exists.
If there is no `onDraw`, EngineCanvas runs setup/resize lifecycle only and does
not schedule RAF.

When `onDraw` returns `false`, EngineCanvas treats that callback frame source as
complete and stops requesting frames. Offscreen/tab visibility transitions do
not accidentally restart a completed callback.

A responsive backing-store resize clears the native canvas bitmap. To preserve a
completed static/final frame, EngineCanvas wakes the callback for one redraw
after such a resize. If that callback still returns `false`, the loop stops again
immediately. Replacing the `onDraw` callback also wakes callback mode so changed
animation/data state can produce frames again.

The `false` completion signal applies only to callback mode. Graphics-engine
scenes continue to follow their renderer lifecycle.

## Context selection

`mode="auto"` tries WebGL2, then WebGL, then 2D. When a built-in graphics engine
requires a specific context, EngineCanvas adjusts the effective mode:

- `graphics.engine = "2d"` or `"svg"` uses a 2D context.
- `graphics.engine = "3d"` will not stay on an explicitly incompatible 2D context.

Built-in graphics engines are dynamically imported only when selected. A page
that uses ordinary 2D callbacks does not need to eagerly evaluate the 3D/SVG
implementations merely because they exist.

## Adaptive DPR

Adaptive DPR is deliberately rate-limited. EngineCanvas tracks a rolling FPS
window and considers a density change at most once every **750 ms**:

- average FPS below roughly `32` → lower DPR by `0.25`, down to `0.5`.
- average FPS above roughly `56` → raise DPR by `0.25` toward the configured target.

This avoids the previous anti-pattern of resizing the canvas backing store over
and over during consecutive animation frames. Backing-store changes are
propagated to graphics engines together with the new DPR, so Three.js and the
Canvas runtime do not fight over pixel dimensions.

## Pause behavior

Offscreen and hidden-tab pauses are tracked independently. Returning to the
viewport does not resume a canvas that is still in a hidden tab, and showing a
tab does not resume a canvas that remains offscreen.

The offscreen observer uses a `200px` root margin so drawing can resume shortly
before the canvas enters view.

## Graphics runtime

```ts
const scene = ecScene([
  ecCircle(60, {
    material: { fill: "#60a5fa" },
  }),
]);

{
  type: "canvas",
  props: {
    graphics: {
      engine: "2d",
      scene,
    },
    style: { height: 420 },
  },
}
```

Built-in engine names:

| Engine | Purpose | Current behavior |
|---|---|---|
| `2d` | Canvas 2D vector rendering | Retains compiled topology and `Path2D` geometry for unchanged meshes; paints each frame |
| `3d` | Three.js-backed EC meshes | Retained-mode objects and GPU-resource disposal |
| `svg` | DOM SVG renderer/import/export | Retained SVG DOM nodes; updates instead of rebuilding the tree every frame |
| `skia` | Future CanvasKit backend | Recognized but intentionally not implemented yet |

### Engine2D geometry caching

Engine2D separates geometry compilation from per-frame painting. For a stable
`ECMesh`, triangle topology, boundary edges, strip paths, fill paths, and outline
paths are cached. Transform and material values are still read every frame, so
moving, rotating, scaling, recoloring, changing opacity, and changing stroke
settings do not require rebuilding the geometry path.

The cache is invalidated when the mesh's `vertices` typed-array reference,
`indices` typed-array reference, topology, or vertex count changes. If you edit
vertex values in place, replace the typed array when you want the retained path
to be rebuilt. This is the same stable-geometry contract used by the retained 3D
path and avoids walking large vertex arrays on every RAF.

Browsers without `Path2D` support fall back to direct Canvas path construction.

### Engine3D retained mode

Engine3D keeps a map keyed by EC node id. Stable nodes reuse their Three.js
objects across frames. Transform/material values update in place. Geometry is
rebuilt only when the mesh's typed-array source or topology changes. Removed
nodes have their geometry/material resources explicitly disposed.

This is important for complex scenes: the renderer no longer clears the Three
scene and recreates every BufferGeometry/material/mesh on every RAF.

### EngineSVG retained mode

SVG mode likewise retains generated SVG elements instead of deleting and
recreating the complete DOM subtree every frame. The SVG importer reads real
`x1`, `y1`, `x2`, `y2` attributes for `<line>` elements.

## Custom rendering engines

The rendering contract is:

```ts
interface RenderingEngine {
  readonly name: string;
  init(context: ECRenderContext): void | Promise<void>;
  render(scene: ECScene, delta: number, frame: number): void;
  resize(width: number, height: number, dpr?: number): void;
  dispose(): void;
}
```

`dpr` on `resize` is optional so existing custom engines that only consume CSS
dimensions remain compatible.

Register custom engines with `registerRenderingEngine(name, factory)`. Built-in
engines use direct dynamic imports; the registry fallback is used for custom
names.

## `useEngineCanvas`

For imperative integrations:

```tsx
const { canvasRef, setup } = useEngineCanvas({ mode: "webgl2" });

useEffect(() => setup({
  maxDpr: 2,
  adaptive: true,
  onDraw(gl, canvas, delta, frame) {
    // custom drawing
    if (finished) return false;
  },
}), [setup]);

return <canvas ref={canvasRef} />;
```

The low-level hook also avoids creating RAF when `onDraw` is absent and honors
`return false` as a completion signal. Unlike the component, the hook does not
own resize/offscreen/tab observers; those lifecycle conveniences remain the
caller's responsibility.
