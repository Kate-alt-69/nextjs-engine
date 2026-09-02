# Next.js Engine 3 — Phase A + Phase B

> Development branch: `3_gen_main`
>
> This document describes the Generation 3 compiler/runtime foundation that is
> implemented on this branch. It is not part of the v2.6.2 runtime contract.

## Generation 3 invariant

Generation 3 optimizes **work**, not the intended visual quality of the page.

The default optimizer may delay, pause, reuse, cache, or avoid work that is not
currently useful. It does not automatically lower image quality, Canvas DPR,
Shader resolution, geometry detail, or other visual fidelity merely to make an
FPS counter reach the display refresh rate.

When the visible scene still cannot meet the delivered frame cadence after
waste is removed, the scene keeps its intended visual output and runs at the
frame rate the device can actually sustain.

## Phase A — compiler and server-first rendering

### EngineCompiler

`compilePage(schema)` converts a `PageSchema` into a deterministic Generation 3
plan before the renderer decides what must run in the browser.

The plan records:

- node runtime: `static`, `server`, or `client`;
- runtime explanation for developer tooling;
- work class: `critical`, `visible`, `near`, `deferred`, `idle`, or `sleeping`;
- browser capabilities actually used by the node;
- image/video/module/shader assets;
- heavy-runtime markers;
- client-island count;
- compiler diagnostics.

`createPage()` exposes the base plan as `Page.enginePlan`. This is intended for
dev tooling and the future `/_engine/debug` inspector.

```ts
import { compilePage } from "nextjs-engine";

const plan = compilePage(schema);

console.log(plan.summary.clientIslands);
console.log(plan.capabilities);
```

### Runtime classification

Static primitives remain on the server when they do not require browser state.
Browser-owned features become client islands.

Examples:

| Node | Normal Gen 3 runtime |
| --- | --- |
| `text`, `heading`, `box`, `grid`, `section` | static/server |
| ordinary `link` | server |
| link with an Engine transition | client island |
| `image` | server markup + browser resource |
| `video` | client island |
| `canvas`, Manim | client island |
| dialog/drawer/popover | client island |
| interactive form controls | client island |

The compiler also upgrades otherwise-static nodes when browser behavior is
attached through handlers, model bindings, animation, Shader behavior, or
other client-only props.

### Nested client islands

`EngineServerRenderer` server-renders child branches and passes them into a
client island through a reserved server-child slot. A client node nested inside
another client node therefore remains an independent island when its branch is
server-rendered separately. The compiler summary counts that layout correctly.

### Asset graph

The compiler records assets with their highest-priority use. If the same image
appears once below the fold and once as critical content, the deduplicated
asset remains critical rather than being downgraded by whichever occurrence
was visited last.

Video source arrays are expanded into their individual assets.

### Capability graph

Capabilities are recorded only when the compiled page uses them. Current
examples include:

- Canvas;
- WebGL/WebGL2 mode;
- requestAnimationFrame;
- IntersectionObserver;
- VisualViewport;
- media;
- View Transitions for animated Engine links.

This graph will feed the later compatibility compiler; an unused browser API
must not cause a compatibility warning.

### Server-first `createPage`

For schemas without the legacy named-handler boundary, `createPage()` uses the
Generation 3 server renderer by default.

```ts
export default createPage({
	schema,
});
```

A temporary migration escape hatch exists:

```ts
export default createPage({
	schema,
	compiler: {
		serverFirst: false,
	},
});
```

This keeps older pages usable while the Gen 3 client-boundary migration is
still in progress.

### Server-first `createComponent`

Reusable Engine components now use the same compiler/server renderer when they
do not require the legacy named-handler provider. Runtime slots and `children`
remain supported, so reusable page chrome does not need to become one large
client renderer merely because it was created with `createComponent()`.

### EngineServer

`nextjs-engine/server` exposes the server-only request surface. Browser-safe
compiler/runtime APIs remain in the normal package barrel; request-aware server
helpers stay out of client imports.

## Phase B — Scheduler

### Work states

The shared `EngineScheduler` models useful work as:

```text
critical
visible
near
deferred
idle
sleeping
```

The scheduler uses pooled IntersectionObservers instead of allocating one
observer for every lazy component. Empty pools are released.

### Frame pressure

Graphics work can acquire one shared refresh-aware frame monitor. The monitor
uses the EngineCanvas frame clock and measures delivered frame cadence rather
than assuming 60 Hz.

A normal frame interval is approximately `1.0` of its budget and is not treated
as overload. Pressure begins only after a sustained budget miss, and hysteresis
prevents rapid pressure/no-pressure oscillation.

