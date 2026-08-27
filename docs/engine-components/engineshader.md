# EngineShader (ESH)

EngineShader is Next.js Engine's compiled GPU-surface system.

The human-authored language uses `.shed` files. NE compiles those files during development/build into small runtime artifacts that the browser can load without parsing the source language again.

Current source location:

```text
data/shader/public/**/*.shed
```

Default generated output:

```text
public/_static/shader/**/*.shed.dat
public/_static/shader/manifest.json
```

Application code uses a **logical shader name**, not a generated hash and not the `.shed.dat` filename.

```ts
{
	type: "card",
	props: {
		shader: "aurora",
	},
}
```

`data/shader/public/aurora.shed` is called `"aurora"`.

Nested paths stay part of the logical name:

```text
data/shader/public/background/aurora.shed
```

becomes:

```ts
shader: "background/aurora"
```

---

## Start here: make your first shader

### 1. Enable the Engine plugin

Package app:

```js
// next.config.js
const withEngine = require("nextjs-engine/plugin");

module.exports = withEngine({});
```

Source workspace:

```js
const withEngine = require("./src/engine/plugins/enginePlugin");

module.exports = withEngine({});
```

The combined plugin handles both Engine API tooling and EngineShader compilation.

### 2. Create the shader file

Create:

```text
data/shader/public/first.shed
```

Write:

```shed
shader <= first => [
	before.gradient => [
		colors => [#071126 #5b21b6]
	]
]
```

This is a static two-color gradient.

### 3. Put it on a surface

```ts
{
	type: "card",
	props: {
		shader: "first",
		p: "2rem",
	},
	children: [
		{
			type: "heading",
			props: {
				content: "GPU card",
			},
		},
	],
}
```

NE keeps the Card as the real layout element and attaches the shader canvas to that surface without adding a new flex/grid wrapper.

---

## The `.shed` language in one minute

ESH is not CSS, JSON, or raw GLSL. It is a small data-flow language.

The basic rules are:

```text
TYPE <= NAME => VALUE        declaration
thing.property => value      assignment
thing.property <= source     dependency/binding
source => destination        render-graph flow
thing => [ ... ]             scope/block
[value value value]          inline list
```

Example:

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
		colors => [
			#071126
			#5b21b6
			#06b6d4
		]
	]

	after.pixel => [
		use => pixelate
		size <= const.pixelSize
	]

	frame.color => after.pixel
	after.pixel => screen
]
```

Read it as:

```text
make shader pixelAurora
	↓
create runtime variable speed
create compile-time constant pixelSize
	↓
render at quarter density with nearest filtering
	↓
generate an animated aurora before stage
	↓
pixelate the resulting color
	↓
send the result to screen
```

---

## Comments and colors

A normal leading `#` line is a comment:

```shed
# This explains the next effect.
```

Valid hex colors are treated as values rather than comments:

```shed
colors => [
	#071126
	#5b21b6
]
```

Supported color literal lengths are:

```text
#RGB
#RGBA
#RRGGBB
#RRGGBBAA
```

Lists can be inline:

```shed
colors => [#071126 #5b21b6 #06b6d4]
```

or vertical:

```shed
colors => [
	#071126
	#5b21b6
	#06b6d4
]
```

Do not mix list-only values and named fields inside the same `[]` block.

---

## Variables: values you can change at runtime

Declare a runtime variable with `var`:

```shed
var <= speed => .6
var <= intensity => .8
var <= mainColor => #6d5dfc
```

Use it with `<=`:

```shed
before.aurora => [
	speed <= var.speed
	intensity <= var.intensity
]
```

Override it from schema without recompiling the `.shed` file:

```ts
{
	type: "section",
	props: {
		shader: {
			src: "aurora",
			variables: {
				speed: 1.1,
				intensity: 0.65,
				mainColor: "#8b5cf6",
			},
		},
	},
}
```

Current runtime variable value types are:

