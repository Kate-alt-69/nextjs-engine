# Next.js Engine — Technical Documentation

> **Last updated:** 2026-06-18
> **Changes in this update:**
> - **At-rule style support** — `style` objects and `staticClass()` now accept nested CSS at-rules such as `@media`, `@supports`, `@container`, `@starting-style`, and global declaration at-rules such as `@view-transition`. Runtime `style` at-rules are compiled through `StyleCollector` instead of being passed to React inline styles.
> - **Compile fixes** — `EngineNav` desktop item visibility now uses the configured `mobileBreakpoint` through nested at-rule CSS. `EngineAPIConfigParser` now emits `destinationHeader` for API key auth and accepts compiled PNP private keys as JWK strings.
> **Changes in previous update:**
> - **`EngineAPIConfigParser`** — New `src/engine/core/EngineAPIConfigParser.ts`. Parses `.EngineAPIConfig/*.api` files (TOML-inspired syntax) into a compiled `EngineAPICompiledConfig` object consumed by `EngineAPIResolver`. Supports `$ENV_VAR` substitution, all auth types (`ak`, `bearer`, `jwt`, `basic`, `hmac`, `pnp`), version macros, and per-provider header overrides. In-process cache via `ensureAPIConfig()`.
> - **`engineApiPlugin`** — New `src/engine/plugins/engineApiPlugin.js`. Next.js `webpack` plugin that compiles `.EngineAPIConfig/*.api` at build time and writes `.engine-api-compiled.json` to the project root. Import with `const withEngineAPI = require("./src/engine/plugins/engineApiPlugin")` in `next.config.js`.
> - **`schemaAnalyzer`** — New `src/engine/core/schemaAnalyzer.ts` (TASK-018). Static analyzer for `PageSchema`/`SchemaNode` trees. Emits TypeScript-compiler-style diagnostics: `E001` unknown type (+ Levenshtein "did you mean?"), `E002` missing required prop, `E003` duplicate id/point, `E004` circular reference, `W001`–`W006` accessibility and performance warnings. Exports `analyzeSchema()`, `analyzeNode()`, `isSchemaValid()`.
> - **`staticClass` utility** — New export from `usePropStyles.ts`. Converts a plain `CSSProperties` object into a deduplicated CSS class injected once into `StyleCollector`. Used internally by `EngineSection` and `EngineCard` to eliminate repeated inline styles on inner-wrapper `<div>`s (TASK-005). Public API: `import { staticClass } from "@/engine"`.
> - **Anti-fingerprint console fix** — `EngineAPIResolver`'s blocked-header warning is now dev-only (no-ops in production).
> **Changes in previous update:**
> - **Core Component Additions** — New `EngineLink` (transition-aware), `EngineHero` (layout variants), `EngineSuspense` (loading presets), and `EngineForms` suite (Form, Input, etc).
> - **`EngineAPIResolver`** — Declarative networking class for centralized fetch orchestration with multi-tier overrides and native auth support.
> - **CSS Tier System** — `StyleCollector` now classifies every CSS block into one of three tiers based on how many page renders have used it: **Global** (10+ renders, or explicitly marked — layout/header CSS), **Group** (3–9 renders — shared across several pages), **Local** (1–2 renders — page-unique). Output order is always Global → Group → Local. `EngineGlobalStyles` component exported for `layout.tsx` injection of early global CSS.
> - **Image optimization** — `next.config.js` now routes images through AVIF → WebP → original format automatically. `EngineImage` gains `qualityPreset` ("performance" 65 / "balanced" 75 / "sharp" 90), per-viewport `qualityMobile`/`qualityDesktop` fields, smarter `sizes` auto-generation, resolution-aware placeholder shimmer, and `imageRendering` browser hint prop.
> - **`sides` prop** — new per-side spacing system. `sides: [1,2,3,4]` where 1=top 2=left 3=right 4=bottom. Pair with `sideDistance` and `sideType` ("margin" | "padding").
> - **`vars` prop** — set CSS custom properties (`--var: value`) inline on any element. Cascades to all children.
> - **Card overhaul** — `cover`, `coverAlt`, `coverRatio`, `coverFit`, `direction`, `innerPadding`, `coverWidth`.
> **Changes in this update:**
> - **Markdown heading anchors** — `EngineMarkdown` now generates stable slug ids for headings, so schema links/buttons can use `href: "#section-name"` for smooth in-page document navigation. Optional `headingIdPrefix` can namespace generated heading ids.
> - **`createPage` markdown shorthand** — `createPage` now accepts compact local Markdown page objects with `filePath`, optional `title`, `description`, `meta`, `theme`, `markdown`, and `section` fields. It also accepts direct `{ meta, theme, root }` schemas again, matching the older engine examples.
> - **Bug fix:** `createPage.tsx` — removed top-level `node:fs/promises` import that crashed webpack. Now uses a dynamic `import("fs/promises")` inside the async resolver so webpack never sees a static `node:` URI. `next.config.js` also gets a client-side `fs` fallback as defence-in-depth.
> - **`EngineMarkdown`** — lazy-loaded by default when below the fold (added to `lazyDetect.ts`). New props: `textAnimation` (`fade-in` | `slide-up`), `blockAnimation` (per-block staggered), `animationDuration`, `animationStagger`, `fontFamily`, `bodySize`, `bodyLineHeight`. Animation CSS is injected once on first mount and respects `prefers-reduced-motion`.
> - **`MarkdownProps`** in `types.ts` updated with all new props above.
> **Changes in this update:** Added support for common long-form style aliases in the engine style bridge, including `fontSize`, `fontWeight`, `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `alignItems`, `justifyContent`, `gridTemplateColumns`, `gridTemplateRows`, `backgroundImage`, `backgroundSize`, `backgroundRepeat`, `backgroundPosition`, `boxShadow`, `transition`, `backdrop`, and `backdropFilter`. `bg` now writes to CSS `background`, so gradients render correctly. Added `createComponent`, an engine helper for reusable schema-rendered components with runtime slots. Component children are available inside the schema as a slot named `children`.

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
│   ├── resolver.ts              Converts ResponsiveValue props to CSS custom properties
│   ├── StyleCollector.ts        Collects CSS blocks during render, outputs one style tag
│   ├── registry.ts              Maps NodeType strings to React components
│   ├── lazyDetect.ts            Analyses nodes and decides lazy strategy per element
│   ├── SchemaRenderer.tsx       Walks the schema tree and renders each node
│   ├── EngineAPIResolver.ts     Runtime fetch orchestrator with multi-tier auth + version macros
│   ├── EngineAPIConfigParser.ts Parses .EngineAPIConfig/*.api files into EngineAPICompiledConfig
│   ├── schemaAnalyzer.ts        Static analyzer — diagnostics, did-you-mean, a11y, perf warnings
│   └── validateSchema.ts        Runtime schema validation (lightweight, throws on hard errors)
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
│   ├── EngineLink.tsx        Styled anchor — delegates routing to EngineNav
│   ├── EngineNav.tsx         Navigation bar + shared anchor-rendering pipeline
│   ├── EngineImage.tsx       Smart lazy image with blur-up progressive loading
│   ├── EngineVideo.tsx       Lazy video — src never loads until near viewport
│   ├── EngineHero.tsx        Dedicated hero sections with parallax and overlays
│   ├── EngineSuspense.tsx    Schema-native Suspense with loading presets
│   ├── EngineForms.tsx       Form primitives (Input, Textarea, Checkbox, etc)
│   └── LazyMount.tsx         Generic lazy mount wrapper + LazySection variant
│
├── plugins/
│   └── engineApiPlugin.js    Next.js webpack plugin — compiles .EngineAPIConfig at build time
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
| `markdown` | Never by default | Uses normal text flow; set `lazy` manually if needed |
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
| `vars` | `Record<string, string>` | CSS custom properties set inline — cascade to all children |
| `priority` | `boolean` | Skip lazy loading entirely |
| `lazy` | `boolean` | Force lazy (true) or eager (false) |
| `m`, `mt`, `mr`, `mb`, `ml`, `mx`, `my` | `ResponsiveValue<string\|number>` | Margin |
| `p`, `pt`, `pr`, `pb`, `pl`, `px`, `py` | `ResponsiveValue<string\|number>` | Padding |
| `w`, `h`, `minW`, `minH`, `maxW`, `maxH` | `ResponsiveValue<string\|number>` | Sizing |
| `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` | `ResponsiveValue<string\|number>` | Long-form sizing aliases |
| `bg` | `string` | Background color |
| `color` | `string` | Text color |
| `border` | `string` | CSS border shorthand |
| `borderRadius` | `ResponsiveValue<string\|number>` | Border radius |
| `shadow` | `string` | Box shadow |
| `boxShadow` | `string` | Long-form box shadow alias |
| `transition` | `string` | CSS transition |
| `backgroundImage`, `backgroundSize`, `backgroundRepeat`, `backgroundPosition` | `string` | Background image controls |
| `backdrop`, `backdropFilter` | `string` | CSS backdrop-filter controls |
| `position` | `string` | CSS position |
| `zIndex` | `number` | Z-index |
| `opacity` | `number` | Opacity |
| `overflow` | `string` | Overflow behaviour |
| `sides` | `(1\|2\|3\|4)[]` | Which sides `sideDistance` applies to (1=top 2=left 3=right 4=bottom) |
| `sideDistance` | `string\|number` | Distance applied to each selected side |
| `sideType` | `"margin"\|"padding"` | Whether `sideDistance` maps to margin (default) or padding |
| `onClick` | `string` | Handler name from `createPage({ handlers })` |
| `href` | `string` | Wraps node in an `<a>` tag |

Numbers in spacing/sizing props are treated as pixels divided by 16 (so `16 → 1rem`, `32 → 2rem`).

### `vars` — CSS Custom Properties

Set CSS variables directly on any element. They cascade to all children through the standard CSS variable system.

```ts
{
  type: "box",
  props: {
    vars: {
      "--card-bg": "#1a1a2e",
      "--accent":  "#9bcf3a",
      "--radius":  "12px",
    },
    bg: "var(--card-bg)",
  }
}
```

Keys without a leading `--` are auto-prefixed, so `"accent"` and `"--accent"` both work.

### `sides` — Per-Side Spacing

The sides system applies a distance to specific sides of an element using CSS margin (default) or padding. In a CSS grid, adding margin to a cell pushes adjacent cells outward.

**Side numbering:**
```
        1 (top)
         ┌───┐
