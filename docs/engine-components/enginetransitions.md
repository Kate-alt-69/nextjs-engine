# EngineTransitions+

EngineTransitions+ is the Engine's navigation and layout transition runtime. It uses the browser View Transitions API when available, falls back to normal Next.js navigation when it is not available, and disables motion automatically for `prefers-reduced-motion` users.

The normal path is intentionally tiny: if a link has no transition, EngineNav and EngineLink stay on `next/link` and do not load the transition runtime.

## Quick use

Use a short preset name in `cprop.link.transition`:

```ts
{
	type: "link",
	props: {
		href: "/products",
		content: "Products",
		cprop: {
			link: {
				transition: "pixel",
			},
		},
	},
}
```

For custom values, use an object:

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

## The 20 presets

| Name | What it does | Useful settings |
|---|---|---|
| `fade` | Cross-fades old and new content | `duration`, `easing` |
| `slide` | Moves the old page out and the new page in | `direction`, `distance` |
| `zoom` | Shrinks/grows between pages | `scale`, `origin` |
| `morph` | Keeps named elements visually connected while the page changes | `shared`, `duration` |
| `layout` | Keeps the root quiet and animates shared element layout changes | `shared`, `duration` |
| `reveal` | Opens the new page from a point using a circular mask | `origin`, `duration` |
| `wipe` | Sweeps the new page in from one side | `direction` |
| `split` | Opens the new page outward from the middle | `axis` |
| `curtain` | Closes and opens the frame like curtains | `axis` |
| `pixel` | Uses stepped, blocky captured-frame motion | `pixelSize`, `duration` |
| `dissolve` | Blurs and dissolves one frame into the next | `blur`, `strength` |
| `liquid` | Bends and stretches the frame like liquid | `rotation`, `blur`, `strength` |
| `smear` | Stretches motion in the travel direction | `direction`, `distance`, `blur` |
| `depth` | Pushes the old frame backward and brings the new frame forward | `depth`, `perspective`, `blur` |
| `flip` | Flips the frame around X or Y | `axis`, `direction`, `perspective` |
| `page-turn` | Turns the old/new frame like a page | `axis`, `direction`, `perspective` |
| `spring` | Pops the new frame in with overshoot | `duration`, `easing` |
| `scatter` | Jitters/spreads the old frame and assembles the new one | `spread`, `blur`, `strength` |
| `rgb` | Splits red/blue edges during the swap | `offset`, `strength` |
| `portal` | Collapses into a point and expands the new page from it | `origin`, `rotation`, `blur` |

Legacy names continue to work: `page-to-page`, `scale`, `shared-morph`, `flip-layout`, `reveal-mask`, `pixel-dissolve`, `noise-dissolve`, `liquid-warp`, `motion-smear`, `depth-push`, `card-flip`, `elastic-spring`, `scatter-assemble`, and `chromatic-shift`.

`instant` skips animation and uses normal navigation.

## Common settings

```ts
transition: {
	type: "slide",
	duration: 420,
	easing: "ease-out",
	direction: "right",
	strength: 1,
	origin: "center",
	config: {
		distance: 96,
		blur: 8,
	},
}
```

`duration` is milliseconds and is clamped to `0–5000`. `direction` accepts `left`, `right`, `up`, or `down`. `origin` accepts `center`, `pointer`, or a CSS origin such as `20% 70%`.

## Shared morphs and layout movement

Shared elements use normal DOM ids, so no extra component wrapper is needed. Give the matching source and destination the same `id`, then list that id in `shared`:

```ts
transition: {
	type: "morph",
	shared: "product-cover",
}
```

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

Destination page uses the same `id`. EngineTransitions temporarily assigns a safe `view-transition-name` before both snapshots, then restores the original inline style after the transition.

Multiple elements are supported:

```ts
transition: {
	type: "layout",
	shared: ["product-cover", "product-title", "buy-button"],
}
```

## Programmatic transitions

```tsx
"use client";

import { useEngineTransitions } from "nextjs-engine";

export function Example() {
	const transitions = useEngineTransitions();

	return (
		<button
			onClick={() => transitions.run(() => {
				setCompact((value) => !value);
			}, {
				type: "layout",
				shared: ["card-a", "card-b"],
			})}
		>
			Change layout
		</button>
	);
}
```

Programmatic navigation is also available through `transitions.push()` and `transitions.replace()`.

## Runtime behavior

- normal internal links stay on `next/link`;
- the transition link/runtime is lazy-loaded only when an animated link is rendered;
- external URLs and non-HTTP schemes stay native anchors;
- Ctrl/Cmd/Shift/Alt-click and non-left clicks keep normal browser behavior;
- hash-only navigation is not hijacked;
- unsupported browsers fall back to normal navigation;
- reduced-motion users get effectively instant transitions;
- starting a new transition skips the previous one instead of queueing a pile of animations.

The current presets operate on native View Transition snapshots. Shader-backed passes can later replace individual visual presets — for example a true fragment-shader pixel/noise dissolve — without changing the public transition names or config shape.
