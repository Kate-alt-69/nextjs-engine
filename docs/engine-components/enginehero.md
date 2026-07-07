# EngineHero

Schema type: `"hero"` — Full-bleed, high-impact page banners with three layout
variants, optional overlay, scroll-parallax, and all standard section props.

Use EngineHero for the first visible section of a page. It differs from
`"section"` by defaulting to `min-height: 100svh` and accepting visual
treatment props (overlay, parallax) that make no sense on interior sections.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"centered" \| "split" \| "fullbleed"` | `"centered"` | Layout mode |
| `overlay` | `string` | — | CSS color or gradient painted on top of the background |
| `parallax` | `boolean` | `false` | Applies a CSS scroll-parallax effect to the background |
| `fullViewport` | `boolean` | `true` | Sets `min-height: 100svh` |
| `contentMaxWidth` | `ResponsiveValue<string \| number>` | `"1200px"` | Max width of the inner content column |
| `centered` | `boolean` | `true` | Centers the inner content column horizontally |
| `snapAlign` | `"start" \| "center" \| "end"` | — | CSS `scroll-snap-align` for scroll-snap pages |
| `bg` | `string` | — | Background color (any CSS value including gradients) |
| `backgroundImage` | `string` | — | CSS `background-image` value (use with `backgroundSize: "cover"`) |

All shared base props (`px`, `py`, `p`, `id`, `className`, `style`, `vars`, etc.) also apply.

---

## Layout variants

### `"centered"` (default)

Flex-column with `align-items: center` and `text-align: center`.
Use for a classic single-column hero: headline → subheading → CTA buttons.

```ts
{
  type: "hero",
  props: {
    variant: "centered",
    bg: "#070b12",
    py: { xs: "6rem", lg: "10rem" },
    contentMaxWidth: "900px",
  },
  children: [
    {
      type: "heading",
      props: {
        level: 1,
        content: "Build faster with the Engine",
        gradient: "linear-gradient(135deg, #60a5fa, #a78bfa)",
        align: "center",
      },
    },
    {
      type: "text",
      props: {
        variant: "lead",
        content: "Schema-driven rendering for Next.js.",
        align: "center",
        color: "rgba(255,255,255,.6)",
        mt: "1.5rem",
      },
    },
    {
      type: "button",
      props: {
        label: "Get started",
        variant: "solid",
        size: "lg",
        href: "/docs",
        mt: "2.5rem",
      },
    },
  ],
}
```

### `"split"`

Two-column CSS Grid (`1fr 1fr`). Left child = text, right child = image or
illustration. Collapses to single column on narrow screens via the engine's
responsive CSS variables.

```ts
{
  type: "hero",
  props: {
    variant: "split",
    contentMaxWidth: "1200px",
    bg: "#0c1220",
    py: { xs: "5rem", lg: "8rem" },
  },
  children: [
    {
      type: "stack",
      props: { direction: "vertical", gap: "1.5rem", justify: "center" },
      children: [
        { type: "heading", props: { level: 1, content: "Left side headline" } },
        { type: "text", props: { variant: "lead", content: "Subtitle text." } },
      ],
    },
    {
      type: "image",
      props: { src: "/hero-image.png", alt: "Product screenshot", fill: true },
    },
  ],
}
```

### `"fullbleed"`

No inner content column constraints. Children fill the entire hero width.
Use for immersive video backgrounds, map embeds, or fully custom layouts.

```ts
{
  type: "hero",
  props: {
    variant: "fullbleed",
    fullViewport: true,
    position: "relative",
  },
  children: [
    {
      type: "video",
      props: { src: "/bg.mp4", autoPlay: true, muted: true, loop: true },
    },
    {
      type: "box",
      props: {
        position: "absolute",
        style: { inset: 0, display: "flex", alignItems: "center", justifyContent: "center" },
      },
      children: [
        { type: "heading", props: { level: 1, content: "Over the video" } },
      ],
    },
  ],
}
```

---

## Overlay

`overlay` accepts any CSS color or gradient and is painted as a semi-transparent
layer on top of the hero background. Use it to make text readable over images or
videos without hiding the background entirely.

```ts
// Dark vignette over a background image
props: {
  bg: "#000",
  backgroundImage: "url('/hero.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  overlay: "rgba(0, 0, 0, 0.55)",
}

// Brand gradient overlay
props: {
  backgroundImage: "url('/city.jpg')",
  backgroundSize: "cover",
  overlay: "linear-gradient(135deg, rgba(96,165,250,0.6), rgba(167,139,250,0.4))",
}
```

---

## Parallax

`parallax: true` applies a CSS-only scroll-parallax effect to the hero
background. Works by setting `background-attachment: fixed` under the hood.
The engine checks `EngineBrowser.supports` and automatically disables parallax
on Safari versions where `background-attachment: fixed` is known to cause
rendering bugs.

```ts
props: {
  backgroundImage: "url('/mountains.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  overlay: "rgba(0,0,0,0.4)",
  parallax: true,
}
```

---

## Full working example

```ts
{
  type: "hero",
  props: {
    variant: "centered",
    fullViewport: true,
    bg: "#070b12",
    backgroundImage: "url('/grid.svg')",
    backgroundSize: "cover",
    overlay: "rgba(7,11,18,0.7)",
    contentMaxWidth: "1000px",
    px: { xs: "1.5rem", md: "3rem" },
    py: { xs: "6rem", lg: "10rem" },
    point: "top",  // registers as a named scroll anchor
  },
  children: [
    {
      type: "heading",
      props: {
        level: 1,
        content: "Next.js Engine",
        gradient: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)",
        align: "center",
        style: { fontSize: "clamp(3rem, 8vw, 6rem)" },
      },
    },
    {
      type: "text",
      props: {
        variant: "lead",
        content: "Write schemas. The engine handles everything else.",
        color: "rgba(255,255,255,.6)",
        align: "center",
        mt: "2rem",
      },
    },
    {
      type: "stack",
      props: { direction: "horizontal", gap: "1rem", justify: "center", mt: "3rem" },
      children: [
        { type: "button", props: { label: "Read the docs", variant: "solid",   size: "lg", href: "/docs" } },
        { type: "button", props: { label: "GitHub",        variant: "outline",  size: "lg", href: "https://github.com/kastrick", target: "_blank" } },
      ],
    },
  ],
}
```