```ts
number
boolean
string
readonly number[]
```

The compiler infers a GPU uniform type from the default value:

```text
number          → float
boolean         → bool/float upload
2-number list   → vec2
3-number list   → vec3
4-number list   → vec4
hex color       → color / vec4
```

Only variables referenced by the **surviving optimized graph** become GPU uniforms.

---

## Constants: values known at build time

Declare a constant with `const`:

```shed
const <= pixelSize => 4
```

Use it:

```shed
after.pixel => [
	size <= const.pixelSize
]
```

Constants are immutable. This is invalid:

```shed
const.pixelSize => 8
```

Compile-time constants can be folded directly into generated GPU code, so they do not need runtime uniform updates.

Use `const` when the page should not change the value while running. Use `var` when application code needs to override it.

---

## Runtime inputs

Current surface ESH v1 inputs are:

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

Bind them with `<=`:

```shed
before.aurora => [
	time <= system.time
]
```

```shed
overlay.vignette => [
	position <= pointer.x
]
```

```shed
after.someEffect => [
	amount <= scroll.position
]
```

The dependency is not only a value source; it tells the compiler/runtime **when the shader needs to draw**.

---

## Automatic execution modes

The compiler derives the cheapest execution mode after graph optimization.

| Mode | Surviving inputs | Runtime behavior |
|---|---|---|
| `static` | no dynamic inputs | draws the required frame and stays idle |
| `event` | pointer, scroll, viewport | redraws when those inputs change; repeated events coalesce into one RAF |
| `animated` | time, delta, or frame | joins the shared EngineShader RAF scheduler |

Example static shader:

```shed
shader <= staticGradient => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]
]
```

Example animated shader:

```shed
shader <= movingAurora => [
	before.aurora => [
		time <= system.time
		speed => .7
	]
]
```

Example event-driven shader:

```shed
shader <= pointerGlow => [
	before.gradient => [
		colors => [#111827 #312e81]
	]

	overlay.vignette => [
		strength => .2
		position <= pointer.x
	]
]
```

You do not add `animated: true`, make your own RAF, or add a React state update every frame.

---

## Pipeline stages

ESH reserves four visual stages:

```text
before
render
after
overlay
```

Current surface v1 compiles these into one optimized WebGL fragment program. The stage names are already shaped for the future multi-pass compositor.

### `before`

Creates the base procedural color/image for the shader surface.

Current effects:

| Effect | Main fields | Defaults / notes |
|---|---|---|
| `gradient` | `colors`, or `start`/`end`, or `from`/`to` | vertical two-color mix |
| `aurora` | `colors`, `speed`, `scale`, `intensity`, `time` | animated procedural field |
| `noise` | `amount`, `time` | procedural noise source |

Gradient:

```shed
before.gradient => [
	colors => [#030712 #312e81]
]
```

Aurora:

```shed
before.aurora => [
	time <= system.time
	speed => .6
	scale => 1.3
	intensity => .9
	colors => [#6d5dfc #20d9c2]
]
```

Noise:

```shed
before.noise => [
	time <= system.time
	amount => .08
]
```

### `render`

Controls how the GPU surface itself is rendered.

```shed
render => [
	resolution => .25
	filter => nearest
	fallback => #090b16
]
```

Current fields:

| Field | Meaning |
|---|---|
| `resolution` | backing-store scale, clamped to `0.125..2` |
| `filter` | `linear` or `nearest` |
| `fallback` | fallback surface color/value stored in the compiled plan |

`resolution => .25` means the shader can render at one-quarter normal density instead of paying full-resolution fragment cost.

`filter => nearest` gives a hard nearest/pixelated presentation.

### `after`

Processes the color produced by the `before` stage.

Current effects:

| Effect | Fields | What it does now |
|---|---|---|
| `pixel` / `pixelate` | `size` | quantizes shader sample coordinates into a pixel grid |
| `palette` | `colors` | reduces color precision |
| `dither` | `strength` | adds deterministic dither noise |
| `glow` / `bloom` | `strength` | lightweight single-pass color boost |

