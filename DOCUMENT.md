# Next.js Engine — Technical Documentation

> **Last updated:** 2026-06-06
> **Changes in this update:** Added `TextPart` type and `parts` prop to the `text` node. Added `app/not-found.tsx` fallback shim and `next.config.js` guard. Redesigned default 404 page using the engine schema.

## What It Is

A schema-driven rendering layer that sits on top of Next.js. Instead of writing raw HTML or JSX, you define pages as plain TypeScript objects. The engine converts that definition into a fully optimised Next.js page — automatically handling lazy loading, responsive layout, memoization, image optimization, and more.

You never touch a `<div>` again. The engine handles everything.

---

## Core Principle

Raw React and Next.js are fast when optimised correctly, but they give you nothing for free. Every optimization — `React.memo`, `next/image`, `IntersectionObserver`, `content-visibility`, responsive CSS — has to be applied manually. The engine applies all of them automatically, every time, for every element.

---

## Architecture Overview

```
src/engine/
│
├── schema/
│   └── types.ts              All TypeScript types for the schema system
│
├── core/
│   ├── resolver.ts           Converts ResponsiveValue props → CSS custom properties
│   ├── StyleCollector.ts     Collects CSS blocks during render, outputs one <style> tag
│   ├── registry.ts           Maps NodeType strings → React components
│   ├── lazyDetect.ts         Analyses nodes and decides lazy strategy per element
│   └── SchemaRenderer.tsx    Walks the schema tree and renders each node
│
├── hooks/
│   ├── useInView.ts          SSR-safe IntersectionObserver hook
│   └── usePropStyles.ts      Converts engine props to inline CSS (uses resolver)
│
├── providers/
│   └── EngineProvider.tsx    React context: config, handlers, slots, breakpoint hook
│
├── components/
│   ├── primitives.tsx        Box, Stack, Grid, Text, Heading, Section, Button, Card, Spacer, Divider
│   ├── EngineImage.tsx       Smart lazy image with blur-up progressive loading
│   ├── EngineVideo.tsx       Lazy video — src never loads until near viewport
│   └── LazyMount.tsx         Generic lazy mount wrapper + LazySection variant
│
├── createPage.tsx            Top-level page factory
└── index.ts                  Public API exports
```

---

## Responsive System

### The Problem with JS-based Responsive

The standard approach in most React apps is to read `window.innerWidth` and conditionally apply styles. This causes:

- Layout shifts on load (JS hasn't run yet when HTML paints)
- Re-renders on every resize
- Hydration mismatches (server sees no width, client sees real width)

### How the Engine Does It

Every `ResponsiveValue<T>` prop is resolved at render time into a CSS custom property with `@media` query overrides. The browser handles all switching in CSS — zero JS involvement at runtime.

```ts
// You write this in your schema:
props: {
  px: { xs: "1rem", md: "2rem", xl: "3rem" }
}

// The engine generates this CSS once and injects it in a <style> tag:
:root { --e-px-a1b2: 1rem }
@media(min-width:768px)  { :root { --e-px-a1b2: 2rem } }
@media(min-width:1280px) { :root { --e-px-a1b2: 3rem } }

// And applies this inline style to the element:
style={{ paddingLeft: "var(--e-px-a1b2)", paddingRight: "var(--e-px-a1b2)" }}
```

The component itself never reads the viewport. It never re-renders on resize. The CSS does everything.

### Responsive Values

Any prop that accepts `ResponsiveValue<T>` can take either a plain value or a breakpoint map:

```ts
// Plain value — same at all sizes
gap: "2rem"

// Responsive — different per breakpoint, cascades upward
gap: { xs: "1rem", md: "1.5rem", xl: "2rem" }
```

Breakpoints cascade upward. If you only define `xs` and `lg`, everything between `sm` and `md` uses the `xs` value.

### Breakpoints

| Key | Min Width |
|-----|-----------|
| `xs` | 0px (base) |
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

Custom breakpoints can be passed to `createPage({ config: { breakpoints: { … } } })`.

---

## Lazy Loading System

### Decision Logic

The engine analyses every schema node before rendering it and decides the lazy strategy automatically. You do not need to add anything — it just works.

| Node Type | Condition | Strategy |
|-----------|-----------|----------|
| `video` | Always | Full lazy mount, rootMargin 800px |
| `image` | Width × Height > 640×480 | Lazy mount, rootMargin based on size |
| `image` | Full HD (1920×1080+) | Lazy mount, rootMargin 800px |
| `section` / `hero` | Depth > 0, more than 10 descendants | Full lazy mount, rootMargin 600px |
| `section` / `hero` | Depth > 0, few descendants | `content-visibility: auto` only |
| `grid` / `stack` | Depth > 1, more than 6 items | Lazy mount, rootMargin 400px |
| `card` | Depth > 2 | Lazy mount, rootMargin 300px |
| Any node | `props.priority = true` | Always eager, skip all lazy logic |
| Any node | `props.lazy = false` | Always eager |
| Any node | `props.lazy = true` | Always lazy |

### What Lazy Mount Actually Does

`LazyMount` does not render its children to the DOM at all until the container enters the viewport. This is different from native `loading="lazy"` on images, which still creates the DOM node immediately and lets the browser decide on network timing.

With `LazyMount`:
- Zero DOM nodes for the child tree
- Zero React renders
- Zero network requests
- Zero JS execution

The container div holds its reserved height (preventing layout shift), and once it comes within `rootMargin` of the viewport, the child tree is mounted and wrapped in a `Suspense` boundary.

### content-visibility: auto

For lighter sections that don't need full lazy mounting, the engine applies `content-visibility: auto`. This is a CSS hint to the browser to skip layout, paint, and compositing for off-screen content entirely — even though the DOM nodes exist. Combined with `contain-intrinsic-height`, the browser reserves the correct scroll space.

This is applied automatically. You don't configure it.

### IntersectionObserver: rootMargin Pre-loading

The engine does not wait until an element is literally in the viewport to start loading. It uses `rootMargin` to begin loading content before it arrives:

- Videos: 800px before viewport — buffer time for large files
- Large images (Full HD): 800px before viewport
- HD images: 600px before viewport
- Medium images: 400px before viewport
- Heavy sections: 600px before viewport

### Priority Images

If you set `props.priority = true` on an image node, the engine:
1. Passes `priority` to `next/image` (which preloads the image in `<head>`)
2. Skips IntersectionObserver entirely — image is considered always in-view
3. Never renders a skeleton placeholder

Use this for hero images and above-fold photos.

### Blur-Up Progressive Loading

Every image shows a blur placeholder while the full image loads. If you provide a `blurDataURL` (a tiny base64-encoded low-quality version of the image), the engine renders it blurred and cross-fades to the full image. If no `blurDataURL` is provided, a shimmer skeleton is shown instead.

### Video Loading

Videos are the heaviest assets on any page. The engine's strategy:

1. Render an empty container that holds the aspect-ratio space (no CLS)
2. Show the poster image if provided
3. Wait until the container is 800px from the viewport
4. Only then inject the `<video>` element into the DOM
5. The `<video>` starts with `preload="none"` — no buffering until play
6. Show a loading spinner while the browser buffers
7. Fade the video in once `canplay` fires

The video's `src` literally does not exist in the DOM until the user is about to see it.

---

## Memoization

Every engine component is wrapped in `React.memo`. This means:

- A node only re-renders if its own props change
- Parent re-renders do not cascade down the tree
- The entire schema tree is stable once mounted

When you define a page with `createPage`, the schema is a static object defined outside of any component. It never changes between renders. Combined with `React.memo`, the entire page tree re-renders approximately zero times after mount.

---

## Schema Node Reference

Every node follows this shape:

```ts
{
  type: string,       // component type to render
  key?: string,       // stable React key (recommended for list items)
  props?: object,     // props for the component
  children?: SchemaNode[] | string  // child nodes, or text content
}
```

### Shared Base Props

All nodes accept these props in addition to their type-specific props:

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | HTML id attribute |
| `className` | `string` | CSS class names |
| `style` | `CSSProperties` | Inline style overrides |
| `priority` | `boolean` | Skip lazy loading entirely |
| `lazy` | `boolean` | Force lazy (true) or eager (false) |
| `m`, `mt`, `mr`, `mb`, `ml`, `mx`, `my` | `ResponsiveValue<string\|number>` | Margin |
| `p`, `pt`, `pr`, `pb`, `pl`, `px`, `py` | `ResponsiveValue<string\|number>` | Padding |
| `w`, `h`, `minW`, `minH`, `maxW`, `maxH` | `ResponsiveValue<string\|number>` | Sizing |
| `bg` | `string` | Background color |
| `color` | `string` | Text color |
| `border` | `string` | CSS border shorthand |
| `borderRadius` | `ResponsiveValue<string\|number>` | Border radius |
| `shadow` | `string` | Box shadow |
| `position` | `string` | CSS position |
| `zIndex` | `number` | Z-index |
| `opacity` | `number` | Opacity |
| `overflow` | `string` | Overflow behaviour |
| `onClick` | `string` | Handler name from `createPage({ handlers })` |
| `href` | `string` | Wraps node in an `<a>` tag |

Numbers in spacing/sizing props are treated as pixels divided by 16 (so `16 → 1rem`, `32 → 2rem`).

### box

Generic container. Maps to a `<div>` by default.

| Prop | Type | Description |
|------|------|-------------|
| `display` | `ResponsiveValue` | CSS display |
| `flexDir` | `ResponsiveValue` | flex-direction |
| `align` | `ResponsiveValue` | align-items |
| `justify` | `ResponsiveValue` | justify-content |
| `wrap` | `ResponsiveValue` | flex-wrap |
| `gap` | `ResponsiveValue<string\|number>` | Gap between flex/grid children |
| `as` | `ElementType` | Override the HTML tag |

### stack

Vertical or horizontal flex stack with optional dividers.

| Prop | Type | Default |
|------|------|---------|
| `direction` | `"vertical" \| "horizontal" \| ResponsiveValue` | `"vertical"` |
| `gap` | `ResponsiveValue<string\|number>` | — |
| `align` | `ResponsiveValue` | — |
| `justify` | `ResponsiveValue` | — |
| `wrap` | `boolean` | `false` |
| `dividers` | `boolean` | `false` |

### grid

CSS Grid container.

| Prop | Type | Description |
|------|------|-------------|
| `columns` | `ResponsiveValue<number\|string>` | Number of columns or template string |
| `rows` | `ResponsiveValue<number\|string>` | Row template |
| `gap` | `ResponsiveValue<string\|number>` | Gap |
| `colGap`, `rowGap` | `ResponsiveValue<string\|number>` | Per-axis gap |
| `autoFit` | `boolean` | `repeat(auto-fit, minmax(minColWidth, 1fr))` |
| `minColWidth` | `string` | Min column width for autoFit mode |
| `align`, `justify` | `ResponsiveValue` | Alignment |

### text

Renders text with a variant system.

| Variant | HTML Tag | Style |
|---------|----------|-------|
| `h1` – `h6` | `<h1>` – `<h6>` | Fluid type scale using `clamp()` |
| `body` | `<p>` | 1rem, line-height 1.6 |
| `body-sm` | `<p>` | 0.875rem |
| `lead` | `<p>` | 1.25rem, lighter weight |
| `caption` | `<span>` | 0.75rem, muted colour |
| `label` | `<label>` | Uppercase, tracked |
| `mono` | `<code>` | Monospace with code background |
| `overline` | `<span>` | Small caps, wide tracking |

Additional text props: `size`, `weight`, `align`, `lineHeight`, `letterSpacing`, `truncate`, `italic`, `underline`, `gradient`, `content`, `as`.

The `gradient` prop applies a CSS gradient as a text fill (clip + transparent fill).

`truncate: true` = single line ellipsis. `truncate: 3` = three-line clamp.

#### `parts` — inline text with embedded links

Use `parts` instead of `content` when you need a mix of plain text and hyperlinks within a single text node. When `parts` is provided, `content` and child nodes are ignored.

```ts
{
  type: "text",
  props: {
    variant: "caption",
    parts: [
      { text: "built with love by " },
      {
        text:   "Kastrick",
        href:   "https://kastricks.com",
        target: "_blank",
        style:  { color: "#555", textDecoration: "none" },
      },
    ],
  },
}
```

Each entry in `parts` is a `TextPart`:

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | The visible text for this segment (required) |
| `href` | `string` | If set, renders an `<a>` with this href |
| `target` | `"_blank" \| "_self" \| ...` | Link target. Auto-inferred from href scheme if omitted |
| `rel` | `string` | Rel attribute. Auto-set to `"noopener noreferrer"` for external / `_blank` links |
| `style` | `CSSProperties` | Per-segment inline style. Plain segments without style render as bare text (no wrapper element) |

Plain segments (no `href`, no `style`) render as raw text nodes — no `<span>` wrapper is added, keeping the DOM clean.

### heading

Shorthand combining a heading text node with an optional subheading.

```ts
{
  type: "heading",
  props: {
    level: 1,
    content: "Main title",
    subheading: "Supporting line underneath",
  }
}
```

### image

Automatically uses `next/image`. Lazy loads by default unless `priority: true`.

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Image source (required) |
| `alt` | `string` | Alt text (required) |
| `width` | `number` | Pixel width |
| `height` | `number` | Pixel height |
| `fill` | `boolean` | Fill parent container |
| `priority` | `boolean` | Preload, skip lazy |
| `quality` | `number` | 1–100, default 85 |
| `objectFit` | `string` | cover, contain, etc |
| `aspectRatio` | `string` | CSS aspect-ratio |
| `sizes` | `string` | Responsive sizes hint |
| `blurDataURL` | `string` | Base64 low-quality placeholder |
| `rounded` | `boolean\|string` | Border radius |
| `caption` | `string` | Renders inside `<figure><figcaption>` |

### video

Lazy video player. `src` is never fetched until 800px before viewport entry.

| Prop | Type | Default |
|------|------|---------|
| `src` | `string \| VideoSource[]` | Required |
| `poster` | `string` | Thumbnail image |
| `aspectRatio` | `string` | `"16/9"` |
| `autoPlay` | `boolean` | `false` |
| `muted` | `boolean` | `true` |
| `loop` | `boolean` | `false` |
| `controls` | `boolean` | `true` |
| `rootMargin` | `string` | `"800px 0px"` |
| `eager` | `boolean` | `false` |

Multiple sources:
```ts
src: [
  { src: "/video.webm", type: "video/webm" },
  { src: "/video.mp4",  type: "video/mp4" },
]
```

### section

Page section with a centered max-width content column.

| Prop | Type | Default |
|------|------|---------|
| `contentMaxWidth` | `ResponsiveValue<string\|number>` | `"1200px"` |
| `centered` | `boolean` | `true` |
| `fullViewport` | `boolean` | `false` (sets `min-height: 100svh`) |
| `snapAlign` | `"start" \| "center" \| "end"` | — |

### button

Renders a `<button>` or `<a>` (if `href` is set).

| Variant | Style |
|---------|-------|
| `solid` | Filled with accent colour |
| `outline` | Transparent with accent border |
| `ghost` | Transparent, no border |
| `elevated` | Solid with glowing shadow |
| `link` | Underlined text, no padding |

Sizes: `xs`, `sm`, `md`, `lg`, `xl`.

### card

A styled container with variants: `elevated`, `outlined`, `filled`, `flat`. Set `interactive: true` for hover lift.

### spacer

Inserts whitespace. `axis: "y"` (default) or `axis: "x"`.

### divider

A `<hr>` with configurable orientation, color, thickness, and style.

### slot

Renders a named piece of React content injected via `createPage({ slots: { … } })`. Useful for dynamic content that can't be expressed as a schema node.

```ts
// In schema:
{ type: "slot", props: { name: "userWidget", fallback: { type: "text", props: { content: "Loading…" } } } }

// In createPage:
createPage({
  schema: MySchema,
  slots: { userWidget: <UserWidget /> }
})
```

---

## Event Handlers

Handlers are provided at the `createPage` level and referenced in schema nodes by name:

```ts
// page.tsx
export default createPage({
  schema: MySchema,
  handlers: {
    openModal: () => setModalOpen(true),
    trackCta:  () => analytics.track("cta_clicked"),
  },
});

// In schema:
{
  type: "button",
  props: { label: "Open", onClick: "openModal" }
}
```

Because handlers are defined outside the schema object, they can close over React state from a parent component if needed.

---

## Theme System

Themes are defined in the `theme` key of the schema:

```ts
theme: {
  vars: {
    "--e-accent":    "#7c3aed",
    "--e-bg":        "#0f0f1a",
    "--e-card-bg":   "#1a1a2e",
    "--e-muted":     "#94a3b8",
    "--e-divider":   "rgba(255,255,255,0.08)",
    "--e-skeleton-a":"#1e1e35",   // shimmer dark colour
    "--e-skeleton-b":"#2a2a45",   // shimmer light colour
  },
  fonts: [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap"
  ],
  globalStyles: `
    body { background: var(--e-bg); font-family: 'Inter', sans-serif; }
  `,
}
```

All engine-internal CSS uses `var(--e-*)` properties, so the whole visual system is overridable from one place.

---

## Custom Components

Register a custom component under any string key:

```ts
import { memo } from "react";
import { registerComponent } from "@/engine";

const PricingCard = memo(function PricingCard({ plan, price, features, children }) {
  return (
    <div className="pricing-card">
      <h3>{plan}</h3>
      <span>{price}</span>
      {children}
    </div>
  );
});

registerComponent("pricing-card", PricingCard);
```

Then use it in any schema:

```ts
{
  type: "pricing-card",
  props: { plan: "Pro", price: "$9/mo" },
  children: [
    { type: "text", props: { content: "Unlimited projects" } }
  ]
}
```

Always call `registerComponent` at the module level (outside components), ideally in a file that's imported in `layout.tsx` or `_app.tsx`.

---

## createPage API

```ts
export default createPage({
  schema: MySchema,       // Required — the PageSchema definition
  config: {               // Optional — engine config overrides
    breakpoints: { … },
    contentMaxWidth: "1400px",
    gapBase: "1rem",
  },
  handlers: {             // Optional — named event handlers
    myHandler: () => { … }
  },
  slots: {                // Optional — named React node injections
    mySlot: <MyComponent />
  },
});
```

---

## defineSchema

Use `defineSchema` to define schemas in separate files with full TypeScript type-checking:

```ts
// schemas/home.schema.ts
import { defineSchema } from "@/engine";

export const HomeSchema = defineSchema({
  meta: { title: "Home" },
  root: { type: "box", children: [] }
});
```

```ts
// app/page.tsx
import { createPage } from "@/engine";
import { HomeSchema } from "@/schemas/home.schema";

export default createPage({ schema: HomeSchema });
```

---

## Performance Checklist

Things the engine handles automatically — you don't need to do these manually:

- React.memo on every rendered component
- next/image on every image node
- loading="lazy" passed to next/image for non-priority images
- IntersectionObserver pre-loading with size-aware rootMargin
- content-visibility: auto on off-screen sections
- contain-intrinsic-height to prevent scroll jump
- Blur-up image placeholder
- Video src withheld from DOM until near viewport
- CSS-only responsive layout (zero JS breakpoint detection)
- Single deduplicated `<style>` tag for all CSS variables
- Suspense boundaries around every lazy-mounted subtree
- Shimmer skeleton placeholders with reserved space (prevents CLS)

Things you still control:

- Which breakpoints to use (configurable)
- rootMargin overrides via `props.rootMargin`
- Forcing eager/lazy via `props.priority` or `props.lazy`
- Custom component registration
- Theme CSS variables
- Event handler wiring

---

## Integrating with Next.js App Router

The engine output is a standard React function component. Use it as a default export in any `page.tsx`:

```ts
// app/page.tsx
import { createPage } from "@/engine";
export default createPage({ schema: HomeSchema });
```

For the `<head>` meta tags to work correctly in App Router, the `EngineHead` output needs to be rendered inside a `<head>` element. The simplest approach is to handle `title` and `description` in your `layout.tsx` using `generateMetadata`, and leave the schema meta for supplementary tags only.

---

## Integrating with Next.js Pages Router

```ts
// pages/index.tsx
import { createPage } from "@/engine";
export default createPage({ schema: HomeSchema });
export const getStaticProps = async () => ({ props: {} });
```

---

## Module Aliases

Add this to `tsconfig.json` for clean imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@/engine": ["./src/engine/index.ts"],
      "@/engine/*": ["./src/engine/*"]
    }
  }
}
```