2 (left) │   │ 3 (right)
         └───┘
        4 (bottom)
```

**Diamond effect on a 3×3 grid** — give the centre cell outward margin on all sides:

```ts
{
  type: "grid",
  props: { columns: 3, gap: "1rem" },
  children: [
    // ... 4 outer cells ...
    {
      type: "box",
      props: {
        sides: [1, 2, 3, 4],   // all four sides
        sideDistance: "32px",  // push 32px outward on every side
        sideType: "margin",    // margin = pushes neighbours (default)
        bg: "#9bcf3a",
      }
    },
    // ... 4 outer cells ...
  ]
}
```

**Top and bottom push only** — vertical stretch effect:

```ts
props: {
  sides: [1, 4],        // top and bottom
  sideDistance: "64px",
}
```

**Padding variant** — push inner content instead of neighbours:

```ts
props: {
  sides: [2, 3],        // left and right sides only
  sideDistance: "2rem",
  sideType: "padding",  // pushes content inward
}
```

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

### markdown

Renders trusted Markdown content through the engine. This is intended for local content files such as legal pages, documentation, and policy copy.

Supported Markdown:
- `#` through `######` headings
- paragraphs
- unordered and ordered lists
- `**bold**`, `*italic*`, and inline links like `[label](/path)`
- horizontal rules using `---`

| Prop | Type | Description |
|------|------|-------------|
| `content` | `string` | Markdown source text |
| `filePath` | `string` | Local Markdown file path. `createPage` reads it on the server before rendering. |
| `textColor` | `string` | Paragraph/list text color |
| `headingColor` | `string` | Heading color |
| `linkColor` | `string` | Link color |
| `mutedColor` | `string` | Divider/border color |

### section

Page section with a centered max-width content column.

| Prop | Type | Default |
|------|------|---------|
| `contentMaxWidth` | `ResponsiveValue<string\|number>` | `"1200px"` |
| `centered` | `boolean` | `true` |
| `fullViewport` | `boolean` | `false` (sets `min-height: 100svh`) |
| `snapAlign` | `"start" \| "center" \| "end"` | — |

