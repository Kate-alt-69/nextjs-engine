# Styling Contract

This page documents the styling behavior implemented by `usePropStyles()` and
the current schema types. It is the canonical reference for engine shorthands,
responsive values, direct CSS passthrough, and `style` at-rules.

## Responsive values

A responsive value is a scalar or a mobile-first breakpoint map:

```ts
type ResponsiveValue<T> = T | Partial<Record<
	"xs" | "sm" | "md" | "lg" | "xl" | "2xl",
	T
>>;
```

Breakpoint values cascade forward. For example:

```ts
{
	type: "box",
	props: {
		bg: { xs: "#111827", md: "#030712" },
		color: { xs: "#e5e7eb", lg: "#ffffff" },
		px: { xs: 16, md: 32 },
		backgroundPosition: { xs: "center top", lg: "center" },
	},
}
```

The engine compiles responsive values to CSS custom properties plus media
queries. The browser performs breakpoint selection; there is no JS resize loop
for these props.

Only explicitly supplied breakpoints produce CSS declarations. CSS cascade keeps
a value active until a later explicit breakpoint overrides it, so this:

```ts
px: { xs: 16, md: 32 }
```

emits one base declaration and one `md` media override — it does **not** repeat
the `xs` value at `sm` or the `md` value again at `lg`, `xl`, and `2xl`.

A responsive map does not cascade backward. If `xs` is omitted:

```ts
px: { md: 32 }
```

then the responsive variable is intentionally undefined below `md`, so the
property is not forced on `xs`/`sm`. This is different from supplying
`{ xs: 32 }`, which applies from the base breakpoint upward.

Current responsive surface props include:

- `bg` / `background`
- `backgroundColor`
- `color`
- `opacity`
- `backgroundImage`
- `backgroundSize`
- `backgroundRepeat`
- `backgroundPosition`
- `backgroundAttachment`
- `backgroundClip`
- `backgroundOrigin`
- `backgroundBlendMode`
- spacing, sizing, gap, grid/flex values, transforms, and the other properties
  explicitly typed as `ResponsiveValue<...>`.

Do not assume that every `CSSProperties` key is responsive merely because it can
be supplied as a scalar. The TypeScript type is the contract.

## First-paint fallback

Scalar responsive variables and breakpoint maps with an explicit `xs` value
include that base value as a `var()` fallback. The same rule applies to base
properties in `style` objects that contain at-rules.

Conceptually:

```css
/* inline */
background: var(--e-at-abc-background, #111827);

/* collected stylesheet */
:root { --e-at-abc-background: #111827; }
@media (min-width: 768px) {
	:root { --e-at-abc-background: #030712; }
}
```

The fallback is intentional. During SSG or client navigation the collected
stylesheet can be parsed after the element itself. Without a fallback, an
undefined background variable can temporarily become the browser default and
produce a white flash.

When a responsive map intentionally omits `xs`, the engine does **not** borrow a
later breakpoint as the fallback. Doing so would incorrectly apply an `md`/`lg`
value on smaller screens. Such maps use `var(--name)` without a base fallback and
become valid when their first matching media rule applies.

## Responsive resolver caching

Responsive maps are serialized in canonical breakpoint order before memoization,
so semantically identical objects do not generate duplicate variables merely
because their JavaScript key insertion order differs. The cache identity also
includes whether a value uses spacing normalization, keeping raw and normalized
requests independent.

Generated responsive variable ids use the full paired resolver hash rather than
the older five-character truncation, substantially reducing accidental variable
name collision risk on large pages.

Resolver output is deterministic for a cache key, so the memo cache is shared
across page/component renders instead of being cleared from `createPage()` during
render. The cache uses LRU-style hit promotion and is capped at 2,048 entries.
This avoids concurrent render cache thrashing while preventing long-lived apps
that generate many unique responsive values from growing the memo table without
bound. An explicit cache reset remains available internally for tests/tools.

## Direct CSS props

Many standard CSS properties can be placed directly beside engine shorthands:

```ts
props: {
	bg: "#111",
	transform: "translateY(-2px)",
	filter: "blur(2px)",
	willChange: "transform",
}
```

For background surfaces, both the shorthand and normal CSS names are supported:

```ts
props: {
	background: { xs: "#111", md: "#000" },
	backgroundColor: { xs: "rgb(17 24 39)", md: "rgb(3 7 18)" },
}
```

`bg` and `background` target the same CSS `background` property. When both are
provided, `bg` takes precedence.

## Style precedence

