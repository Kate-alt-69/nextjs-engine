# EngineManim — 2D & 3D Animation

> Declarative Manim-style 2D animation on HTML Canvas (Float32Array geometry pools).
> Three.js GLTF/OBJ 3D renderer with DSL bone animation.

---

## EngineManim 2D

### manim

Schema type: `"manim"` | `"EngineManim"` — Declarative 2D Manim-style animation on an HTML Canvas. Compiles `cprop.manim` into Float32Array geometry pools once (WeakMap cache) and drives `EngineCanvas` via a zero-allocation RAF loop.

```ts
{
  type: "manim",
  props: {
    cprop: {
      manim: {
        mobjects: [
          { id: "ring",   type: "Circle", radius: 50, strokeColor: "var(--e-accent)", strokeWidth: 3 },
          { id: "square", type: "Square", sideLength: 80, strokeColor: "var(--e-accent)", strokeWidth: 3 },
        ],
        timeline: [
          { action: "Create",    target: "ring",   durationMs: 600 },
          { action: "Transform", origin: "ring",   target: "square", durationMs: 800 },
          { action: "FadeOut",   target: "square", durationMs: 400 },
        ],
        settings: { loop: true, fpsLimit: 60 },
      },
    },
  },
}
```

**Supported mobject types:** `Circle`, `Square`, `Rectangle`, `Line`, `Path` (SVG `d` string).

**Supported actions:** `Create` (draw-on reveal), `FadeIn`, `FadeOut`, `Transform` (morphs geometry via equal-point interpolation), `Wait`.

**Easing:** `linear` | `ease-in` | `ease-out` | `ease-in-out` | `bounce` | `elastic`.

---

---

## EngineManim 3D

### manim3d

Schema type: `"manim3d"` | `"EngineManim3D"` — Three.js-backed 3D renderer with GLTF/OBJ support and a DSL for bone animation.

| Tier | Feature |
|---|---|
| 1 | Static GLTF / GLB / OBJ mesh → WebGL |
| 2 | GLTF built-in animation clip playback |
| 2.5 | Animation routing — clip from file OR full DSL override, per-bone overrides |
| 3 | DSL `frame()` blocks driving bone transforms by name |
| 4 | Constraint bindings: `camera.look.content = boneName` |

```ts
{
  type: "manim3d",
  props: {
    cprop: {
      manim3d: {
        src: "/models/character.glb",
        camera: { position: [0, 2, 5], fov: 60, look: { content: "head" } },
        lights: [
          { type: "ambient",     intensity: 0.4 },
          { type: "directional", intensity: 0.8, direction: [1, -1, 0.5] },
        ],
        animation: {
          source: "file",
          clip:   "walk_cycle",
          overrides: [
            {
              bone:   "left.hand",
              mode:   "replace",
              frames: [{ frameStart: 0, frameEnd: 30, transforms: [{ bone: "left.hand", rotate: [0, 45, 0] }] }],
            },
          ],
        },
        settings: { loop: true, fps: 60, shadows: true },
      },
    },
  },
}
```

**DSL format** (inline via `animation.dsl` or a `.manim` file):

```
# Frame blocks — Blender-style frame ranges
frame (
  frame-start = 120
  frame-end   = 240
) {
  left.hand.rotate  = [0, 45, 0]
  right.leg.rotate  = [30, 0, 0]
  2.tentacle.move   = [10, 0, 0]
}

# Camera constraints (Tier 4)
camera.look.content   = head
camera.focus.distance = 5
camera.position       = [0, 2, 5]

# Light settings
light.sun.direction = [1, -1, 0.5]
light.sun.intensity = 0.9
```

Rules: bone transforms (`.move` / `.rotate` / `.scale`) are **only valid inside `frame()`**. Camera and light settings are **only valid at top level**. Bone name is everything before the last dot: `left.hand`, `2.tentacle`.

**Three.js** is a peer dependency dynamically imported — only fetched on pages that actually use `manim3d`.

---
