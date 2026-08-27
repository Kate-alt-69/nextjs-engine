# EngineTransitions+

EngineTransitions+ is Next.js Engine's page, navigation, and layout transition runtime.

It is built around the browser View Transitions API when that API exists. NE keeps a normal Next.js navigation path as the fallback, so a transition is an enhancement rather than a requirement for the page to work.

Normal internal links stay on `next/link`. The heavier transition runtime is loaded only when an animated link is actually rendered.

## Start here

The shortest way to use a transition is to put one preset name in `cprop.link.transition`.

```ts
{
	type: "link",
	props: {
		href: "/products",
		content: "Products",
		cprop: {
			link: {
				transition: "slide",
			},
		},
	},
}
```

That is enough. NE chooses the preset defaults, runs the View Transition when supported, and falls back to normal navigation when it is not.

For more control, use an object:

```ts
{
	type: "link",
	props: {
		href: "/products",
		content: "Products",
		cprop: {
			link: {
				transition: {
					type: "portal",
					duration: 620,
					direction: "right",
					strength: 1.1,
					origin: "pointer",
					config: {
						rotation: 8,
						blur: 5,
					},
				},
			},
		},
	},
}
```

## Where transitions can be used

### EngineLink / schema link

```ts
{
	type: "link",
	props: {
		href: "/about",
		content: "About",
		cprop: {
			link: {
				transition: "fade",
			},
		},
	},
}
```

### EngineNav item

```ts
{
	label: "Gallery",
	href: "/gallery",
	cprop: {
		link: {
			transition: "reveal",
		},
	},
}
```

### Direct JSX

```tsx
import { EngineTransitionLink } from "nextjs-engine";

export function GalleryLink() {
	return (
		<EngineTransitionLink
			href="/gallery"
			transition="wipe"
		>
			Open gallery
		</EngineTransitionLink>
	);
}
```

### Programmatic state/layout changes

```tsx
"use client";

import { useState } from "react";
import { useEngineTransitions } from "nextjs-engine";

export function CompactToggle() {
	const [compact, setCompact] = useState(false);
	const transitions = useEngineTransitions();

	return (
		<button
			onClick={() => transitions.run(() => {
				setCompact((value) => !value);
			}, "layout")}
		>
			{compact ? "Large layout" : "Compact layout"}
		</button>
	);
}
```

`run()` is useful when the URL does not change but the UI does.

### Programmatic navigation

```tsx
"use client";

import { useEngineTransitions } from "nextjs-engine";

export function OpenProductButton() {
	const transitions = useEngineTransitions();

	return (
		<button
			onClick={() => transitions.push("/product/42", {
				type: "depth",
				direction: "right",
			})}
		>
			Open product
		</button>
	);
}
```

`useEngineTransitions()` returns:

```ts
interface EngineTransitionsController {
	run(
		update: () => void | Promise<void>,
		transition?: EngineTransitionInput,
	): Promise<void>;

	push(
		href: string,
		transition?: EngineTransitionInput,
		context?: EngineTransitionRunContext,
	): Promise<void>;

	replace(
		href: string,
		transition?: EngineTransitionInput,
		context?: EngineTransitionRunContext,
	): Promise<void>;
}
```

Defaults are `layout` for `run()` and `fade` for `push()` / `replace()`.

---

## The 20 transition presets

The names are intentionally short and easy to remember.

| Name | Default | What it looks like | Best settings to change |
|---|---:|---|---|
| `fade` | 320 ms | Old content fades away while new content appears | `duration`, `easing` |
| `slide` | 420 ms | Old and new frames move in opposite directions | `direction`, `distance` |
| `zoom` | 380 ms | The frame shrinks/grows around an origin | `scale`, `origin` |
| `morph` | 480 ms | Root stays soft while named elements morph between layouts/pages | `shared`, `duration` |
| `layout` | 420 ms | Keeps the root almost still and lets shared elements move | `shared`, `duration` |
| `reveal` | 520 ms | New page opens from a circular reveal point | `origin`, `duration` |
| `wipe` | 460 ms | New page is uncovered from one side | `direction` |
| `split` | 520 ms | New page opens outward from the middle | `axis` |
| `curtain` | 560 ms | Old/new frame closes and opens like curtains | `axis` |
| `pixel` | 500 ms | Uses stepped timing and a blocky captured-frame feel | `pixelSize`, `duration` |
| `dissolve` | 520 ms | Blurred dissolve between snapshots | `blur`, `strength` |
| `liquid` | 620 ms | Skewed/stretching liquid-like swap | `rotation`, `blur`, `strength` |
| `smear` | 440 ms | Stretches the moving frame in its travel direction | `direction`, `distance`, `blur` |
| `depth` | 520 ms | Old frame moves backward in depth while new frame comes forward | `depth`, `perspective`, `blur` |
| `flip` | 560 ms | Flips the frame around the X or Y axis | `axis`, `direction`, `perspective` |
| `page-turn` | 680 ms | Rotates the snapshot like turning a page | `axis`, `direction`, `perspective` |
| `spring` | 620 ms | New frame pops in, overshoots, and settles | `duration`, `easing` |
| `scatter` | 560 ms | Old frame spreads/jitters away while the new frame assembles | `spread`, `blur`, `strength` |
| `rgb` | 420 ms | Creates a quick red/blue channel separation effect | `offset`, `strength` |
| `portal` | 620 ms | Old frame collapses toward a point; new frame expands from it | `origin`, `rotation`, `blur` |

