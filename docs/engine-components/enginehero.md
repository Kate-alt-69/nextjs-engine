# EngineHero

Schema type: `"hero"`.

EngineHero is the page-banner primitive. It supports centered, split, and
full-bleed layouts, responsive content width, overlays, and optional parallax.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `"centered" \| "split" \| "fullbleed"` | `"centered"` | Inner layout |
| `overlay` | `string` | — | Color or gradient above the background and below content |
| `parallax` | `boolean` | `false` | Enables background parallax |
| `fullViewport` | `boolean` | `true` | Adds `min-height: 100svh` |
| `contentMaxWidth` | `ResponsiveValue<string \| number>` | `"1200px"` | Responsive inner max width |
| `centered` | `boolean` | `true` | Centers constrained inner content |
| `snapAlign` | `"start" \| "center" \| "end"` | — | `scroll-snap-align` |
| `backgroundImage` | `string` | — | CSS background image |

Shared engine props such as `bg`, `px`, `py`, `id`, `point`, `style`, and
`cprop` also apply.

## Centered

```ts
{
  type: "hero",
  props: {
    variant: "centered",
    bg: "#070b12",
    contentMaxWidth: { xs: "100%", md: "900px" },
    px: { xs: "1.5rem", md: "3rem" },
    py: { xs: "6rem", lg: "10rem" },
  },
  children: [
    { type: "heading", props: { level: 1, content: "Next.js Engine" } },
  ],
}
```

## Split

`variant: "split"` is mobile-first: one column at `xs`, two columns from `md`,
with a smaller mobile gap and a larger desktop gap.

```ts
{
  type: "hero",
  props: {
    variant: "split",
    contentMaxWidth: "1200px",
  },
  children: [
    { type: "stack", children: [/* copy */] },
    { type: "image", props: { src: "/hero.png", alt: "Preview", width: 1200, height: 800 } },
  ],
}
```

The current defaults are effectively:

```ts
columns: { xs: 1, md: 2 }
gap: { xs: "2rem", lg: "4rem" }
```

## Full-bleed

`fullbleed` removes the inner max-width constraint and defaults inner horizontal
padding to zero. Children are free to fill the entire hero.

## Parallax behavior

Parallax is not a raw-scroll-event loop. EngineHero:

1. uses `background-attachment: fixed` as a baseline when a background image is present;
2. batches JavaScript position updates to one `requestAnimationFrame`;
3. stops doing layout reads while the hero is outside a `300px` viewport margin;
4. disables the JS effect when `prefers-reduced-motion: reduce` is active;
5. skips the problematic path on Safari versions below 16;
6. restores the element's prior inline `backgroundPositionY` on cleanup.

```ts
props: {
  backgroundImage: "url('/mountains.jpg')",
  backgroundSize: "cover",
  overlay: "rgba(0,0,0,.4)",
  parallax: true,
}
```

Use parallax selectively. A normal static background is cheaper and should be
the default when motion adds no value.