Pixelate:

```shed
after.pixel => [
	use => pixelate
	size => 6
]
```

Palette:

```shed
after.palette => [
	use => palette
	colors => 16
]
```

Dither:

```shed
after.dither => [
	use => dither
	strength => .035
]
```

Bloom/glow:

```shed
after.glow => [
	use => bloom
	strength => .2
]
```

Current `bloom` is intentionally lightweight. It is **not yet** a multi-sample framebuffer bloom pass.

### `overlay`

Runs last.

Current effects:

| Effect | Fields | Purpose |
|---|---|---|
| `grain` | `strength`, `time` | film/noise grain |
| `scanlines` | `strength` | CRT-style horizontal scanline modulation |
| `vignette` | `strength` | darkens the edges |

```shed
overlay.grain => [
	time <= system.time
	strength => .02
]

overlay.scan => [
	use => scanlines
	strength => .05
]

overlay.vignette => [
	strength => .25
]
```

---

## Naming an effect block

The block name does not always need to be the effect name. Use `use` when you want a custom block name.

Both are valid:

```shed
after.pixelate => [
	size => 4
]
```

```shed
after.myPixelPass => [
	use => pixelate
	size => 4
]
```

Custom block names are useful when the render graph needs clear pass names.

---

## Render-graph arrows

Connect visual passes with `=>`.

```shed
frame.color => after.pixel
after.pixel => after.grade
after.grade => screen
```

This describes order and output reachability.

Example:

```shed
shader <= ordered => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]

	after.ditherPass => [
		use => dither
		strength => .02
	]

	after.palettePass => [
		use => palette
		colors => 12
	]

	frame.color => after.ditherPass
	after.ditherPass => after.palettePass
	after.palettePass => screen
]
```

The compiler rejects graph cycles and backward stage flows.

Do not read `frame.color` with `<=`. It is a graph surface and must be connected with `=>`.

---

## Dead-pass elimination

When at least one explicit path reaches `screen`, ESH traces backward from `screen` and keeps only the contributing `after`/`overlay` passes.

```shed
shader <= deadPassExample => [
	before.gradient => [
		colors => [#000000 #ffffff]
	]

	after.used => [
		use => palette
		colors => 8
	]

	after.notUsed => [
		use => dither
		strength => .9
		position <= pointer.x
	]

	frame.color => after.used
	after.used => screen
]
```

`after.notUsed` is still validated, but it does not survive into generated GPU work. Its `pointer.x` dependency disappears too.

That can change execution mode. A shader that looks event-driven in source can compile to `static` when all event-driven work is dead.

---

## Surface shaders

The no-wrapper shader bridge currently supports these schema surfaces:

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
	children: [
		/* ... */
	],
}
```

The schema renderer keeps the real Grid/Card/Section/etc. as the layout element. The GPU canvas is attached to that element rather than wrapping it in another layout container.

The host keeps its normal layout space immediately, but the visual surface is gated until the shader artifact loads, WebGL links successfully, and frame 1 is ready. A shader/WebGL failure reveals the normal surface instead of leaving it permanently invisible.

Interactive controls such as buttons and inputs do not advertise automatic shader-surface support.

---

## EngineShader JSX component

You can render EngineShader directly:

```tsx
import { EngineShader } from "nextjs-engine";

export function Background() {
	return (
		<EngineShader
			src="aurora"
			style={{
				width: "100%",
				height: 420,
			}}
		/>
	);
}
```

Or pass a shader object:

```tsx
<EngineShader
	shader={{
		src: "aurora",
		variables: {
			speed: .8,
		},
		fps: 45,
		maxDpr: 1.5,
		adaptive: true,
	}}
