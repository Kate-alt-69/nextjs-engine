# Generation 3 server-first rendering parity

Generation 3 server-first rendering must preserve the same public schema semantics as
the compatibility/client renderer. Moving a node from the legacy renderer to
`EngineServerRenderer` is an execution-boundary optimization, not a styling or
behavior change.

## Shared style compiler

`EngineStyleCompiler` is the single hook-free implementation of Engine prop styling.
Both `EngineServerRenderer` and `usePropStyles()` use it.

The shared compiler owns:

- responsive spacing, dimensions, typography, layout, and grid columns;
- long-form CSS passthrough props such as animation, grid placement, blend modes,
  scroll snap, outlines, and background controls;
- the `sides` / `sideDistance` / `sideType` spacing shorthand;
- CSS variables from `vars`;
- nested `@media`, `@supports`, container rules, keyframes, and declaration at-rules;
- `cprop` pseudo-state classes.

Primitive style precedence is also shared:

```text
component defaults
-> derived semantic state
-> schema props
-> explicit style
-> required runtime state
```

That means enabling server-first compilation cannot make a Button variant override an
explicit `style`, make Text variants erase a schema font size, or make Card defaults
win over author styling.

## Slot fallbacks are compiler branches

A slot fallback is executable schema, not raw React content.

```ts
{
	type: "slot",
	props: {
		name: "content",
		fallback: {
			type: "canvas",
			props: { mode: "webgl2" },
		},
	},
}
```

Generation 3 compiles that fallback at `root.fallback` (or the equivalent nested
path). Its runtime classification, assets, capabilities, security diagnostics, and
client-island requirements therefore remain part of the page plan.

At render time the supplied runtime slot wins. If it is absent, the compiled fallback
branch renders normally. If neither exists, the slot renders nothing.

## Static primitive parity

Server-first primitives preserve the client contract for the non-interactive path,
including:

- responsive Stack direction;
- Text truncation and gradient/typography layers;
- Heading links and `subheadingProps`;
- non-interactive Buttons without allocating a client island;
- disabled navigation Buttons that do not navigate to `#`;
- responsive Spacer sizing and Divider spacing;
- Option/OptGroup attributes and generated styles;
- Card cover/content layout;
- configured Image quality presets and per-viewport quality.

Interactive handlers still cause the compiler to select a client island.

## React 19 generated styles

Engine-generated `<style>` elements are ordinary style elements. They intentionally
do not use React's `precedence` stylesheet-resource behavior.

The server, provider collector, and global collector use
`suppressHydrationWarning` for the generated stylesheet text because deterministic
Engine CSS can be reconciled after the client adopts the exact server snapshot.

## Regression coverage

`scripts/gen3-server-first-parity-smoke.js` verifies the shared style compiler,
primitive precedence, nested at-rules, slot fallback graph compilation, and the
React 19 stylesheet contract. The normal Generation 3 Phase A/B CI job runs this
smoke before type-checking and the optimized Next.js integration build.