### markdown

Renders a Markdown string as semantic HTML inside an `<article>`. Lazy-loaded when below the fold (400px rootMargin). Parsed blocks: headings `#`–`######`, paragraphs, `**bold**`, `*italic*`, `[links](url)`, unordered/ordered lists, `---` horizontal rules.

**Content loading:**

```ts
// Inline string
{ type: "markdown", props: { content: "# Hello\n\nParagraph text." } }

// From a .md file (server-side only — resolved by createPage before render)
{ type: "markdown", props: { filePath: "./content/about.md" } }
```

**Colour props:**

| Prop | Default | Description |
|------|---------|-------------|
| `textColor` | `"#30475f"` | Body paragraph colour |
| `headingColor` | `"#07111f"` | Heading colour |
| `linkColor` | `"#12304c"` | Inline link colour |
| `mutedColor` | `"rgba(7,17,31,0.16)"` | `<hr>` / divider colour |

**Typography props:**

| Prop | Default | Description |
|------|---------|-------------|
| `fontFamily` | inherited | Font family for the whole article |
| `bodySize` | `"1rem"` | Paragraph font-size |
| `bodyLineHeight` | `1.8` | Paragraph line-height |
| `headingSizes` | scale defaults | Per-level overrides — `{ h1: "clamp(2rem,5vw,3.5rem)", h2: "1.75rem" }` |
| `headingIdPrefix` | — | Optional prefix for generated heading ids used by `href="#..."` navigation |

Markdown headings automatically receive slug ids based on their text. For example, `## Use of Services` renders with `id="use-of-services"`, so an engine button or link can point to `href: "#use-of-services"`. Add `html { scroll-behavior: smooth; }` in page `theme.globalStyles` for smooth jumps.

**Animation props:**

| Prop | Values | Default | Description |
|------|--------|---------|-------------|
| `textAnimation` | `"none" \| "fade-in" \| "slide-up"` | — | Animates the whole article on mount |
| `blockAnimation` | `"none" \| "fade-in" \| "slide-up"` | — | Staggered per-block animation |
| `animationDuration` | CSS time string | `"0.4s"` | Duration per animation |
| `animationStagger` | number (ms) | `50` | Extra delay added per block |

All animations respect `prefers-reduced-motion: reduce` — set to `animation: none !important` automatically.

```ts
{
  type: "markdown",
  props: {
    filePath: "./content/post.md",
    blockAnimation: "slide-up",
    animationDuration: "0.5s",
    animationStagger: 60,
    headingColor: "#9bcf3a",
    bodySize: "1.05rem",
  }
}
```

Renders a `<button>` or `<a>`. Note: For advanced routing and smooth transitions, use the `link` component.

| Variant | Style |
|---------|-------|
| `solid` | Filled with accent colour |
| `outline` | Transparent with accent border |
| `ghost` | Transparent, no border |
| `elevated` | Solid with glowing shadow |
| `link` | Underlined text, no padding |

Sizes: `xs`, `sm`, `md`, `lg`, `xl`.

### link

The primary routing primitive. It handles external URLs automatically and integrates with the `next-view-transitions` pipeline.

| Prop | Type | Description |
|------|------|-------------|
| `href` | `string` | Destination URL. Defaults to `"#"` |
| `target` | `string` | HTML anchor target (e.g., `"_blank"`) |
| `onClick` | `string \| function` | Named handler or callback function |
| `content` | `string` | Text content (alternative to schema children) |
| `cprop.link` | `EngineLinkConfig` | Behavior config: `{ transition: "page-to-page" | "instant", styles: CSSProperties }` |

**Transition Pipeline:**
- `page-to-page`: Uses the View Transitions API for seamless full-page animations.
- `instant`: Standard high-speed client-side navigation.

**Routing pipeline:** `EngineLink` delegates all anchor rendering to `renderEngineAnchor` exported from `EngineNav`. The three-strategy routing (external / animated / native) lives in one place.

**Note:** `EngineLink` merges styles from `cprop.styles` and `cprop.link.styles` before processing.

---

### nav

Schema type: `"nav"` | `"EngineNav"` — Full navigation bar with logo, items, mobile hamburger, dropdown sub-menus, and sticky support. Also owns `renderEngineAnchor`, the shared routing pipeline used by both `EngineNav` and `EngineLink`.

#### CSS custom properties

| Variable | Default | Purpose |
|---|---|---|
| `--engine-nav-bg` | `transparent` | Nav background |
| `--engine-nav-border` | `rgba(255,255,255,0.08)` | Bottom border (horizontal) |
| `--engine-nav-color` | `inherit` | Item text color |
| `--engine-nav-active-color` | `var(--color-primary)` | Active item text |
| `--engine-nav-active-bg` | `rgba(255,255,255,0.1)` | Active item background |
| `--engine-nav-height` | `3.5rem` | Min-height of horizontal bar |
| `--engine-nav-px` | `1.5rem` | Horizontal padding |
| `--engine-nav-max-width` | `1200px` | Inner content max-width |
| `--engine-nav-blur` | `blur(12px)` | Backdrop blur when sticky |
| `--engine-nav-dropdown-bg` | `#1a1a1a` | Dropdown panel background |
| `--engine-nav-dropdown-border` | `rgba(255,255,255,0.1)` | Dropdown panel border |

#### Props

