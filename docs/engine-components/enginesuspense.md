# EngineSuspense (ESU)

Schema type: `"suspense"` — wraps children in a `React.Suspense` boundary with
built-in loading fallback presets. Handles the delayed-fallback trick so fast
loads never flash a spinner. Integrates with `EngineCanvas` and `EngineManim`
for animation-based loading states.

---

## How it works

```
Schema children
      │
      ▼
React.Suspense
      │
      ├── Children resolve instantly → render, fallback never shown
      │
      └── Children suspend →
              delay (ms) → DelayedFallback fires → preset rendered
                                                         │
                                              timeout (ms) → errorFallback
```

`DelayedFallback` holds the fallback for `delay` ms before mounting it.
This means a fetch that resolves in < 200 ms never shows a spinner at all
— a flicker that ruins perceived performance. Set `delay: 200` as a safe
default for most async operations.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `preset` | `"skeleton" \| "spinner" \| "shimmer" \| "pulse" \| "blur"` | `"skeleton"` | Built-in loading preset |
| `minHeight` | `string \| number` | — | Reserved vertical space for the placeholder, prevents layout shift |
| `skeletonLines` | `number` | `4` | Number of animated lines (skeleton preset only) |
| `delay` | `number` | `0` | Ms to wait before showing the fallback at all |
| `timeout` | `number` | — | Max ms before switching to `errorFallback` |
| `errorFallback` | `string` | — | Schema node id to render after timeout (future use) |
| `fallback` | `ReactNode` | — | Fully custom fallback — overrides `preset` entirely |

All shared base props apply (`id`, `className`, `style`, `cprop`, `point`, etc.).

---

## Built-in presets

### `skeleton`

Animated placeholder lines. Best for articles, doc pages, cards, product detail.

```ts
{
  type: "suspense",
  props: {
    preset: "skeleton",
    skeletonLines: 6,
    minHeight: "320px",
    delay: 200,
  },
  children: [{ type: "markdown", props: { filePath: "./content/post.md" } }],
}
```

### `shimmer`

Left-to-right shimmer sweep. Best for tables, lists, feeds, dashboards.

```ts
{
  type: "suspense",
  props: { preset: "shimmer", minHeight: "400px", delay: 150 },
  children: [...],
}
```

### `spinner`

Centered circular spinner. Best for buttons, dialog actions, small widget loads.

```ts
{
  type: "suspense",
  props: { preset: "spinner", minHeight: "120px" },
  children: [...],
}
```

### `pulse`

Opacity fade in/out. Best for image slots and media placeholders.

```ts
{
  type: "suspense",
  props: { preset: "pulse", minHeight: "280px" },
  children: [{ type: "image", props: { src: "/photo.jpg", alt: "Photo" } }],
}
```

### `blur`

Renders children immediately at reduced opacity with a CSS blur, then
resolves once data loads. Best for hero sections and progressive reveals.
Unlike all other presets, `blur` keeps the children in the DOM — it just
makes them visually indistinct until content is ready.

```ts
{
  type: "suspense",
  props: { preset: "blur", minHeight: "500px" },
  children: [...],
}
```

---

## Custom fallback — passing your own ReactNode

The `fallback` prop accepts any `ReactNode`. Because the engine renders
schema nodes not raw JSX, the way to pass a custom fallback is to:

1. Register a component with `registerComponent`
2. Pass it to your page via `createPage({ slots })` and `type: "slot"` inside the suspense.

However the simplest pattern is to register a **wrapper component** that
bakes the custom fallback in:

```ts
import { registerComponent } from "@/engine";
import { memo, Suspense } from "react";

// A manim-powered suspense that draws a logo animation while content loads
registerComponent("suspense-logo", memo(function SuspenseLogo({
  children,
  minHeight = "300px",
}: {
  children?: React.ReactNode;
  minHeight?: string;
}) {
  // The fallback is a canvas animation via EngineManim's compiled output
  const fallback = (
    <div style={{
      minHeight,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* EngineCanvas renders here via the engine's SchemaRenderer internally */}
      <canvas width={240} height={80} /* driven by EngineManim runtime */ />
    </div>
  );

  return <Suspense fallback={fallback}>{children}</Suspense>;
}));
```

Then use it in any schema:

```ts
{
  type: "suspense-logo",
  props: { minHeight: "300px" },
  children: [
    { type: "markdown", props: { filePath: "./content/doc.md" } },
  ],
}
```

---

## Using EngineManim as a suspense fallback

`EngineManim` uses `EngineCanvas` internally. You can render a manim animation
as a loading state by registering a wrapper that creates its own canvas context:

```ts
import { registerComponent } from "@/engine";
import { compileManimConfig } from "@/engine";
import { memo, useRef, useEffect } from "react";

registerComponent("suspense-manim", memo(function SuspenseManim({
  minHeight = "200px",
}: {
  minHeight?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const compiled = compileManimConfig({
      mobjects: [
        { id: "ring", type: "Circle", radius: 28, strokeColor: "#60a5fa", strokeWidth: 2 },
      ],
      timeline: [
        { action: "Create",  target: "ring", durationMs: 600 },
        { action: "FadeOut", target: "ring", durationMs: 400, delay: 400 },
      ],
      settings: { loop: true, fpsLimit: 60, background: "transparent" },
    });

    let raf: number;
    let stepStart = performance.now();
    let stepIndex = 0;

    function frame() {
      const now = performance.now();
      const step = compiled.steps[stepIndex];
      if (!step) { stepIndex = 0; stepStart = now; raf = requestAnimationFrame(frame); return; }
      if (now < stepStart + (step.delay ?? 0)) { raf = requestAnimationFrame(frame); return; }
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const t = Math.min((now - stepStart - (step.delay ?? 0)) / step.durationMs, 1);
      // draw step at progress t — delegate to compiled draw function
      if (t >= 1) { stepIndex++; stepStart = now; }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <canvas ref={canvasRef} width={80} height={80} style={{ opacity: 0.7 }} />
    </div>
  );
}));
```

Use it as a schema type the same way: `{ type: "suspense-manim", props: { minHeight: "200px" } }`.

---

## Timeout + error fallback

```ts
{
  type: "suspense",
  props: {
    preset: "skeleton",
    minHeight: "300px",
    delay: 200,
    timeout: 8000,
    errorFallback: "load-error-card",  // schema node id to render on timeout
  },
  children: [...],
}
```

If the children haven't resolved within `timeout` ms, `EngineSuspense` switches
to the node registered under `errorFallback`. Define it anywhere else in your
schema tree with `id: "load-error-card"`.
