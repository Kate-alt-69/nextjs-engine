# EngineNav

> Full navigation bar with sticky support, logo, items, dropdowns, mobile hamburger.
> Also owns `renderEngineAnchor` — the shared routing pipeline used by EngineLink.

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
