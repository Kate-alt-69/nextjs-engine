# EngineShader (ESH)

EngineShader is Next.js Engine's compiled GPU-surface system.

Source shaders live under:

```text
data/shader/public/**/*.shed
```

The Engine plugin compiles them to content-addressed runtime artifacts under:

```text
public/_static/shader/**/*.shed.dat
public/_static/shader/manifest.json
```

Application code refers to the **logical shader name**, never the generated hash or `.shed.dat` filename.

```ts
{
	type: "card",
	props: {
		shader: "aurora",
	},
}
```

`data/shader/public/aurora.shed` is therefore addressed as `"aurora"`.
Nested files keep their logical path: `data/shader/public/background/aurora.shed` becomes `"background/aurora"`.

## Why `.shed` and `.shed.dat` are separate

`.shed` is the human-authored language. The browser does not parse it.

At build/dev time the ESH compiler:

1. parses the arrow-based shader schema;
2. validates variables, constants, runtime inputs and render-graph edges;
3. folds compile-time constants;
4. infers whether the shader is static, event-driven or animated;
5. lowers supported stages/effects into prepared GPU shader source;
6. records only the runtime variables/buffers the program actually needs;
7. writes a content-hashed `ESH1` `.shed.dat` artifact and manifest entry.

The `.shed.dat` file is an EngineShader binary artifact containing the compiled render plan and prepared GPU program source. It is **not hardware-specific GPU machine code**: browsers still have to create/link the WebGL program because NVIDIA, AMD, Intel, Apple and mobile drivers do not share one portable GPU binary format.

The expensive `.shed` parsing and semantic analysis therefore stays out of the client runtime, while the final driver shader compilation happens where it has to happen: on the device.

## Language shape

ESH uses visual data-flow syntax rather than JSON, CSS or raw GLSL.

```shed
shader <= pixelAurora => [
	var <= speed => .55
	const <= pixelSize => 4

	render => [
		resolution => .25
		filter => nearest
	]

	before.aurora => [
		time <= system.time
		speed <= var.speed
		colors => [#071126 #5b21b6 #06b6d4]
	]

	after.pixel => [
		use => pixelate
		size <= const.pixelSize
	]

	after.grade => [
		use => palette
		colors => 24
	]

	overlay.scanlines => [
		strength => .05
	]

	frame.color => after.pixel
	after.pixel => after.grade
	after.grade => screen
]
```

The visual rules are:

```text
TYPE <= NAME => VALUE        declaration
thing.property => value      assignment/configuration
thing.property <= source     input/dependency
source => destination        render-graph flow
thing => [ ... ]             scope
[value value value]          inline list
```

Comments use `#`:

```shed
# This is a comment.
```

## Variables

Runtime-mutable shader data is declared with `var`:

```shed
var <= speed => .6
var <= intensity => .8
var <= mainColor => #6d5dfc
```

Read it with a left-facing dependency arrow:

```shed
before.aurora => [
	speed <= var.speed
	intensity <= var.intensity
]
```

A variable can be overridden from the schema without recompiling the `.shed` program:

```ts
{
	type: "card",
	props: {
		shader: {
			src: "aurora",
			variables: {
				speed: 1.1,
				intensity: 0.65,
			},
		},
	},
}
```

Only variables actually referenced by a compiled binding are emitted as GPU uniforms.

## Constants

Compile-time data uses `const`:

```shed
const <= pixelSize => 4
```

Then:

```shed
after.pixel => [
	size <= const.pixelSize
]
```

Constants are immutable. This is a compiler error:

```shed
const.pixelSize => 8
```

Because constants are known during the build, ESH can inline/fold them instead of allocating runtime uniform state.

## Built-in runtime inputs

Current ESH v1 inputs are:

```text
system.time
system.delta
system.frame

pointer.x
pointer.y

scroll.position

viewport.width
viewport.height
```

The arrow itself gives the optimizer dependency information.

```shed
time <= system.time
```

makes the program animated.

```shed
position <= scroll.position
```

makes it event-driven through EngineScroll.

A shader with no dynamic inputs is static and renders only when needed.

## Automatic execution modes

ESH derives the cheapest execution mode from the compiled dependency graph:

| Mode | Trigger | Runtime behavior |
|---|---|---|
| `static` | no dynamic inputs | draws the required frame and stays idle |
| `event` | pointer, scroll or viewport inputs | draws when the dependency changes; repeated events are coalesced into one RAF |
| `animated` | time/delta/frame input | joins the shared EngineShader RAF scheduler |

Authors do not add `animated: true` or create their own scroll/pointer RAF loops.

## Surface shaders

Schema surfaces currently supported by the automatic no-wrapper bridge are:

```text
box
stack
grid
section
hero
card
```

Example:

```ts
{
	type: "grid",
	props: {
		columns: 3,
		gap: "1rem",
		shader: "aurora",
	},
	children: [/* ... */],
}
```

The schema renderer keeps the actual Grid/Card/etc. as the layout element. ESH portals its GPU canvas directly into that element, so the shader does not introduce an extra wrapper that would become a flex/grid item.

The host surface reserves its normal layout immediately but remains visually gated until the required shader artifact has loaded, the WebGL program is ready and frame 1 has rendered. Shader/WebGL failure reveals the normal surface rather than leaving it permanently hidden.

Buttons, inputs and other interactive controls are intentionally **not** automatically converted into shader surfaces.