| Prop | Default | Description |
|---|---|---|
| `variant` | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"minimal"` |
| `sticky` | `false` | Stick to top with `backdrop-filter` blur |
| `logo` | — | `{ src, href, alt, width, height }` |
| `items` | `[]` | Array of `EngineNavItem` |
| `mobileBreakpoint` | `768` | px threshold for hamburger menu |

```ts
interface EngineNavItem {
  label:     string;
  href?:     string;
  target?:   string;
  cprop?:    { link?: { transition?: string; href?: string } };
  active?:   boolean;           // auto-detected from pathname if omitted
  children?: EngineNavItem[];   // renders as dropdown
}
```

#### Schema example

```json
{
  "type": "nav",
  "props": {
    "sticky": true,
    "logo": { "src": "/logo.svg", "href": "/", "alt": "Brand" },
    "items": [
      { "label": "Home",   "href": "/" },
      { "label": "Docs",   "href": "/docs", "cprop": { "link": { "transition": "page-to-page" } } },
      { "label": "GitHub", "href": "https://github.com/...", "target": "_blank" },
      { "label": "More",   "children": [{ "label": "Blog", "href": "/blog" }] }
    ]
  }
}
```

### hero

A layout-heavy section primitive designed for high-impact banners.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `string` | `"centered"` | `"centered" | "split" | "fullbleed"` |
| `overlay` | `string` | — | Background overlay (CSS color/gradient). |
| `parallax` | `boolean` | `false` | Enable scroll-parallax effect. |
| `contentMaxWidth` | `ResponsiveValue` | `"1200px"` | Max width of the inner content container |
| `centered` | `boolean` | `true` | Horizontally centers the content container |
| `snapAlign` | `string` | — | CSS `scroll-snap-align` property |
| `fullViewport` | `boolean` | `true` | Sets `min-height: 100svh` |

**Layout Variants:**
- `centered`: Flex-column with center alignment.
- `split`: 1:1 CSS Grid layout for side-by-side content.
- `fullbleed`: No container constraints; children fill the entire section width.

### suspense

Wraps children in a React Suspense boundary with optimized loading presets.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `preset` | `string` | `"skeleton"` | `"skeleton" | "spinner" | "shimmer" | "pulse" | "blur"` |
| `minHeight` | `string\|number` | — | Reserved vertical space for the placeholder |
| `skeletonLines` | `number` | `4` | Lines for the skeleton preset |
| `delay` | `number` | `0` | Delay in ms before fallback appears |
| `fallback` | `ReactNode` | — | Custom fallback override |

**Note:** Uses `DelayedFallback` internally to prevent "flashing" on fast network connections.

### form

A standard `<form>` primitive that bridges the schema to the `EngineAPIResolver`.

| Prop | Type | Description |
|------|------|-------------|
| `onSubmit` | `string` | Handler name. Automatically receives form data |
| `onReset` | `string` | Handler name to trigger on form reset |
| `method` | `string` | `"get" \| "post"`. |
| `action` | `string` | Native form action URL |
| `noValidate` | `boolean` | Disable browser built-in validation. |
| `autoComplete` | `string` | Native autocomplete control |
| `encType` | `string` | Encoding type for multipart/file submissions |

### input / textarea / checkbox / label

Standard form primitives.

- **input**: Supports `type` (text, password, email, number, etc), `name`, `placeholder`, and standard constraints.
- **textarea**: Supports `rows`, `cols`, and `resizable` (`none | both | horizontal | vertical`).
- **checkbox**: Supports `checked`, `defaultChecked`, and `value`.
- **label**: Supports `htmlFor` or `forInput` (shorthand).

**Data Binding:**
Form elements utilize `data-engine-bind` for automatic field mapping during `EngineAPIResolver` orchestration.

---

## Networking

### EngineAPIResolver

A centralized class for handling fetch requests with multi-tier evaluation (Global → Page → Node).

```ts
const resolver = new EngineAPIResolver({
	endpoint: "https://api.kastrick.com/&v&/",
	versionMacros: { v: "v1" }
});

const res = await resolver.resolveRequest({
	formData: { username: "admin" },
	pageOverrides: {
		endpoint: "https://api.kastrick.com/&v&/login", // Macros still apply to overrides
		method: "POST"
	}
});
```

**Configuration (`EngineAPIConfig`):**
- `endpoint`: Base URL.
- `method`: HTTP Verb.
- `auth`: Authentication config (`type: "bearer" | "basic" | "hmac" | "pnp"`).
- `headers`: Request headers.
- `versionMacros`: URL macro map (e.g., `&v&` -> `v1`).

---

### EngineAPIConfigParser — `.EngineAPIConfig` file format

Place `.api` files inside a `.EngineAPIConfig/` directory at your project root. The plugin compiles them at build time; the parser can also be called at runtime server-side.

**File format (TOML-inspired):**

```ini
# .EngineAPIConfig/main.api

[provider.main]
endpoint = "https://api.kastrick.com"
method   = "POST"
cache    = "no-cache"

[provider.main.auth]
type      = "hmac"
secret    = "$API_SECRET"
algorithm = "sha-256"

[provider.cdn]
endpoint = "https://cdn.kastrick.com"
method   = "GET"
cache    = "force-cache"

[versions]
V1 = "/api/v1"
V2 = "/api/v2"
```

Environment variables are substituted with `$VAR_NAME` syntax. All `$VAR` values are resolved from `process.env` at compile time (plugin) or at `ensureAPIConfig()` call time (runtime).

**Next.js plugin setup:**

```js
// next.config.js
const withEngineAPI = require("./src/engine/plugins/engineApiPlugin");

module.exports = withEngineAPI({
  // your existing next config
}, {
  configDir:  ".EngineAPIConfig",          // default
  outputFile: ".engine-api-compiled.json", // default
});
```

**Runtime usage (server-side):**

```ts
import { ensureAPIConfig } from "@/engine";

// In getServerSideProps / Route Handler / Server Component:
const config = await ensureAPIConfig(); // reads + caches on first call

const resolver = new EngineAPIResolver({
  endpoint:      "&V1&/users/login",
  provider:      "main",
  compiledConfig: config,
});
```

**Supported auth types:**

| Type | Required fields | Header emitted |
|------|----------------|----------------|
| `none` | — | — |
| `ak` | `key`, `header?` | `X-Key: <key>` (or custom header) |
| `bearer` | `token` | `Authorization: Bearer <token>` |
| `jwt` | `token` | `Authorization: Bearer <token>` |
| `basic` | `username`, `password` | `Authorization: Basic <base64>` |
| `hmac` | `secret`, `algorithm?` | `X-Timestamp`, `X-Signature` (SHA-256 or SHA-512 HMAC) |
| `pnp` | `privateKey` (JWK), `algorithm?` | `X-Key`, `X-Timestamp`, `X-Signature` (Ed25519 or RS256) |

---

### card

A styled container with full layout control.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"elevated"\|"outlined"\|"filled"\|"flat"` | `"elevated"` | Visual style |
| `interactive` | `boolean` | `false` | Hover lift + pointer cursor |
| `direction` | `"vertical"\|"horizontal"` | `"vertical"` | Cover on top vs cover on left |
| `cover` | `string` | — | Cover image URL |
| `coverAlt` | `string` | `""` | Alt text for the cover image |
| `coverRatio` | `string` | `"16/9"` | CSS aspect-ratio of the cover area |
| `coverFit` | `string` | `"cover"` | CSS object-fit for the cover image |
| `coverWidth` | `string` | `"40%"` | Cover column width when `direction="horizontal"` |
| `innerPadding` | `string` | `"1.25rem"` | Padding on the content area |