Built-in Engine surfaces use one consistent precedence model:

```text
component defaults
< semantic/variant defaults
< Engine/schema props
< explicit style={}
< required live runtime state
```

That means a Card variant may provide a white fallback background, but an
explicit schema `bg` or `background` wins. Likewise, Text heading variants supply
default font sizes/weights, while `fontSize` and `fontWeight` on the node override
them. The caller's `style` object remains the strongest ordinary styling layer.

```ts
{
	type: "card",
	props: {
		bg: "#0b0d10",
		borderRadius: "20px",
		style: {
			borderRadius: "24px",
		},
	},
}
```

The result uses `#0b0d10` instead of the Card variant fallback and `24px` instead
of either the component default or schema radius.

Required runtime state is intentionally last. For example, a disabled EngineButton
must still enforce its disabled opacity/cursor, and open Overlay surfaces must
retain the positioning/transition state needed for their runtime behavior.

Internally, `usePropStyles(props, style)` continues to treat its second argument
as the explicit caller override. Components with built-in defaults use the
layered `usePrimitiveStyles()` helper so defaults are not accidentally placed in
that explicit-style layer.

## `style` with at-rules

`style` accepts `EngineStyleObject`, which adds `@...` entries to ordinary React
CSS properties:

```ts
style: {
	background: "#111827",
	color: "#e5e7eb",
	"@media (min-width: 768px)": {
		background: "#030712",
	},
	"@supports (backdrop-filter: blur(8px))": {
		backdropFilter: "blur(8px)",
	},
}
```

Nested conditional at-rules retain the selector and every parent conditional
scope instead of being emitted globally. For example, an `@supports` nested
inside `@media` stays inside that media query.

The serializer also handles at-rules whose body is not an ordinary selector:

```ts
style: {
	animation: "engine-pop 180ms ease-out",
	"@keyframes engine-pop": {
		from: { opacity: 0, transform: "scale(.96)" },
		to: { opacity: 1, transform: "scale(1)" },
	},
	"@font-face": {
		fontFamily: "EngineUI",
		src: "url(/fonts/engine-ui.woff2)",
	},
}
```

Keyframe selectors such as `from`, `to`, and percentage frames are serialized
inside the keyframes block. Declaration at-rules such as `@font-face`, `@page`,
and `@property` emit declarations directly rather than being wrapped in a fake
`:root` selector.

Base properties receive inline CSS-variable fallbacks; properties that only
exist inside a conditional rule remain absent outside that condition.

## Pseudo-state styles (`cprop`)

Pseudo-state style bags compile to generated CSS classes rather than JS event
handlers:

```ts
cprop: {
	onHover: { transform: "scale(1.02)", background: "#1f2937" },
	onFocus: { outline: "2px solid #60a5fa" },
	onActive: { transform: "scale(0.98)" },
}
```

Supported state bags are `onHover`, `onFocus`, `onActive`, `onChecked`,
`onDisabled`, and `onPlaceholder`.

At-rules nested inside a pseudo-state keep the pseudo selector. A responsive
hover rule therefore compiles as `@media ... { .generated:hover { ... } }`, not
as an unrelated global rule.

## Styling and the collector

Generated responsive, pseudo-state, at-rule, visibility, navigation, and other
engine-owned CSS is written to the `StyleCollector` owned by the nearest
`EngineProvider`. Each page/component provider creates its own collector, so two
concurrent server renders do not reset, overwrite, or serialize each other's
normal generated CSS.

Nested `createComponent()` boundaries also own their generated stylesheet. They
do not reset a parent page collector and do not re-emit CSS already collected by
the parent boundary.

Generated CSS is deduplicated by **exact CSS content inside that collector**.
Ordinary generated CSS is not retained in a process-wide cross-render cache:
every response needs its own stylesheet, so retaining and hashing those blocks
across unrelated renders would add memory/CPU without removing response output.

Only CSS explicitly added with `StyleCollector.addGlobal()` is retained for
`EngineGlobalStyles()` and intentionally belongs to the global-style path.

The exported low-level `globalStyleCollector` remains a compatibility fallback
for helpers used outside an `EngineProvider`. Built-in engine rendering does not
use it as the normal page/request collector.

The remaining style-runtime limitation is **post-hydration dynamic rule
flushing**: if application code generates a brand-new responsive/pseudo rule on
the client after hydration, collector ownership is correct but stylesheet DOM
flushing is still primarily server-oriented. A future client flusher should add
only newly generated rules and must not duplicate the complete SSR stylesheet.