/>
```

Current EngineShader config:

```ts
interface EngineShaderConfig {
	src: string;
	variables?: Record<string, EngineShaderVariableValue>;
	fps?: number;
	maxDpr?: number;
	adaptive?: boolean;
	pauseWhenOffscreen?: boolean;
	pauseWhenHidden?: boolean;
	respectReducedMotion?: boolean;
	powerPreference?: "default" | "high-performance" | "low-power";
	className?: string;
	style?: CSSProperties;
}
```

Direct `EngineShader` also supports:

```ts
layer?: boolean
onReady?: () => void
onError?: (reason: unknown) => void
```

Layer mode defaults to a lower-power profile: 30 FPS target and low-power GPU preference. Dedicated shader canvases default to 60 FPS and high-performance preference unless overridden.

---

## EngineCanvas shader mode

EngineCanvas can hand its own canvas directly to ESH.

Schema:

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
	shader={{
		src: "aurora",
		variables: {
			speed: .8,
		},
	}}
	style={{ height: 420 }}
/>
```

When `shader` is present, EngineCanvas gives that same canvas to EngineShader. It does not create a normal EC renderer and then stack a second shader canvas on top.

Current v1 rule:

```text
shader mode
OR
graphics / onDraw mode
```

They are alternatives today. True post-processing of an existing Engine2D/Engine3D framebuffer belongs to the future compositor/buffer system.

---

## EngineScroll integration

A surviving `scroll.position` dependency makes the shader event-driven through the EngineScroll runtime.

```shed
shader <= scrollDriven => [
	var <= amount => .3

	before.aurora => [
		speed <= var.amount
		position <= scroll.position
	]
]
```

ESH does not need React state to receive scroll movement. The runtime listens to EngineScroll and requests a draw only when the dependency changes.

This is important for performance: scroll animation data does not need to bounce through React re-renders every frame.

---

## Automatic performance behavior

ESH currently does these things automatically:

- `.shed` parsing and semantic validation stay in build/dev tooling;
- compiled `.shed.dat` artifacts are content-addressed;
- explicit output graphs receive dead-pass/dead-dependency elimination;
- compile-time constants are folded;
- only referenced runtime variables become GPU uniforms;
- generated fragment source omits unused built-in uniforms/helpers;
- static shaders do not own a permanent RAF;
- event shaders coalesce repeated events into one requested frame;
- animated shaders share one EngineShader scheduler;
- fully offscreen animated shaders leave that scheduler;
- hidden tabs suspend shader animation work;
- `prefers-reduced-motion` blocks continuous animation by default;
- variable uploads are skipped while their value signature is unchanged;
- backing-store size follows `ResizeObserver` instead of per-frame layout reads;
- adaptive density can lower/recover DPR from measured frame timing;
- `render.resolution` can lower backing density before fragment work is paid;
- stale development artifact promises are pruned when the manifest changes.

---

## Artifact/build behavior

`.shed` is source code. `.shed.dat` is compiled ESH data.

The artifact is **not** hardware-specific GPU machine code. The browser must still compile/link the generated GLSL on the user's GPU because browsers/drivers do not share one portable GPU program binary.

The artifact starts with the `ESH1` format header and contains the prepared render plan.

The compiler also writes a manifest that maps logical names to hashed artifacts.

Example idea:

```text
aurora
	↓
aurora-4f2a9c01b712.shed.dat
```

Editing the source changes the hash. Old stale hashed artifacts are removed.

---

## Transactional build safety

The normal Next plugin compiles into staging output and swaps generated shader output only after every source compiles successfully.

The low-level directory compiler also compiles all sources before mutating the final manifest/artifacts.

So a broken new `.shed` should not partially destroy the last-known-good generated set.

---

## Dev hot updates

During `next dev`, ESH watches:

```text
data/shader/public/**/*.shed
```

The source directory can be created on demand, so adding the first shader does not require restarting Next.

Typical update path:

```text
edit .shed
	↓
transactional recompile
	↓
new content hash + manifest revision
	↓
active runtime notices revision
	↓
new .shed.dat is fetched
	↓
GPU program is recreated
```