Any children passed to the card render inside the content area below (or beside) the cover.

```ts
// Simple card with cover image
{
  type: "card",
  props: {
    cover: "/images/hero.jpg",
    coverAlt: "Mountains at sunset",
    coverRatio: "3/2",
    variant: "elevated",
    interactive: true,
  },
  children: [
    { type: "text", props: { variant: "h3", content: "Alpine Trek" } },
    { type: "text", props: { content: "A 5-day route through the high passes." } },
  ]
}

// Horizontal card (media left, content right)
{
  type: "card",
  props: {
    direction: "horizontal",
    cover: "/images/thumb.jpg",
    coverAlt: "Article thumbnail",
    coverWidth: "35%",
    variant: "outlined",
    innerPadding: "1.5rem",
  },
  children: [
    { type: "text", props: { variant: "h4", content: "Getting Started" } },
    { type: "text", props: { content: "Everything you need to know." } },
  ]
}
```

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

`createPage` accepts three page definition shapes:

```ts
// Existing full-schema form
export default createPage({
  schema: MySchema,
  config: {
    breakpoints: { … },
    contentMaxWidth: "1400px",
    gapBase: "1rem",
  },
  handlers: {
    myHandler: () => { … }
  },
  slots: {
    mySlot: <MyComponent />
  },
});

// Direct schema form
export default createPage({
  meta: { title: "Home" },
  root: { type: "box", children: [] },
});

// Compact local Markdown page form
export default createPage({
  title: "Privacy Policy — Kastrick",
  description: "Kastrick privacy policy.",
  filePath: "@/data/page/privacy.md",
  markdown: {
    headingColor: "#07111f",
    textColor: "#30475f",
    linkColor: "#12304c",
  },
});
```

When using the Markdown page form, `meta.title` and `meta.description` override the top-level `title` and `description` fallbacks.

The older full-schema signature remains:

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

## createComponent API

Use `createComponent` for reusable app chrome or shared UI that still needs to be rendered through the engine. It accepts the same options as `createPage`, but the returned component accepts runtime `slots` and `children`.

```ts
const SiteChrome = createComponent({
  schema: defineSchema({
    root: {
      type: "box",
      children: [
        { type: "section", children: [] },
        { type: "slot", props: { name: "children" } },
      ],
    },
  }),
});

export default SiteChrome;
```

Runtime slots can be passed with `<SiteChrome slots={{ sidebar: <Sidebar /> }}>...</SiteChrome>`. Plain children are injected into `{ type: "slot", props: { name: "children" } }`.

### Loading Markdown Files

`createPage` can load local Markdown files when a `markdown` node has `props.filePath`. The file content is injected into that node before rendering, while all display control stays on the node props.

```ts
import path from "node:path";
import { createPage, defineSchema } from "@/engine";

export default createPage({
  schema: defineSchema({
    root: {
      type: "section",
      children: [
        {
          type: "markdown",
          props: {
            filePath: path.join(process.cwd(), "data/page/privacy.md"),
            headingColor: "#07111f",
            textColor: "#30475f",
            linkColor: "#12304c",
          },
        },
      ],
    },
  }),
});
```

For simple document-style pages, use the compact Markdown page form:

```ts
import { createPage } from "@/engine";

export default createPage({
  meta: {
    title: "Kastrick Terms of Service",
  },
  title: "Terms of Service — Kastrick",
  description: "Kastrick terms of service.",
  filePath: "@/data/page/tos.md",
  markdown: {
    blockAnimation: "slide-up",
  },
});
```

`filePath` can be absolute, relative to the project working directory, or use the `@/` project-root alias. If both `content` and `filePath` are supplied, loaded file content takes precedence. This feature is server-only, so routes that use local Markdown files should not be marked `"use client"`.

---

## Known Issues

### [BUG-001] SSR Spacing/Sizing Hydration Mismatch
**Description:** Spacing props (`mt`, `py`, `px`, `h`, etc.) and sizing aliases often fail to render on initial page load, leading to a "collapsed" or incorrect layout. This is temporarily "fixed" when a Next.js Hydration Error occurs, forcing a client-side re-render that correctly applies the styles.

**Root Cause:** The `StyleCollector`'s tier system is non-deterministic in development environments, causing the generated CSS string to differ between server and client renders. This is exacerbated by the inclusion of tier-identifying comments in the CSS output during development.

**Affected Files & Lines:**
- `src/engine/createPage.tsx:275` (where the hydration error manifests, due to the mismatch)
- `src/engine/core/StyleCollector.ts:30` (cross-render registry `_xReg` persistence, contributing to non-determinism)
- `src/engine/core/StyleCollector.ts:44` (`_tierOf` function logic, contributing to non-determinism)
- `src/engine/core/StyleCollector.ts:65` (tier `count` incrementation, contributing to non-determinism)
- `src/engine/core/StyleCollector.ts:100-108` (conditional inclusion of tier comments in `collect` method, **FIXED by removing comments in development**)

**Resolution:** The tier-identifying comments in `src/engine/core/StyleCollector.ts`'s `collect` method (lines 100-108) have been removed for development environments to prevent hydration mismatches. Further architectural improvements are tracked in `TODO.md`.

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

---

## CSS Tier System

The engine automatically classifies every CSS block into one of three tiers based on how many page renders have used it. Output order is always **Global → Group → Local** so the cascade is correct.

```
 Tier        Threshold           Typical source
 ──────────  ──────────────────  ─────────────────────────────────────────
 Global      10+ renders OR      Engine baseline, theme vars, layout,
             explicit call       header, footer — CSS on EVERY page
 Group       3–9 renders         Shared components used on several pages,
                                 repeated responsive configs
 Local       1–2 renders         Page-specific overrides, one-off values
```

Tiers are **mutually exclusive** — Global CSS does not appear in Group or Local.

