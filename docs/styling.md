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

Responsive variables include their base value as a `var()` fallback. The same
rule applies to base properties in `style` objects that contain at-rules.

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

Nested at-rules retain their parent scope instead of being emitted globally.
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

## Styling and the collector

Generated responsive/pseudo/at-rule CSS is deduplicated by **exact CSS content**
inside the current style collector and emitted through the engine stylesheet.
Ordinary generated CSS is not retained in a process-wide cross-render cache:
every response still needs its own stylesheet, so retaining and hashing those
blocks across renders would add memory/CPU without removing output.

Only CSS explicitly added with `StyleCollector.addGlobal()` is retained across
render passes for `EngineGlobalStyles()`.

The current runtime still uses a process-level `globalStyleCollector` for normal
generated styles, so full per-request concurrency isolation remains a known
architectural limitation. See [`runtime-performance.md`](./runtime-performance.md)
for the current status.
