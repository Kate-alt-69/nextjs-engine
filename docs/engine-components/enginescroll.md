# EngineScroll — Point, Navigation, Timeline, and Scroll Orchestration

EngineScroll (ES) is the Engine's shared scroll runtime. It owns point-based
navigation, named DOM targets, smooth movement, scroll state, timelines,
scroll-driven CSS bindings, and optional point snapping.

`createPage()` installs `EngineScrollProvider` automatically. The core runtime
uses one coalesced RAF scheduler for browser measurements and programmatic
movement. Timelines, snapping, and bindings subscribe to that existing runtime;
they do not create another scroll listener or permanent RAF loop.

## Basic navigation

```ts
import { EngineScroll } from "@/engine";

EngineScroll.move("#hero");
EngineScroll.move("#pricing", {
	align: "center",
	duration: 420,
	easing: "easeOutCubic",
});
EngineScroll.move(120.5);
EngineScroll.move("current", 5);
EngineScroll.top();
EngineScroll.bottom();
```

Legacy positional arguments remain supported:

```ts
EngineScroll.move("#pricing", 2, 400);
```

Movement options are:

```ts
{
	offset?: number;
	duration?: number;
	easing?: "linear" | "easeInQuad" | "easeOutQuad" |
		"easeInOutQuad" | "easeInCubic" | "easeOutCubic" |
		"easeInOutCubic";
	align?: "start" | "center" | "end" | "nearest";
	interruptible?: boolean;
	respectReducedMotion?: boolean;
}
```

Smooth movement defaults to about `550ms`. Unless
`respectReducedMotion: false` is set, reduced-motion users receive immediate
movement.

Wheel, touch, and page-scroll keyboard intent interrupts an interruptible ES
animation. Key presses inside inputs, textareas, selects, or editable content do
not cancel scroll movement just because they use arrow/space keys.

## Coordinate model

ES points are logical scroll units. The default spacing is seven pixels per
point.

Movement coordinates always describe the **top scroll edge**. The runtime also
publishes:

```ts
EngineScroll.viewport().top
EngineScroll.viewport().current
EngineScroll.viewport().bottom
```

`viewport.current` is observational and normally represents the center of the
viewport. `page.totalPoints` is the maximum reachable top edge:

```text
(documentHeight - viewportHeight) / pointSpacing
```

## Named points

Any schema node can declare a point:

```ts
{
	type: "section",
	props: {
		point: "pricing",
	},
}
```

The schema renderer registers the mounted element with the canonical
`EngineScrollPointManager`. `id` and `point` may intentionally differ:

```ts
{
	type: "section",
	props: {
		id: "pricing-section",
		point: "pricing",
	},
}
```

Manual registration is available when needed:

```ts
EngineScroll.points().registerElement("pricing", element, {
	align: "start",
	offset: -8,
});
```

The point registry supports:

```ts
EngineScroll.points().get("pricing");
EngineScroll.points().resolve("pricing", { align: "center" });
EngineScroll.points().distance("pricing");
EngineScroll.points().nearest();
EngineScroll.points().next();
EngineScroll.points().previous();
EngineScroll.points().sorted();
EngineScroll.points().names();
```

`start`, `center`, `end`, and `nearest` alignment are calculated from the real
DOM element and current viewport size. Named navigation refreshes that target's
geometry immediately before movement.

The registry uses shared `ResizeObserver` invalidation and an ordered-point
cache. It does **not** measure and sort every registered DOM point on every
scroll frame. Layout invalidation marks geometry dirty; point ordering is
recalculated only when an operation actually needs it.

For `#name`, navigation first resolves the point registry and then falls back to
a literal DOM id. URL-encoded ids are decoded safely.

## Directional point navigation

```ts
EngineScroll.nearest({ duration: 220 });
EngineScroll.next({
	align: "center",
	duration: 280,
});
EngineScroll.previous({ wrap: true });
```

These methods operate on registered ES points, not arbitrary elements.

## Timelines

Scroll timelines live inside EngineScroll rather than being a separate schema
primitive.

```ts
const timeline = EngineScroll.timeline({
	start: "#hero",
	end: "#features",
	source: "current",
	easing: "linear",
});
```

A timeline frame contains:

```ts
{
	point,
	startPoint,
	endPoint,
	rawProgress,
	progress,
	before,
	active,
	after,
	direction,
	velocity,
}
```

`progress` is clamped to `0..1` and then passed through the timeline easing.
`rawProgress` remains unclamped, which is useful for determining whether the
viewport is before or after the range.

```ts
const stop = timeline.subscribe((frame) => {
	console.log(frame.progress);
});

stop();
timeline.dispose();
```

Timeline subscriptions reuse `EngineScrollRuntime.notify()`. They do not attach
another browser scroll event.

### Timeline source

Choose which viewport point drives progress:

```ts
source: "top"
source: "current"
source: "bottom"
```

Numeric, `top`, `bottom`, and named-point boundaries are supported:

```ts
EngineScroll.timeline({
	start: 10,
	end: "#footer",
	startOffset: 4,
	endOffset: -6,
	endAlign: "center",
});
```

Named boundaries are cached and only re-resolved when point geometry or the
page's reachable range changes.

### Segments

A timeline can expose a smaller normalized phase without creating another
runtime subscription:

