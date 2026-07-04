# Engine Primitives

> Box, Stack, Grid, Text, Heading, Card, Spacer, Divider, Link, Section, Slot.
> These are the foundational schema node types available in every page.

---

## Shared Base Props

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

## `vars` — CSS Custom Properties

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

---

## `sides` — Per-Side Spacing

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

## box

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

---

## stack

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

---

## grid

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

---

## text

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

---

## heading

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

---

## section

### section

Page section with a centered max-width content column.

| Prop | Type | Default |
|------|------|---------|
| `contentMaxWidth` | `ResponsiveValue<string\|number>` | `"1200px"` |
| `centered` | `boolean` | `true` |
| `fullViewport` | `boolean` | `false` (sets `min-height: 100svh`) |
| `snapAlign` | `"start" \| "center" \| "end"` | — |

---

## card

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

---

## spacer / divider

### spacer

Inserts whitespace. `axis: "y"` (default) or `axis: "x"`.

### divider

A `<hr>` with configurable orientation, color, thickness, and style.

---

## divider

### divider

A `<hr>` with configurable orientation, color, thickness, and style.

---

## slot

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

---

## link

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

---

## button

Renders a `<button>` or `<a>` depending on whether `href` is set.
Use `type: "link"` for navigation — `"button"` is for actions.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Button text content |
| `variant` | `"solid" \| "outline" \| "ghost" \| "elevated" \| "link"` | `"solid"` | Visual style |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl"` | `"md"` | Size preset |
| `accentColor` | `string` | `var(--e-accent)` | Override the accent colour for this button only |
| `icon` | `string` | — | Icon string (emoji or icon font class) |
| `iconPosition` | `"left" \| "right"` | `"left"` | Icon placement relative to label |
| `disabled` | `boolean` | `false` | Disables the button |
| `loading` | `boolean` | `false` | Shows a spinner and disables the button |
| `fullWidth` | `ResponsiveValue<boolean>` | `false` | Stretches to full container width |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | HTML button type — set `"submit"` inside forms |
| `href` | `string` | — | When set, renders as `<a>` instead of `<button>` |
| `onClick` | `string` | — | Handler name from `createPage({ handlers })` |

**Variant styles:**

| Variant | Look |
|---------|------|
| `solid` | Filled with accent colour |
| `outline` | Transparent with accent border |
| `ghost` | Transparent, no border |
| `elevated` | Solid with drop shadow glow |
| `link` | Underlined text, no padding |

```ts
// Action button
{ type: "button", props: { label: "Save", variant: "solid", size: "md", onClick: "handleSave" } }

// Submit button inside a form
{ type: "button", props: { label: "Sign in", variant: "solid", type: "submit", fullWidth: true } }

// Link button
{ type: "button", props: { label: "View docs", variant: "outline", href: "/docs", size: "lg" } }
```

---

## custom-select

A fully custom dropdown select — keyboard navigable, searchable, clearable.
Replaces native `<select>` where React 19 rejects `<div>` children.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | **required** | Field name — used for `data-engine-bind` and form submission |
| `label` | `string` | — | Visible label rendered above the dropdown |
| `options` | `SelectOption[]` | **required** | Array of `{ value, label, disabled? }` objects |
| `placeholder` | `string` | — | Text shown when no option is selected |
| `defaultValue` | `string` | — | Initially selected value |
| `searchable` | `boolean` | `false` | Adds a search input inside the dropdown |
| `clearable` | `boolean` | `false` | Shows a clear (×) button to deselect |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Size preset |
| `onChange` | `string` | — | Handler name called with the selected value |

```ts
{
  type: "custom-select",
  props: {
    name:        "plan",
    label:       "Pricing plan",
    placeholder: "Choose a plan...",
    searchable:  true,
    clearable:   true,
    size:        "md",
    onChange:    "handlePlanChange",
    options: [
      { value: "free",    label: "Free"             },
      { value: "pro",     label: "Pro — $9/mo"      },
      { value: "team",    label: "Team — $29/mo"    },
      { value: "legacy",  label: "Legacy", disabled: true },
    ],
  },
}
```

---

## option / optgroup

Native `<option>` and `<optgroup>` for use inside `as="select"` on a `box`.
These are necessary because React 19 rejects unknown children inside `<select>`.

```ts
// A native select using box + option
{
  type: "box",
  props: { as: "select", name: "country", style: { padding: ".5rem" } },
  children: [
    { type: "option", props: { value: "",   label: "Choose a country", disabled: true } },
    { type: "option", props: { value: "us", label: "United States" } },
    { type: "option", props: { value: "gb", label: "United Kingdom" } },
    { type: "option", props: { value: "au", label: "Australia" } },
  ],
}

// Grouped options using optgroup
{
  type: "box",
  props: { as: "select", name: "city" },
  children: [
    {
      type: "optgroup",
      props: { label: "United States" },
      children: [
        { type: "option", props: { value: "nyc", label: "New York" } },
        { type: "option", props: { value: "la",  label: "Los Angeles" } },
      ],
    },
    {
      type: "optgroup",
      props: { label: "United Kingdom" },
      children: [
        { type: "option", props: { value: "ldn", label: "London" } },
        { type: "option", props: { value: "mcr", label: "Manchester" } },
      ],
    },
  ],
}
```

**`option` props:** `value` (string), `label` (string — the visible text),
`disabled` (boolean), `selected` (boolean).

**`optgroup` props:** `label` (string — the group heading), `disabled` (boolean).

Prefer `custom-select` over native `box as="select"` when you need search,
clear, or consistent cross-browser styling.

---

## raw

Escape hatch — renders an arbitrary React component directly inside the schema
tree. Use when a component can't be expressed as schema nodes and registering
it via `registerComponent` isn't appropriate (e.g. a third-party widget).

```ts
import { RawComponentRenderer } from "@/engine";

// Register once at module level
import MyThirdPartyChart from "some-chart-library";

{
  type: "raw",
  props: {
    component: MyThirdPartyChart,
    // All other props are forwarded to the component
    data:    [...],
    width:   "100%",
    height:  400,
    theme:   "dark",
  },
}
```

`raw` bypasses the registry lookup entirely — `component` must be a valid
React component. For reusable custom nodes, use `registerComponent` instead
so your component is addressable by type string everywhere in the schema.