### Using EngineGlobalStyles in layout.tsx

```tsx
// app/layout.tsx
import { EngineGlobalStyles } from "@/engine";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <EngineGlobalStyles />  {/* ← injects Global-tier CSS early */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`EngineGlobalStyles` outputs whatever CSS is currently in the Global tier of the cross-render registry. On a cold start it's empty (harmless). After a full SSG build or several dev-server navigations the Global tier is populated with all commonly-shared CSS.

### Explicitly marking CSS as Global

```ts
import { globalStyleCollector } from "@/engine/core/StyleCollector";

// Force a CSS block to Global — never demoted
globalStyleCollector.addGlobal(`:root { --brand: #9bcf3a; }`);
```

---

## Image Optimisation

All images are served as **AVIF → WebP → original format** automatically via Next.js image optimisation (configured in `next.config.js`). No changes needed in your schema — it's transparent.

### Quality presets

| Preset | Quality | Use for |
|--------|---------|---------|
| `"performance"` | 65 | Thumbnails, backgrounds, grids |
| `"balanced"` | 78 | General purpose (default) |
| `"sharp"` | 90 | Heroes, product shots, detail images |

```ts
{ type: "image", props: { src: "/hero.jpg", alt: "Hero", qualityPreset: "sharp" } }
```

### Per-viewport quality

Renders two `<Image>` elements and uses CSS to show the right one per viewport:

```ts
{
  type: "image",
  props: {
    src: "/photo.jpg",
    alt: "Photo",
    qualityMobile: 60,    // mobile (<768px) — smaller file
    qualityDesktop: 88,   // desktop (≥768px) — full quality
  }
}
```

### Format notes

- **AVIF** — 30–50% smaller than WebP at the same visual quality. Supported in Chrome 85+, Firefox 93+, Safari 16+.
- **WebP** — fallback for older browsers. Supported everywhere modern.
- **Original** — PNG/JPEG served only to browsers that don't support either.

No configuration needed — `next.config.js` sets `formats: ["image/avif", "image/webp"]` and Next.js handles the rest via `Accept` header negotiation.

---

## canvas

A canvas node that uses the GPU correctly and doesn't lag.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `"2d"\|"webgl"\|"webgl2"\|"auto"` | `"auto"` | Rendering context. "auto" tries webgl2 → webgl → 2d |
| `width` | `number` | — | Fixed width in px. Omit for responsive |
| `height` | `number` | — | Fixed height in px. Omit for responsive |
| `responsive` | `boolean` | `true` when no width/height | Fill container, resize automatically |
| `dpr` | `number\|"auto"` | `"auto"` | Device pixel ratio for sharp rendering |
| `maxDpr` | `number` | `2` | DPR cap — prevents 3× rendering on 3× displays |
| `adaptive` | `boolean` | `true` | Reduce DPR when FPS < 30, restore when > 55 |
| `pauseWhenOffscreen` | `boolean` | `true` | Stop RAF when canvas leaves viewport |
| `pauseWhenHidden` | `boolean` | `true` | Stop RAF when browser tab is hidden |
| `alpha` | `boolean` | `false` | Transparent canvas — set false for a free GPU win |
| `antialias` | `boolean` | `true` | WebGL MSAA — disable for particle systems |
| `powerPreference` | `string` | `"high-performance"` | Requests discrete GPU on dual-GPU laptops |
| `onSetup` | handler name | — | One-time setup — receives `(ctx, canvas)`, return cleanup fn |
| `onDraw` | handler name | — | Per-frame callback — `(ctx, canvas, delta, frame)` |
| `onResize` | handler name | — | Resize callback — `(ctx, canvas, cssW, cssH)` |

Handlers are registered in `createPage({ handlers: { myDraw: (ctx, canvas, delta) => { ... } } })`.

### 2D example

```ts
createPage({
  schema: defineSchema({
    root: {
      type: "canvas",
      props: {
        mode: "2d",
        responsive: true,
        style: { height: "400px" },
        onSetup: "setupCanvas",
        onDraw:  "drawCanvas",
      }
    }
  }),
  handlers: {
    setupCanvas(ctx, canvas) {
      ctx.font = "bold 16px sans-serif";
      return () => { /* cleanup on unmount */ };
    },
    drawCanvas(ctx, canvas, delta) {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      ctx.fillText(`Δ ${delta.toFixed(1)}ms`, 16, 32);
    },
  }
});
```

### WebGL 3D example

```ts
handlers: {
  setup3D(gl) {
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // compile shaders, create VAOs...
    return () => { gl.getExtension("WEBGL_lose_context")?.loseContext(); };
  },
  draw3D(gl, canvas, delta) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // draw calls...
  },
}
```

### Why it's faster than a plain canvas

- **`desynchronized: true`** (2D) — the browser presents the canvas without waiting for the main-thread compositor. This eliminates a full frame of latency on every draw call.
- **`powerPreference: "high-performance"`** (WebGL) — on laptops with both integrated and discrete GPUs, this requests the dedicated GPU.
- **`contain: strict`** — prevents the canvas's layout from triggering reflows in sibling elements during animation.
- **`transform: translateZ(0)` + `will-change: transform`** — promotes the canvas to its own GPU compositor layer.
- **Adaptive DPR** — if the GPU falls behind (FPS < 30), pixel density is reduced automatically and restored when headroom returns.
- **Pause when hidden/offscreen** — Page Visibility API + IntersectionObserver stop the RAF loop entirely when the canvas isn't visible, saving battery and preventing frame buildup.


---

## EngineScroll — Smooth Scroll + Anchor Navigation + Page Transitions

The scroll system handles all anchor-point navigation across the engine.

### Schema node type: `"scroll"`

```ts
{
  type: "scroll",
  props: {
    method:            "ease",   // "ease" | "smooth" | "snap" | "instant"
    easing:            "ease-in-out", // "ease-in" | "ease-out" | "linear" | "spring"
    scrollDuration:    600,      // ms, ease mode only
    pageTransition:    true,     // fade-out/fade-in for cross-page navigation
    transitionDuration: 350,     // ms
    scrollOffset:      80,       // px offset for sticky headers
  },
  children: [...]
}
```

### `point` prop (any node)

```ts
// Any engine node can be a scroll anchor target
{ type: "section", props: { point: "features" } }
// → <section id="features"> — reachable via URL#features
```

### Same-page vs cross-page navigation

| Scenario | Behaviour |
|----------|-----------|
| `/page#anchor` → `#anchor` on same page | Smooth scroll only (no transition) |
| `/page-a#foo` → `/page-b#bar` | Fade out → navigate → fade in → scroll |

