# EngineShader (ESH)

EngineShader is Next.js Engine's compiled GPU-surface system. Human-authored shaders live under:

```text
data/shader/public/**/*.shed
```

The Engine plugin compiles them into content-addressed runtime artifacts. With the default configuration:

```text
public/_static/shader/**/*.shed.dat
public/_static/shader/manifest.json
```

Application code always uses the **logical shader name**, never a generated hash or `.shed.dat` filename.

```ts
{
	type: "card",
	props: {
		shader: "aurora",
	},
}
```

`data/shader/public/aurora.shed` is addressed as `"aurora"`. Nested files keep their logical path, so `data/shader/public/background/aurora.shed` becomes `"background/aurora"`.

## Why `.shed` and `.shed.dat` are separate

`.shed` is the human-authored language. The browser does not parse it.

At build/dev time the compiler:

1. parses the arrow-based shader schema;
2. validates variables, constants, runtime inputs, effects and render-graph edges;
3. folds compile-time constants;
4. traces explicit output graphs and removes disconnected passes;
5. removes runtime variables/dependencies that only belonged to dead passes;
6. infers whether the surviving shader is static, event-driven or animated;
7. lowers the program into prepared GPU shader source;
8. writes a content-hashed `ESH1` `.shed.dat` artifact and manifest entry.

The artifact is compiled ESH data, not hardware-specific GPU machine code. Browsers still need to create/link the WebGL program on the user's device because GPU drivers do not share one portable binary shader format.