## EngineCanvas shader mode

`EngineCanvas` can use ESH as its renderer directly:

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

Or directly:

```tsx
<EngineCanvas
	shader={{
		src: "aurora",
		variables: { speed: 0.8 },
	}}
	style={{ height: 420 }}
/>
```

When `shader` is present, the public EngineCanvas facade gives the canvas to EngineShader directly. It does **not** create a normal EC canvas and then layer another shader canvas over it, so there is no duplicate canvas or duplicate animation loop.

ESH-owned Canvas mode and `graphics`/`onDraw` mode are alternatives in v1. Applying ESH as a true post-process graph to an existing Engine2D/Engine3D scene is a later compositor/buffer feature.

## Pipeline stages in surface v1

The language reserves four pipeline stages:

```text
before
render
after
overlay
```

Surface ESH v1 lowers those stages into one optimized WebGL fragment program. This gives the language a stable pipeline model now without pretending arbitrary DOM has a browser framebuffer that NE can sample.

### `before`

Procedural source generation currently supports:

| Effect | Purpose |
|---|---|
| `gradient` | vertical color gradient |
| `aurora` | animated procedural aurora field |
| `noise` | procedural noise field |

Example:

```shed
before.aurora => [
	time <= system.time
	speed => .6
	scale => 1.3
	intensity => .9
	colors => [#6d5dfc #20d9c2]
]
```

### `render`

Current render controls:

```shed
render => [
	resolution => .25
	filter => nearest
	fallback => #090b16
]
```

`resolution` changes the actual shader backing-store density. A value of `.25` can therefore reduce fragment work dramatically instead of rendering full-resolution pixels and merely making them look blocky afterward.

`filter => nearest` marks the shader canvas as pixelated/nearest-style output.

### `after`

Current surface effects:

```text
pixel / pixelate
palette
dither
glow / bloom
```

Surface pixelation is compiler-lowered into a coordinate sampling prepass so the procedural `before` output is genuinely generated on the pixel grid. `palette`, `dither` and the v1 single-pass glow boost run on the resulting color.

True multi-sample framebuffer bloom is reserved for the future multi-pass compositor and should not be confused with the lightweight surface `bloom` alias in v1.

### `overlay`

Current overlay effects:

```text
grain
scanlines
vignette
```

These are applied last in the surface program.

## Render-graph arrows

Named effects can be connected visually:

```shed
frame.color => after.pixel
after.pixel => after.grade
after.grade => screen
```

ESH validates graph references and uses same-stage edges to determine effect ordering. Cyclic same-stage graphs fail compilation instead of producing undefined runtime behavior.

The graph model intentionally exists before every planned framebuffer is implemented, so future multi-pass ESH can keep the same source language.

## Automatic performance behavior

ESH runtime currently applies these optimizations automatically:

- `.shed` source is parsed/validated only at build/dev compile time;
- client fetches only the manifest/artifact required by a rendered shader surface;
- content-hashed `.shed.dat` filenames prevent stale shader reuse after edits;
- one shared RAF scheduler services animated ESH programs;
- event shaders coalesce repeated events into one requested frame;
- static shaders do not own a permanent RAF;
- runtime variables upload only when their value signature changes;
- shader canvases resize through `ResizeObserver` rather than measuring layout every animation frame;
- offscreen surfaces skip drawing through `IntersectionObserver`;
- hidden tabs skip rendering;
- `prefers-reduced-motion` converts continuous animated ESH into a non-continuous frame;
- layer shaders default to a lower 30 FPS target while dedicated Canvas shaders target 60 FPS;
- layer shaders use a lower-power GPU preference by default;
- adaptive resolution lowers/recovers backing density from measured frame timing;
- `render.resolution` can deliberately render well below device DPR for pixel-art or inexpensive ambient effects.

## Dev updates

During `next dev`, the shader plugin watches `data/shader/public/**/*.shed`.

Editing a shader causes:

```text
.shed edit
	↓
transactional recompile
	↓
new content hash + manifest revision
	↓
active development ESH runtime sees revision change
	↓
new .shed.dat is fetched
	↓
GPU program is recreated
```

A failed `.shed` compile does not replace the last-known-good generated shader directory.

## Plugin setup

The normal combined plugin compiles EngineAPI/APIStatic and EngineShader together:

```js
const withEngine = require("./src/engine/plugins/enginePlugin");

module.exports = withEngine(nextConfig);
```

Package consumers use:

```js
const withEngine = require("nextjs-engine/plugin");
```

Optional configuration:

```js
module.exports = withEngine(nextConfig, {
	shader: {
		shaderDir: "data/shader/public",
		shaderOutputDir: "public/_static/shader",
	},
});
```

The dedicated shader-only plugin remains available as `nextjs-engine/shader-plugin`.

## Current browser boundary

ESH does not claim that WebGL can capture and rewrite Chrome's final arbitrary DOM compositor framebuffer.

Surface shaders own their own GPU layer. ESH-owned Canvas shaders own the Canvas output. Future EngineCanvas/compositor integration can expose real color/depth/normal/velocity/history buffers for multi-pass rendering.

The following names are already reserved for that direction, but unsupported surface-buffer reads fail compilation clearly instead of returning fake values:

```text
frame.depth
frame.normal
frame.velocity
frame.previous
frame.history
```

That keeps `.shed` source forward-compatible with the intended render-pipeline architecture without lying about what surface ESH v1 can render today.