If a newly generated GPU program fails to link in development, EngineShader can return to its last successfully linked plan while reporting the error.

---

## Plugin configuration

Default:

```js
const withEngine = require("nextjs-engine/plugin");

module.exports = withEngine({}, {
	shader: {
		shaderDir: "data/shader/public",
		shaderOutputDir: "public/_static/shader",
	},
});
```

Change generated public location:

```js
module.exports = withEngine({}, {
	shader: {
		shaderOutputDir: "public/assets/esh",
	},
});
```

The runtime base path becomes:

```text
/assets/esh
```

Use an explicit URL for CDN/rewrite setups:

```js
module.exports = withEngine({}, {
	shader: {
		shaderOutputDir: "public/assets/esh",
		shaderBasePath: "https://cdn.example.com/esh",
	},
});
```

The resolved base path is exposed as `NEXT_PUBLIC_ENGINE_SHADER_BASE_PATH`.

If no explicit `shaderBasePath` is provided, `shaderOutputDir` must be inside `public/`. ESH fails configuration instead of silently generating browser-inaccessible files.

The shader-only plugin also remains available through `nextjs-engine/shader-plugin`.

---

## Low-level runtime exports

```ts
import {
	EngineShaderScheduler,
	clearEngineShaderCache,
	loadEngineShader,
	normalizeEngineShaderName,
} from "nextjs-engine";
```

Public types include:

```ts
EngineShaderConfig
EngineShaderExecution
EngineShaderInput
EngineShaderManifest
EngineShaderManifestEntry
EngineShaderRenderPlan
EngineShaderVariableDefinition
EngineShaderVariableValue
```

Most application code only needs the `shader` prop or `<EngineShader />`. The low-level loader/scheduler exports are mainly for advanced integrations and tooling.

---

## Current browser boundary

JavaScript/WebGL does not get a magic API for reading Chrome's final arbitrary DOM compositor framebuffer.

Current ESH therefore owns GPU surfaces that NE creates:

```text
schema surface shader
	→ ESH-owned layer

EngineCanvas shader mode
	→ ESH owns that Canvas output
```

The future compositor direction can expose real render buffers such as:

```text
frame.depth
frame.normal
frame.velocity
frame.previous
frame.history
```

Those names are reserved, but surface ESH v1 rejects them instead of returning fake data.

---

## About a future global `styles.shed`

The planned global shader idea is a **whole visual render pipeline**, not CSS with shader-like syntax.

The intended direction is that a future global pipeline could apply before/render/after/overlay effects to NE-owned visual output and eventually support real framebuffer post-processing.

That global arbitrary-page compositor is **not implemented in surface ESH v1**. Do not document or depend on this today:

```shed
# Future direction, not current API:
global => [
	after.pixel => [
		use => pixelate
	]
]
```

Current production code should attach `.shed` programs to supported Engine surfaces or use EngineCanvas shader mode.

The distinction keeps the docs truthful while leaving the language architecture compatible with the planned Minecraft-shader-like pipeline direction.

---

## Common mistakes

### Using `.shed.dat` in app code

Wrong:

```ts
shader: "aurora-a1b2c3.shed.dat"
```

Right:

```ts
shader: "aurora"
```

### Using `<=` for render-graph flow

Wrong:

```shed
after.pixel <= frame.color
```

Right:

```shed
frame.color => after.pixel
```

### Reassigning a constant

Wrong:

```shed
const <= size => 4
const.size => 8
```

Use `var` if the value needs to change.

### Expecting a dead pass to keep the shader animated

If the pass does not contribute to `screen`, the optimizer can remove it and its time/pointer/scroll dependency.

### Expecting full-page DOM post-processing today

Surface ESH v1 does not capture arbitrary browser-rendered DOM into a framebuffer. Use supported shader surfaces until the compositor exists.
