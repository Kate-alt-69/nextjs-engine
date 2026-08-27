# EngineNav

Schema types: `"nav"` and `"EngineNav"`.

EngineNav renders the navigation shell, logo, items, dropdowns, and mobile
hamburger. It also owns `renderEngineAnchor()`, the routing helper shared with
EngineLink.

## Routing behavior

Navigation uses three paths:

1. external URLs / `_blank` / non-HTTP URI schemes such as `mailto:` → native `<a>`;
2. `cprop.link.transition = "page-to-page"` → lazily loaded `next-view-transitions` link;
3. normal internal URLs → `next/link`.

The default internal path stays inside the Next.js client router and gets normal
client-side navigation/prefetch behavior. It does **not** require a
`<ViewTransitions>` provider.

`next-view-transitions` is loaded only when a `page-to-page` link is actually
rendered. While that optional module is loading, the link falls back to the same
`next/link` behavior instead of suspending the whole navigation tree.

This means ordinary EngineLink/EngineNav usage no longer pays the transition
runtime cost merely because animated navigation is supported by the package.

## Props

| Prop | Default | Description |
|---|---|---|
| `variant` | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"minimal"` |
| `sticky` | `false` | Sticky positioning plus configured backdrop blur |
| `logo` | — | `{ src, href, alt, width, height }` |
| `items` | `[]` | `EngineNavItem[]` |
| `mobileBreakpoint` | `768` | px threshold used by generated desktop/mobile media rules |
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

## Runtime style behavior

Nav structural classes are generated during the initial render rather than being
created only after a menu opens. Interactive state does not depend on a new
post-hydration StyleCollector flush:

- dropdown structure has one stable class; open/closed display is controlled by
  the element's current inline display value;
- the mobile-menu class is generated even while the menu is closed, then reused
  when the menu mounts;
- mobile toggle/menu classes include a desktop media rule, so the hamburger and
  open mobile menu disappear at `mobileBreakpoint` and above;
- stable structural class calculations are memoized so toggling a menu does not
  rebuild every static Nav CSS block.

This is important while generated styles still use the engine's render-collected
stylesheet rather than a general-purpose client-side runtime CSS injector.

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