```ts
const fade = timeline.segment(0, 0.25, "easeOutCubic");
const parallax = timeline.segment(0.15, 0.8);
const exit = timeline.segment(0.75, 1, "easeInCubic");
```

Each result is `0..1`.

### Numeric keyframe tracks

Compile reusable numeric keyframes once:

```ts
const parallaxY = timeline.track([
	{ at: 0, value: 80, easing: "easeOutCubic" },
	{ at: 0.5, value: 0, easing: "linear" },
	{ at: 1, value: -40 },
]);

const y = parallaxY.value();
```

The easing on a keyframe controls the segment **from that keyframe to the next
one**. Keyframes are sorted automatically. Duplicate `at` positions use the
last declaration. Invalid non-finite keyframes fail with a clear ES error.

### Scrubbing / seeking

```ts
timeline.seek(0.5, {
	duration: 320,
	easing: "easeOutCubic",
});
```

`seek(0)` moves to the timeline start and `seek(1)` moves to its end.

## Direct CSS bindings

For animation-heavy pages, prefer direct style bindings instead of causing a
React component to render for every scroll frame.

```ts
const stop = timeline.bindStyles(element, {
	opacity: [0, 1],
	"--hero-y": {
		from: 80,
		to: 0,
		unit: "px",
		easing: "easeOutCubic",
	},
	"--hero-scale": {
		keyframes: [
			{ at: 0, value: 0.92 },
			{ at: 0.6, value: 1.02 },
			{ at: 1, value: 1 },
		],
		precision: 3,
	},
});
```

The element can consume CSS variables normally:

```css
.hero {
	transform: translateY(var(--hero-y)) scale(var(--hero-scale));
}
```

Bindings cache their previous serialized value and skip identical DOM writes.
A binding may also be a function:

```ts
timeline.bindStyles(element, {
	"--scroll-state": (frame) => frame.active ? "active" : "idle",
});
```

This path is useful for opacity, transforms, blur variables, parallax, masks,
and other compositor-friendly effects while keeping React out of the hot path.

## Point snapping

One-shot snap:

```ts
EngineScroll.snap({
	threshold: 10,
	duration: 240,
});
```

`threshold` is measured in ES points. If the closest target is farther away,
ES leaves the current position alone.

Automatic snap after the user stops scrolling is opt-in:

```ts
const disableSnap = EngineScroll.enableSnap({
	mode: "nearest",
	threshold: 12,
	duration: 260,
	easing: "easeOutCubic",
});

// later
disableSnap();
```

Directional mode remembers the user's last non-zero scroll direction and
selects the next/previous point:

```ts
EngineScroll.enableSnap({
	mode: "directional",
	threshold: 18,
	wrap: false,
});
```

Auto-snap does not add a scroll listener. It subscribes to the ES runtime and
runs only when ES observes a `user scrolling -> idle` transition.

## User scrolling and programmatic scrolling

ES distinguishes browser scroll events caused by its own animation from real
user input. Programmatic frames set a short internal guard around
`window.scrollTo()`, so timeline/snapping state does not incorrectly report
Engine movement as user scrolling.

Native user scrolling uses a small idle wake-up timer. The timer requests one
final ES frame after scrolling stops so `isUserScrolling` can return to false;
it does not create a permanent animation loop.

The first physics sample establishes a baseline before calculating velocity, so
pages restored at a non-zero scroll position do not report a fake startup
velocity spike.

## React timeline hook

When React state is actually desired:

```tsx
import { useEngineScrollTimeline } from "@/engine";

function Progress() {
	const frame = useEngineScrollTimeline({
		start: "#hero",
		end: "#footer",
	});

	return <progress value={frame.progress} max={1} />;
}
```

For visual effects that only need DOM styles, `timeline.bindStyles()` is
usually cheaper because it avoids React re-renders.

## URL protocol

EngineScroll commands use `#-es?` so normal browser hashes remain available:

```text
#-es?move=pricing
#-es?move=current&offset=10
#-es?move=footer&duration=600
#-es?move=120.5
#-es?move=top
```

```ts
import { EngineScrollURL } from "@/engine";

EngineScrollURL.has();
EngineScrollURL.execute();
const stopListening = EngineScrollURL.listen();
```

The command is removed from the address bar with `history.replaceState()` after
execution.

## RAF ownership

EngineScroll owns one `BrowserScheduler` RAF chain:

1. browser events request the scheduler;
2. browser dimensions and viewport points update;
3. velocity/direction are calculated;
4. programmatic scroll animation advances;
5. observer state updates;
6. runtime subscribers (timelines, optional snap controller, other consumers) are notified;
7. another RAF is requested only when there is pending work or an active ES animation.

Scroll timelines and auto-snap do not create competing RAF loops.

When the document becomes hidden, the active RAF is cancelled. Smooth movement
pauses its elapsed time and resumes without turning the hidden interval into one
giant frame delta.

## EngineMarkdown anchors

EngineMarkdown generates stable heading ids. Compatibility flags can disable
EngineScroll point metadata without removing those HTML ids:

```ts
props: {
	disablepointformarkdownhash: true,
	disablepointformarkdownhashhash: true,
}
```

## Legacy schema `"scroll"`

The old schema `"scroll"` component remains for compatibility. It is separate
from the core ES runtime installed by `createPage()` and retains its existing
`ease`, native `smooth`, `snap`, `instant`, offset, and page-transition props.

New work should prefer the core `EngineScroll`, point, timeline, and snap APIs.
