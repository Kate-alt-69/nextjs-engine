# Next.js Engine — Developer Reference

> Core concepts, schema system, PROP vs CPROP, createPage API.
> For component-specific APIs see `engine-components/`.

---

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
│   ├── validateSchema.ts        Runtime schema validation (lightweight, throws on hard errors)
│   ├── EngineDevice.ts          Server + client device detection (Apple, Samsung, Xiaomi, etc.)
│   └── EngineMobilePatcher.ts   Mobile schema patching — applies MobileSchemaConfig to PageSchema
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
│   ├── EngineManim/
│   │   ├── index.ts              Barrel exports
│   │   ├── manimTypes.ts         All 2D + 3D types
│   │   ├── manimCompiler.ts      Shape vectorizer + Float32Array pools
│   │   ├── manimDSLParser.ts     frame() / constraint DSL parser
│   │   ├── manimAnimationRouter.ts  Tier 2.5 animation routing
│   │   ├── EngineManim.tsx       2D component (uses EngineCanvas)
│   │   └── EngineManim3D.tsx     3D component (Three.js GLTF/OBJ)
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

---

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

---

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