### Easing methods

| Value | Description |
|-------|-------------|
| `"ease-in-out"` | Cubic, slow start + end, fast middle (Google-style, default) |
| `"ease-in"` | Cubic, slow start |
| `"ease-out"` | Cubic, slow end |
| `"linear"` | Constant speed |
| `"spring"` | Slight overshoot and settle |

### EngineMarkdown scroll points

By default, all h1 and h2 headings in `EngineMarkdown` become scroll anchor
points. Disable per-component:

```ts
{
  type: "markdown",
  props: {
    content: "...",
    disablepointformarkdownhash:     true,  // disables # (h1) as points
    disablepointformarkdownhashhash: true,  // disables ## (h2) as points
  }
}
```

The HTML `id` is still generated on all headings regardless of these flags —
so manual `href="#slug"` links still work.

### Direct JSX usage

```tsx
import { EngineScrollProvider, useEngineScroll } from "@/engine";

// Wrap your page (or put in layout.tsx for global transitions)
<EngineScrollProvider method="ease" pageTransition>
  <YourPageContent />
</EngineScrollProvider>

// Inside any child: programmatic navigation
function MyButton() {
  const scroll = useEngineScroll();
  return (
    <button onClick={() => scroll?.navigateTo("/other-page#section")}>
      Go to section
    </button>
  );
}
```

---

## cprop — Custom CSS Props

`cprop` exposes pseudo-class states and direct CSS on any engine node.

```ts
{
  type: "card",
  props: {
    cprop: {
      onHover:  { background: "#1a1a2e", transform: "scale(1.02)" },
      onFocus:  { outline: "2px solid var(--e-accent)", outlineOffset: "3px" },
      onActive: { transform: "scale(0.98)", opacity: "0.9" },
      css:      { userSelect: "none", willChange: "transform" },
    }
  }
}
```

### How it works

`onHover`, `onFocus`, and `onActive` are compiled to CSS rules and injected into
`StyleCollector` during render — the same pipeline as all other engine styles.
A hash-based class name (e.g. `e-h-1a2b3c4`) is returned and merged into the
element's `className`. No JavaScript event handlers are used — it is pure CSS.

`cprop.css` is a standard `CSSProperties` object applied as inline style.

### cpropClass utility

```tsx
import { cpropClass } from "@/engine";

// In your own custom components:
function MyComponent({ cprop, className, ...props }) {
  const hoverClass  = cpropClass(cprop);
  const mergedClass = [className, hoverClass].filter(Boolean).join(" ");
  return <div className={mergedClass} {...props} />;
}
```

---

## BUG-001 Fix — Hydration Mismatch

See `TODO.md` for the full root-cause analysis. In short:

- `StyleCollector.collect()` now emits CSS in **insertion order** with **no tier
  comments**. Server and client always traverse the same component tree in the
  same order, so the CSS string is byte-for-byte identical on both sides.
- `StyleCollector._resetRegistry()` is called at the start of each `createPage`
  in development to prevent cross-request tier accumulation.


---

## EngineBrowser — Browser Detection & Conditional Execution

`EngineBrowser` is a client-side module (safe on SSR — returns defaults when `window` is undefined).

### Detection

```ts
import { EngineBrowser } from "@/engine";

// Browser identity
EngineBrowser.is.chrome     // boolean
EngineBrowser.is.firefox    // boolean
EngineBrowser.is.safari     // boolean
EngineBrowser.is.edge       // boolean
EngineBrowser.is.opera      // boolean
EngineBrowser.is.brave      // boolean
EngineBrowser.is.osmium     // boolean  ← yes, Osmium is detected
EngineBrowser.is.chromium   // any Chromium-based browser
EngineBrowser.is.mobile     // touch-primary device
EngineBrowser.is.desktop    // mouse-primary device

// Feature support
EngineBrowser.supports.viewTransitions   // View Transitions API
EngineBrowser.supports.containerQueries  // CSS @container
EngineBrowser.supports.cssHas            // CSS :has()
EngineBrowser.supports.reducedMotion     // prefers-reduced-motion: reduce
EngineBrowser.supports.prefersDark       // prefers-color-scheme: dark
EngineBrowser.supports.webgl2            // WebGL 2
```

### Conditional execution

```ts
EngineBrowser.run({
  safari:  () => applySafariScrollFix(),
  firefox: () => applyFirefoxFix(),
  default: () => {},
});

const cls = EngineBrowser.pick({
  safari:  "scroll-ios",
  default: "scroll-standard",
});
```

### React hook

```tsx
import { useBrowser } from "@/engine";

function MyComponent() {
  const browser = useBrowser();  // SSR-safe, updates after mount
  if (browser.is.safari) return <SafariVariant />;
  return <StandardVariant />;
}
```

---

## CSS Directly on Prop

Any standard CSS property can be written directly alongside engine shorthands:

```ts
{
  type: "box",
  props: {
    // Engine shorthands
    bg:  "#111",
    px:  "2rem",
    // Direct CSS — just write the property name
    transform:     "rotate(-3deg)",
    filter:        "blur(4px)",
    clipPath:      "polygon(0 0, 100% 0, 100% 80%, 0 100%)",
    mixBlendMode:  "multiply",
    willChange:    "transform",
    animation:     "fadeIn 0.4s ease forwards",
    aspectRatio:   "16/9",
    gridColumn:    "1 / -1",
    userSelect:    "none",
    // Also works as responsive values
    transform:     { xs: "scale(0.9)", md: "scale(1)" },
  }
}
```

### cprop — Engine Custom Properties

`cprop` is strictly for engine-invented concepts (not raw CSS):

```ts
cprop: {
  onHover:     { background: "#1a1a2e", transform: "scale(1.02)" },
  onFocus:     { outline: "2px solid var(--e-accent)", outlineOffset: "3px" },
  onActive:    { transform: "scale(0.97)", opacity: 0.9 },
  onChecked:   { background: "var(--e-accent)" },
  onDisabled:  { opacity: 0.4, cursor: "not-allowed" },
}
```