Frame pressure changes scheduling priority. It does **not** change resolution.

When visible work is pressured:

- visible work remains eligible;
- near-viewport speculative mounting waits;
- near image request/decode work waits;
- near video initialization waits;
- idle work is postponed.

### LazyMount

`LazyMount` now consumes the shared scheduler.

```text
far away   -> fallback only
near        -> activate when frame budget allows
visible     -> activate immediately
after mount -> remain mounted
```

A temporary pressure event does not destructively unmount content that has
already activated.

### Images

Non-priority `EngineImage` resources are withheld until the image is near the
viewport and the visible frame budget has room, or until the image becomes
visible.

`priority: true` remains immediate.

Image resolution and configured quality remain unchanged.

### Video

`EngineVideo` withholds the actual `<video>`/`<source>` runtime until useful.
Visible video activates immediately; speculative near-viewport initialization
can wait during frame pressure. Offscreen autoplay video pauses.

### Canvas and Shader

Generation 3 changes the public Canvas default:

```text
adaptive DPR default = false
```

This applies to both `<EngineCanvas />` and the public low-level
`useEngineCanvas()` facade.

Developers who deliberately want the legacy dynamic-resolution behavior can
still opt in with `adaptive: true`.

The scheduler can monitor Canvas/Shader frame delivery while leaving DPR alone.

## Phase B — automatic phone/tablet layout compilation

`createPage()` accepts separate phone and tablet policies:

```ts
export default createPage({
	schema,
	mobile: "auto",
	tablet: "auto",
});
```

The URL and semantic page stay the same. NE compiles a request-appropriate
layout plan before rendering.

### Semantic compaction

The adaptive compiler recognizes layout roles from:

- `adaptiveRole` when explicitly supplied;
- standard roles such as `banner`, `navigation`, `main`, and `contentinfo`;
- node names containing common header/nav/footer/hero/content terms;
- built-in `nav`, `hero`, and `section` semantics.

Phone and tablet use distinct spacing limits. Existing large scalar spacing can
be capped for the smaller layout without touching colors, images, Canvas
resolution, or visual detail.

Developer-authored responsive spacing maps are preserved because they already
express an explicit layout decision.

Automatic spacing compaction can be disabled while keeping structural
adaptation:

```ts
mobile: {
	mode: "auto",
	compact: false,
}
```

### Container-driven structure

Wide numeric grids become `auto-fit` grids with a minimum useful card width.
The browser therefore chooses the actual column count from the component's
available container space rather than NE hardcoding "phone = one column".

Crowded stacks can wrap or become vertical where their semantics permit it.
Header/navigation rows are not blindly turned vertical.

Horizontal cards may become vertical on phones when keeping the row would
crush their content.

### Navigation and touch

`EngineNav` receives a target-appropriate compact-menu breakpoint when the
developer did not provide one.

Buttons and form controls receive a minimum touch target only when the developer
has not already specified one.

### Developer override always wins

Existing mobile patch arrays remain supported. In auto mode, patches execute
after automatic adaptation:

```text
base schema
-> automatic phone/tablet adaptation
-> developer patches
```

Use `props.adaptive = "keep"` on a node to opt that node out of automatic
adaptation.

## Phase B — EngineModel and viewport runtime

`EngineModel` provides observable application state without forcing unrelated
schema branches to become client-owned. The compiler marks only nodes that
actually bind to model state as client work.

Core operations include:

- `get` / `set` / `update` / `patch`;
- `computed` values;
- named actions;
- key watchers;
- whole-model subscriptions;
- React hooks for model snapshots and individual values.

`EngineViewport` provides one shared VisualViewport-aware snapshot for width,
height, scale, orientation, offsets, and keyboard inset. This avoids every
mobile-aware component owning its own resize listener.

## Compatibility while Gen 3 is under development

- v2.6.2 remains isolated on `main`.
- Generation 3 work stays on `3_gen_main`.
- Existing explicit mobile patch arrays remain valid.
- The v2 Canvas core still exists internally; the Gen 3 public facade changes
  the default without deleting the compatibility behavior.
- Pages/components using legacy named handlers temporarily retain the v2 client
  provider path until that boundary receives a safe Gen 3 migration.

## Regression coverage

`3_gen_main` CI runs:

- Phase A/B architecture contract smoke;
- compiler graph runtime smoke;
- adaptive compiler runtime smoke;
- normal TypeScript validation;
- optimized Next.js integration build;
- the existing v2 compatibility/runtime tests;
- Phase C tests when those sources are present on the branch.

The adaptive tests explicitly verify that image quality and Canvas DPR settings
survive phone compilation unchanged.