`instant` is also accepted. It skips the animation and uses normal navigation/update behavior.

## Compatibility aliases

Old or longer names continue to work.

| Alias | Current name |
|---|---|
| `page-to-page` | `fade` |
| `scale` | `zoom` |
| `shared-morph` | `morph` |
| `flip-layout` | `layout` |
| `reveal-mask` | `reveal` |
| `pixel-dissolve` | `pixel` |
| `noise-dissolve` | `dissolve` |
| `liquid-warp` | `liquid` |
| `motion-smear` | `smear` |
| `depth-push` | `depth` |
| `card-flip` | `flip` |
| `elastic-spring` | `spring` |
| `scatter-assemble` | `scatter` |
| `chromatic-shift` | `rgb` |

Unknown names fall back to `fade`. Development builds also print a warning.

---

## Common transition object

```ts
transition: {
	type: "slide",
	duration: 420,
	easing: "ease-out",
	direction: "right",
	strength: 1,
	origin: "center",
	shared: ["hero-image"],
	config: {
		distance: 96,
		blur: 8,
	},
}
```

### Top-level settings

| Setting | Type | Meaning |
|---|---|---|
| `type` | transition name | Which preset to use |
| `duration` | number | Milliseconds. Clamped to `0..5000` |
| `easing` | string | CSS/Web Animations easing. `spring` is also accepted |
| `direction` | `left` / `right` / `up` / `down` | Main travel direction |
| `strength` | number | General effect multiplier. Clamped internally where needed |
| `origin` | `center` / `pointer` / CSS origin | Origin for reveal/zoom/portal-like effects |
| `shared` | string or string[] | DOM ids that should receive temporary shared view-transition names |
| `config` | object | Preset-specific settings |

`origin: "pointer"` uses the click location automatically for `EngineTransitionLink`.

For a programmatic navigation, provide the pointer yourself when you want pointer-origin behavior:

```ts
await transitions.push(
	"/details",
	{
		type: "portal",
		origin: "pointer",
	},
	{
		pointer: {
			x: 420,
			y: 280,
		},
	},
);
```

---

## Config fields that are active today

The public `EngineTransitionConfig` type intentionally contains some reserved future knobs. The current renderer actively reads these fields:

| Field | Used by | Meaning |
|---|---|---|
| `distance` | slide, smear | Travel distance in px |
| `blur` | dissolve, liquid, smear, depth, scatter, portal | Blur amount before the preset multiplies/clamps it |
| `scale` | zoom | Starting/ending scale |
| `rotation` | liquid, portal | Rotation/skew strength in degrees |
| `axis` | split, curtain, flip, page-turn | `x` or `y` |
| `depth` | depth | Z travel distance |
| `perspective` | depth, flip, page-turn | CSS perspective distance |
| `pixelSize` | pixel | Controls stepped timing density |
| `spread` | scatter | Scatter travel amount |
| `offset` | rgb | RGB channel separation offset |

Other fields currently present on `EngineTransitionConfig` are reserved for richer future implementations. Do not rely on a reserved field producing a visible change until it is listed in this table.

---

## Shared morphs

Shared morphs use normal DOM ids. No extra transition wrapper is required.

Source page:

```ts
{
	type: "image",
	props: {
		id: "product-cover",
		src: "/gpu-card.png",
		alt: "GPU",
	},
}
```

Destination page:

```ts
{
	type: "image",
	props: {
		id: "product-cover",
		src: "/gpu-large.png",
		alt: "GPU",
	},
}
```

Link:

```ts
{
	type: "link",
	props: {
		href: "/product/gpu",
		content: "View GPU",
		cprop: {
			link: {
				transition: {
					type: "morph",
					shared: "product-cover",
				},
			},
		},
	},
}
```

During the transition NE temporarily gives that id a sanitized `view-transition-name`, captures both snapshots, then restores the previous inline value.

