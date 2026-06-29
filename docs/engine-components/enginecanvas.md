# EngineCanvas

> GPU-accelerated canvas with adaptive DPR, RAF loop management, and automatic
> pause-when-offscreen. Supports 2D, WebGL, and WebGL2 contexts.

---

## canvas

A canvas node that uses the GPU correctly and doesn't lag.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `"2d"\|"webgl"\|"webgl2"\|"auto"` | `"auto"` | Rendering context. "auto" tries webgl2 → webgl → 2d |
| `width` | `number` | — | Fixed width in px. Omit for responsive |
| `height` | `number` | — | Fixed height in px. Omit for responsive |
| `responsive` | `boolean` | `true` when no width/height | Fill container, resize automatically |
| `dpr` | `number\|"auto"` | `"auto"` | Device pixel ratio for sharp rendering |
| `maxDpr` | `number` | `2` | DPR cap — prevents 3× rendering on 3× displays |
| `adaptive` | `boolean` | `true` | Reduce DPR when FPS < 30, restore when > 55 |
| `pauseWhenOffscreen` | `boolean` | `true` | Stop RAF when canvas leaves viewport |
| `pauseWhenHidden` | `boolean` | `true` | Stop RAF when browser tab is hidden |
| `alpha` | `boolean` | `false` | Transparent canvas — set false for a free GPU win |
| `antialias` | `boolean` | `true` | WebGL MSAA — disable for particle systems |
| `powerPreference` | `string` | `"high-performance"` | Requests discrete GPU on dual-GPU laptops |
| `onSetup` | handler name | — | One-time setup — receives `(ctx, canvas)`, return cleanup fn |
| `onDraw` | handler name | — | Per-frame callback — `(ctx, canvas, delta, frame)` |
| `onResize` | handler name | — | Resize callback — `(ctx, canvas, cssW, cssH)` |

Handlers are registered in `createPage({ handlers: { myDraw: (ctx, canvas, delta) => { ... } } })`.

### 2D example

```ts
createPage({
  schema: defineSchema({
    root: {
      type: "canvas",
      props: {
        mode: "2d",
        responsive: true,
        style: { height: "400px" },
        onSetup: "setupCanvas",
        onDraw:  "drawCanvas",
      }
    }
  }),
  handlers: {
    setupCanvas(ctx, canvas) {
      ctx.font = "bold 16px sans-serif";
      return () => { /* cleanup on unmount */ };
    },
    drawCanvas(ctx, canvas, delta) {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.fillText(`Δ ${delta.toFixed(1)}ms`, 16, 32);
    },
  }
});
```

### WebGL 3D example

```ts
handlers: {
  setup3D(gl) {
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // compile shaders, create VAOs...
    return () => { gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  },
  draw3D(gl, canvas, delta) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // draw calls...
  },
}
```

### Why it's faster than a plain canvas

- **`desynchronized: true`** (2D) — the browser presents the canvas without waiting for the main-thread compositor. This eliminates a full frame of latency on every draw call.
- **`powerPreference: "high-performance"`** (WebGL) — on laptops with both integrated and discrete GPUs, this requests the dedicated GPU.
- **`contain: strict`** — prevents the canvas's layout from triggering reflows in sibling elements during animation.
- **`transform: translateZ(0)` + `will-change: transform`** — promotes the canvas to its own GPU compositor layer.
- **Adaptive DPR** — if the GPU falls behind (FPS < 30), pixel density is reduced automatically and restored when headroom returns.
- **Pause when hidden/offscreen** — Page Visibility API + IntersectionObserver stop the RAF loop entirely when the canvas isn't visible, saving battery and preventing frame buildup.


---