All pseudo-states are compiled to CSS classes and injected via StyleCollector — no JS event handlers.

---

## Schema Validation

```ts
import { validatePageSchema, validateSchema } from "@/engine";

// In your page or CI:
const result = validatePageSchema(mySchema);
// → console.warn in dev for each issue
// → result.valid, result.errors[]

// Validate just a node tree:
const result = validateSchema(mySchema.root);
```

Each `ValidationError` has: `{ path: string, message: string, level: "error" | "warn" }`.

---

## Static Schema Analyzer

`schemaAnalyzer` is a build-time / dev-time static analysis tool. Unlike `validateSchema` (which throws on hard errors at runtime), the analyzer collects all diagnostics in one pass and returns them as structured objects — suitable for CI pipelines, editor integrations, or dev-server overlays.

```ts
import { analyzeSchema, isSchemaValid } from "@/engine";

const result = analyzeSchema(MySchema);

console.log(result.formatted);
// [schema:root.children[2]] EngineError(E001): Unknown node type "txt".
//     hint: Did you mean "text"?
// [schema:root.children[5].props] EngineWarn(W001): Image node is missing an "alt" prop.
//     hint: Add alt="" for decorative images or a descriptive string for meaningful ones.

console.log(result.errors);   // number of error-severity diagnostics
console.log(result.warnings); // number of warn-severity diagnostics

// Guard before rendering:
if (!isSchemaValid(MySchema)) throw new Error("Schema has errors");
```

**Diagnostic codes:**

| Code | Severity | Description |
|------|----------|-------------|
| `E001` | error | Unknown node type. Includes "Did you mean X?" via Levenshtein distance. |
| `E002` | error | Missing required prop for a known node type (e.g. `src` on `image`). |
| `E003` | error | Duplicate `id` or `point` value — reports first-seen path. |
| `E004` | error | Circular reference — same object instance appears twice in the tree. |
| `W001` | warn | `image` / `img` node has no `alt` prop (accessibility). |
| `W002` | warn | `button` / `link` has neither `label` nor children (accessibility). |
| `W003` | warn | `checkbox` / `input` has no `id` — cannot be associated with a `<label>`. |
| `W004` | warn | Node has >100 direct children (performance). |
| `W005` | warn | Tree nesting exceeds 15 levels (performance). |
| `W006` | warn | Leaf node (`text`, `image`, `button`, etc.) has children declared — they are silently ignored. |

**`EngineDiagnostic` shape:**

```ts
interface EngineDiagnostic {
  severity: "error" | "warn" | "info";
  code:     string;   // "E001", "W003", etc.
  message:  string;
  path:     string;   // e.g. "root.children[2].children[0]"
  hint?:    string;   // optional fix suggestion
}
```

---

## `staticClass` — Deduplicated CSS Classes

`staticClass` converts a `CSSProperties` object into a single CSS class that is injected once into `StyleCollector`. Identical property sets across any number of nodes share the same class name.

```ts
import { staticClass } from "@/engine";

// Inside your own custom components:
const layoutClass = staticClass({
  width:     "100%",
  maxWidth:  "1200px",
  marginLeft:  "auto",
  marginRight: "auto",
});
// → "e-s-a1b2c3"  (injected as .e-s-a1b2c3{width:100%;max-width:1200px;...})
// If another component calls staticClass with the same props, the same class
// name is returned and no duplicate CSS rule is emitted.
```

Used internally by `EngineSection` (inner content wrapper) and `EngineCard` (cover + content wrappers) to eliminate repeated inline styles across multiple instances of the same component.

---

## Style At-Rules

Engine style objects can include nested CSS at-rules. React inline styles cannot contain `@media` or other at-rules, so the engine compiles those entries through `StyleCollector`.

```ts
{
	type: "box",
	props: {
		style: {
			display: "none",
			"@media(min-width: 768px)": {
				display: "grid",
				gridTemplateColumns: "repeat(3, 1fr)",
			},
			"@supports(backdrop-filter: blur(8px))": {
				backdropFilter: "blur(8px)",
			},
		},
	},
}
```

For schema `style`, at-rule-controlled properties are emitted as CSS custom properties on `:root`, then referenced from the element's inline style. This lets media/support/container rules change the value without passing illegal keys to React.

`staticClass()` also accepts nested at-rules:

```ts
const desktopOnly = staticClass({
	display: "none",
	"@media(min-width: 768px)": {
		display: "flex",
	},
});
```

Separate extracted CSS files are still a future build-time optimization. The current runtime collector is kept because it deduplicates CSS per rendered schema and avoids shipping unused style rules.

---

## Metadata Integration (SEO)

```ts
// app/some-page/page.tsx
import type { Metadata } from "next";
import { generateEngineMetadata } from "@/engine";
import { myPageSchema } from "./schema";

export async function generateMetadata(): Promise<Metadata> {
  return generateEngineMetadata(myPageSchema);
  // or just the meta: generateEngineMetadata({ title: "…", ogImage: "…" })
}

export default createPage(myPageSchema);
```

Generates `title`, `description`, `keywords`, `canonical`, `robots`, `openGraph`, and `twitter` from `PageMeta`.

---

## Why RAF Scroll is Better Than CSS scroll-behavior

EngineScroll uses `requestAnimationFrame` + easing functions, not `scroll-behavior: smooth`. Here is why:

| | `scroll-behavior: smooth` | EngineScroll RAF |
|---|---|---|
| Duration control | ❌ browser decides | ✅ configurable ms |
| Easing curve | ❌ browser decides | ✅ ease-in-out / spring / linear / etc. |
| Safari compatibility | ⚠️ bugs on `<body>` | ✅ works everywhere |
| `prefers-reduced-motion` | ✅ browser handles | ✅ instant jump |
| Interrupt on new scroll | ❌ fights native | ✅ RAF cancels cleanly |
| Chromium changes | ⚠️ behavior changes per version | ✅ RAF is a W3C primitive, unchanged since 2012 |

**The "Chromium inshittification" concern:** `requestAnimationFrame` is the most stable browser API that exists. It is unaffected by any Chromium rendering changes. The concern only applies to CSS-level scroll APIs, which we deliberately avoid.