Multiple elements work too:

```ts
transition: {
	type: "layout",
	shared: [
		"product-cover",
		"product-title",
		"buy-button",
	],
}
```

A shared id must exist in the relevant old/new DOM when the browser captures that side of the transition. Missing ids are simply ignored.

---

## Recipes

### Simple page fade

```ts
transition: "fade"
```

### Slide left when opening a deeper page

```ts
transition: {
	type: "slide",
	direction: "right",
	config: {
		distance: 120,
	},
}
```

### Circular reveal from the clicked button

```ts
transition: {
	type: "reveal",
	origin: "pointer",
	duration: 520,
}
```

### Strong 3D push

```ts
transition: {
	type: "depth",
	config: {
		depth: 260,
		perspective: 1200,
		blur: 12,
	},
}
```

### Pixel-ish fast swap

```ts
transition: {
	type: "pixel",
	duration: 380,
	config: {
		pixelSize: 10,
	},
}
```

### Layout rearrangement without navigation

```tsx
await transitions.run(() => {
	setSortMode("price");
}, {
	type: "layout",
	shared: ["card-a", "card-b", "card-c"],
});
```

---

## Runtime behavior

EngineTransitions+ deliberately preserves normal browser/Next.js behavior where animation would be the wrong thing to intercept.

- ordinary internal links stay on `next/link`;
- the transition link/runtime is lazy-loaded only when an animated internal link is rendered;
- external URLs, `_blank`, `mailto:`, and other non-HTTP schemes use native anchors;
- Ctrl/Cmd/Shift/Alt-click and non-left clicks keep native browser behavior;
- hash-only navigation is not hijacked by the page-transition runtime;
- unsupported browsers perform the update/navigation without animation;
- `prefers-reduced-motion: reduce` users receive effectively instant transitions;
- a newly started transition skips the previous active transition instead of building a queue;
- shared-element inline `view-transition-name` values are restored after the transition;
- `duration` is clamped so accidental huge values cannot lock the page in a multi-minute animation.

## Browser fallback

The runtime checks `document.startViewTransition` at the moment the transition runs.

Conceptually:

```text
transition requested
	↓
reduced motion or instant?
	├─ yes → update/navigate normally
	└─ no
		↓
View Transitions API available?
	├─ no → update/navigate normally
	└─ yes → capture old/new snapshots + play NE preset
```

That means you do not need separate browser-specific transition code.

---

## Current implementation boundary

The 20 presets currently animate native View Transition snapshots using Web Animations/CSS-compatible transforms, clips, opacity, filters, and 3D transforms.

Names such as `pixel`, `dissolve`, and `liquid` are real distinct presets, but they are **not yet EngineShader framebuffer passes**. A future shader-backed transition renderer can replace selected visual implementations without changing the public preset names or the config shape.

This separation is intentional:

```text
EngineTransitions+
	= when/how state A becomes state B

EngineShader
	= how GPU-owned pixels are produced/processed
```

See [`engineshader.md`](./engineshader.md) for the current GPU surface system.

---

## Public exports

```ts
import {
	ENGINE_TRANSITIONS,
	EngineTransitionLink,
	isKnownEngineTransition,
	navigateWithEngineTransition,
	normalizeEngineTransitionType,
	resolveEngineTransition,
	runEngineTransition,
	useEngineTransitions,
} from "nextjs-engine";
```

Useful public types include:

```ts
EngineTransitionAlias
EngineTransitionAxis
EngineTransitionConfig
EngineTransitionDirection
EngineTransitionEasing
EngineTransitionInput
EngineTransitionName
EngineTransitionOptions
EngineTransitionPointer
EngineTransitionRunContext
EngineTransitionsController
ResolvedEngineTransition
```

`resolveEngineTransition()` is mostly useful for tooling, testing, editors, or custom integrations. Most app code should use a transition name/object directly.

---

## Troubleshooting

### Nothing animates

Check these first:

1. The link is internal, not an external URL.
2. The transition is not `instant`.
3. The browser supports the View Transitions API.
4. The OS/browser does not currently request reduced motion.
5. For shared morphs, the ids exist in the old/new page snapshots.

The page should still navigate even when animation is unavailable.

### A config field does nothing

Check the **Config fields that are active today** table above. Some typed fields are reserved for future richer implementations.

### Portal/reveal starts in the middle instead of the cursor

`origin: "pointer"` needs pointer coordinates. `EngineTransitionLink` supplies them automatically. Programmatic `push()` / `replace()` calls must pass `context.pointer` if they want the same behavior.

### A new click interrupts the old transition

That is expected. NE skips the active transition so the UI responds to the user's newest action instead of waiting for an animation queue to finish.
