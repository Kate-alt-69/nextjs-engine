# EngineNav

Schema types: `"nav"` and `"EngineNav"`.

EngineNav renders the navigation shell, logo, items, dropdowns, and mobile
hamburger. It also owns `renderEngineAnchor()`, the routing helper shared with
EngineLink.

## Routing behavior

Navigation uses three paths:

1. external URLs / `_blank` → normal `<a>` with `rel="noopener noreferrer"`;
2. `cprop.link.transition = "page-to-page"` → `next-view-transitions` link;
3. everything else → native `<a>`.

The default path intentionally remains a native anchor rather than forcing the
transition library onto every item.

## Props

| Prop | Default | Description |
|---|---|---|
| `variant` | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"minimal"` |
| `sticky` | `false` | Sticky positioning plus configured backdrop blur |
| `logo` | — | `{ src, href, alt, width, height }` |
| `items` | `[]` | `EngineNavItem[]` |
| `mobileBreakpoint` | `768` | px threshold used by the generated media rule |
| `children` | — | Extra content inserted inside the nav's inner row |

EngineNav also accepts shared engine styling props (`bg`, responsive spacing,
color, transforms, etc.). Those props are consumed by `usePropStyles()` and
become CSS; **they are not forwarded as arbitrary attributes to `<nav>`**. This
prevents schema shorthands or breakpoint objects from leaking into DOM markup.

```ts
interface EngineNavItem {
  label: string;
  href?: string;
  target?: string;
  cprop?: { link?: { transition?: string; href?: string } };
  active?: boolean;
  children?: EngineNavItem[];
}
```

`active` is pathname-derived when omitted. A root `/` item is active only on
`/`; other hrefs use prefix matching.

## CSS custom properties

| Variable | Default | Purpose |
|---|---|---|
| `--engine-nav-bg` | `transparent` | Nav background |
| `--engine-nav-border` | `rgba(255,255,255,0.08)` | Horizontal bottom border |
| `--engine-nav-color` | `inherit` | Item text color |
| `--engine-nav-active-color` | `var(--color-primary, #fff)` | Active item text |
| `--engine-nav-active-bg` | `rgba(255,255,255,0.1)` | Active item background |
| `--engine-nav-height` | `3.5rem` | Horizontal minimum height |
| `--engine-nav-px` | `1.5rem` | Horizontal padding |
| `--engine-nav-max-width` | `1200px` | Inner content maximum width |
| `--engine-nav-blur` | `blur(12px)` | Sticky backdrop filter |
| `--engine-nav-dropdown-bg` | `#1a1a1a` | Dropdown background |
| `--engine-nav-dropdown-border` | `rgba(255,255,255,0.1)` | Dropdown border |

## Example

```ts
{
  type: "nav",
  props: {
    sticky: true,
    bg: { xs: "#080b12", md: "rgba(8,11,18,.8)" },
    logo: { src: "/logo.svg", href: "/", alt: "Brand" },
    items: [
      { label: "Home", href: "/" },
      {
        label: "Docs",
        href: "/docs",
        cprop: { link: { transition: "page-to-page" } },
      },
      { label: "GitHub", href: "https://github.com/...", target: "_blank" },
      {
        label: "More",
        children: [{ label: "Blog", href: "/blog" }],
      },
    ],
  },
}
```

For the shared responsive/style rules used by EngineNav, see
[`../styling.md`](../styling.md).