The expensive `.shed` parsing, validation and graph optimization therefore stay out of the browser runtime.

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

	after.grade => [
		use => palette
		colors => 24
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

Lists can also be written vertically:

```shed
colors => [
	#071126
	#5b21b6
	#06b6d4
]
```

A line containing only a valid `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA` value is treated as a color, not as a comment. Other leading `#` lines are comments:

```shed
# This is a comment.
```

## Variables

Runtime-mutable shader data uses `var`:

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

A variable can be overridden from schema without recompiling the `.shed` program:

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

Only variables referenced by the surviving compiled graph become GPU uniforms.

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

Because constants are known at build time, ESH can inline/fold them rather than allocating runtime uniform state.

## Built-in runtime inputs

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

The dependency arrow is also optimizer metadata:

```shed
time <= system.time
```

makes a surviving pass animated, while:

```shed
position <= scroll.position
```

makes a surviving pass event-driven through EngineScroll.

If a dynamic pass is disconnected from an explicit path to `screen`, dead-pass elimination removes that pass and its dependency. A shader can therefore compile from apparently animated source into a static runtime plan when the animated work does not contribute to output.

## Automatic execution modes

ESH derives the cheapest mode from the **optimized** dependency graph:

| Mode | Trigger | Runtime behavior |
|---|---|---|
| `static` | no surviving dynamic inputs | draws the required frame and stays idle |
| `event` | pointer, scroll or viewport inputs | draws when dependencies change; repeated events coalesce into one RAF |
| `animated` | time/delta/frame input | joins the shared EngineShader RAF scheduler |

Authors do not add `animated: true` or create separate pointer/scroll animation loops.

## Surface shaders

The automatic no-wrapper surface bridge currently supports:

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

The schema renderer keeps the actual Grid/Card/etc. as the layout element. ESH portals its GPU canvas directly into that element, so there is no extra flex/grid wrapper.

The host reserves its normal layout immediately but remains visually gated until the artifact is loaded, the WebGL program is ready and frame 1 has rendered. Shader/WebGL failure reveals the normal surface rather than leaving it permanently hidden.

Buttons, inputs and other interactive controls intentionally do **not** advertise automatic shader-surface support.

## EngineCanvas shader mode

`EngineCanvas` can give its canvas directly to ESH:

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

When `shader` is present, EngineCanvas hands the same canvas to EngineShader. It does not create a normal EC canvas and layer another shader canvas over it, so there is no duplicate canvas or duplicate animation loop.

ESH-owned Canvas mode and `graphics`/`onDraw` mode are alternatives in v1. True post-processing of an existing Engine2D/Engine3D framebuffer is a future compositor/buffer feature.

## Pipeline stages in surface v1

The language reserves:

```text
before
render
after
overlay
```

Surface ESH v1 lowers these into one optimized WebGL fragment program. The stable stage model exists now without pretending arbitrary DOM exposes Chrome's final compositor framebuffer.

### `before`

Current procedural source effects:

| Effect | Purpose |
|---|---|
| `gradient` | vertical color gradient |
| `aurora` | procedural/animated aurora field |
| `noise` | procedural noise field |

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

```shed
render => [
	resolution => .25
	filter => nearest
	fallback => #090b16
]
```

`resolution` changes the actual backing-store density. `.25` can render at one quarter of the normal density instead of paying full-resolution fragment cost and only faking large pixels afterward.

`filter => nearest` marks the canvas for nearest/pixelated presentation.

### `after`

Current surface effects:

```text
pixel / pixelate
palette
dither
glow / bloom
```

Pixelation is lowered into a coordinate prepass so procedural `before` output is genuinely sampled on the pixel grid. `palette`, `dither` and the v1 single-pass glow boost operate on the resulting color.

True multi-sample framebuffer bloom is reserved for the future multi-pass compositor; the v1 `bloom` alias is deliberately lightweight.

### `overlay`

Current overlay effects:

```text
grain
scanlines
vignette
```

These run last in the surface program.

## Render-graph arrows and dead-pass elimination

Named effects can be connected visually:

```shed
frame.color => after.pixel
after.pixel => after.grade
after.grade => screen
```

ESH validates graph references, validates cycles, and uses same-stage edges for ordering. When at least one explicit edge reaches `screen`, the compiler traces backward from `screen` and keeps only contributing `after`/`overlay` passes.

For example:

```shed
after.used => [
	use => palette
	colors => 8
]

after.dead => [
	use => dither
	position <= pointer.x
]

frame.color => after.used
after.used => screen
```

`after.dead` is validated but removed from generated GPU work. Its `pointer.x` dependency is removed too, so ESH does not install pointer-driven redraw behavior for dead work.

The graph model intentionally exists before every future framebuffer is available so later multi-pass ESH can keep the same source-language direction.

## Automatic performance behavior

ESH currently applies these optimizations automatically:

- `.shed` parsing/semantic validation happens only at build/dev compile time;
- explicit output graphs get dead-pass/dead-dependency elimination;
- compile-time constants are folded;
- only referenced runtime variables become GPU uniforms;
- client fetches only the manifest/artifact required by a rendered shader;
- content-hashed artifact filenames prevent stale reuse after edits;
- one shared RAF scheduler services animated shaders;
- fully offscreen animated shaders leave that scheduler instead of receiving useless callbacks;
- event shaders coalesce repeated events into one requested frame;
- pointer layout measurement is deferred to the actual draw frame;
- static shaders do not own a permanent RAF;
- variable uploads are skipped while their value signature is unchanged;
- backing-store size follows `ResizeObserver` rather than per-frame layout reads;
- hidden tabs suspend shader animation work;
- `prefers-reduced-motion` prevents continuous animated ESH by default;
- layer shaders default to 30 FPS and low-power GPU preference;
- dedicated Canvas shaders default to 60 FPS;
- adaptive density lowers/recovers backing DPR from measured frame timing;
- `render.resolution` can intentionally render far below device DPR;
- stale development artifact promises are pruned when the manifest changes.

## Build output safety

The normal Next plugin compiles into a staging directory and swaps output only after every `.shed` succeeds. A broken shader therefore preserves the last-known-good generated directory.

The exported low-level `compileShaderDirectory()` also compiles all sources before mutating its output, then replaces the manifest/current artifacts and removes stale content-hashed `.shed.dat` files. Direct compiler use therefore does not accumulate every historical shader hash or partially rewrite output because a later source file has a syntax error.

## Dev updates

During `next dev`, ESH watches `data/shader/public/**/*.shed`. The source directory is created when needed, so starting dev before the first `.shed` exists does not require restarting Next after the first shader is added.

Editing a shader causes:

```text
.shed edit
	↓
transactional recompile
	↓
new content hash + manifest revision
	↓
active ESH runtime sees revision change
	↓
new .shed.dat is fetched
	↓
GPU program is recreated
```

If a newly compiled GPU program fails on the device during development, EngineShader can fall back to its last successfully linked plan while reporting the error.

## Plugin setup

The combined plugin compiles EngineAPI/APIStatic and EngineShader together:

```js
const withEngine = require("./src/engine/plugins/enginePlugin");

module.exports = withEngine(nextConfig);
```

Package consumers use:

```js
const withEngine = require("nextjs-engine/plugin");
```

Default shader configuration:

```js
module.exports = withEngine(nextConfig, {
	shader: {
		shaderDir: "data/shader/public",
		shaderOutputDir: "public/_static/shader",
	},
});
```

If `shaderOutputDir` changes but remains inside `public/`, ESH automatically derives the browser path:

```js
module.exports = withEngine(nextConfig, {
	shader: {
		shaderOutputDir: "public/assets/esh",
	},
});
```

becomes a runtime base path of:

```text
/assets/esh
```

For a CDN/rewrite/custom URL, set `shaderBasePath` explicitly:

```js
module.exports = withEngine(nextConfig, {
	shader: {
		shaderOutputDir: "public/assets/esh",
		shaderBasePath: "https://cdn.example.com/esh",
	},
});
```

The plugin exposes the resolved path to the client as `NEXT_PUBLIC_ENGINE_SHADER_BASE_PATH`. Low-level `loadEngineShader(name, { basePath })` calls keep separate manifest/artifact caches per base path, so multiple shader origins cannot accidentally share the wrong manifest.

If no explicit `shaderBasePath` is supplied, `shaderOutputDir` must be inside `public/`; otherwise ESH fails configuration instead of generating files the browser cannot address.

The dedicated shader-only plugin remains available as `nextjs-engine/shader-plugin`.

## Current browser boundary

ESH does not claim WebGL can capture and rewrite Chrome's final arbitrary DOM compositor framebuffer.

Surface shaders own their own GPU layer. ESH-owned Canvas shaders own Canvas output. Future EngineCanvas/compositor integration can expose real color/depth/normal/velocity/history buffers for multi-pass rendering.

These names are reserved for that direction, but unsupported surface-buffer reads currently fail compilation instead of returning fake data:

```text
frame.depth
frame.normal
frame.velocity
frame.previous
frame.history
```

That keeps `.shed` source aligned with the intended render-pipeline architecture without claiming surface ESH v1 can already provide buffers it does not own.
