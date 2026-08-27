# EngineNav

Schema types: `"nav"` and `"EngineNav"`.

EngineNav renders the navigation shell, logo, items, dropdowns, and mobile hamburger. It also owns `renderEngineAnchor()`, the routing helper shared with EngineLink.

## Routing behavior

Navigation uses three paths:

1. external URLs / `_blank` / non-HTTP URI schemes such as `mailto:` → native `<a>`;
2. internal links with an EngineTransitions+ preset → lazily loaded `EngineTransitionLink`;
3. normal internal URLs → `next/link`.

Normal internal navigation stays inside the Next.js client router and keeps Next.js prefetch behavior. It does not load the transition runtime.

Animated links can use any of the 20 preset names:

```ts
{
	label: "Products",
	href: "/products",
	cprop: {
		link: {
			transition: "slide",
		},
	},
}
```

Or a configurable object:

```ts
{
	label: "Products",
	href: "/products",
	cprop: {
		link: {
			transition: {
				type: "portal",
				duration: 600,
				origin: "pointer",
				config: {
					blur: 6,
					rotation: 8,
				},
			},
		},
	},
}
```

`page-to-page` remains supported as a backwards-compatible alias for `fade`. `instant` uses normal `next/link` navigation.

See [`enginetransitions.md`](./enginetransitions.md) for all presets and settings.

## Props

| Prop | Default | Description |
|---|---|---|
| `variant` | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"minimal"` |
| `sticky` | `false` | Sticky positioning plus configured backdrop blur |
| `logo` | — | `{ src, href, alt, width, height }` |
| `items` | `[]` | `EngineNavItem[]` |
| `mobileBreakpoint` | `768` | px threshold used by generated desktop/mobile media rules |
| `children` | — | Extra content inserted inside the nav's inner row |

EngineNav also accepts shared engine styling props (`bg`, responsive spacing, color, transforms, etc.). Those props are consumed by `usePropStyles()` and become CSS; they are not forwarded as arbitrary attributes to `<nav>`.

```ts
interface EngineNavItem {
	label: string;
	href?: string;
	target?: string;
	cprop?: {
		link?: {
			href?: string;
			transition?: EngineTransitionInput;
		};
	};
	active?: boolean;
	children?: EngineNavItem[];
}
```

`active` is pathname-derived when omitted. A root `/` item is active only on `/`; other hrefs use prefix matching.

## Runtime style behavior

Nav structural classes are generated during the initial render rather than being created only after a menu opens:

- dropdown structure has one stable class; open/closed display is controlled by the element's current inline display value;
- the mobile-menu class is generated even while the menu is closed, then reused when the menu mounts;
- mobile toggle/menu classes include a desktop media rule, so the hamburger and open mobile menu disappear at `mobileBreakpoint` and above;
- stable structural class calculations are memoized so toggling a menu does not rebuild every static Nav CSS block.

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
