# EngineScroll Timeline

EngineScroll timelines are part of the core EngineScroll runtime. They do not
create a second scroll listener or requestAnimationFrame loop. Timeline
subscribers, crossings, activity events, tracks, and style bindings are driven
by the same coalesced runtime updates that already power point navigation,
viewport state, physics, snapping, and programmatic movement.

## Create a timeline

```ts
import { EngineScroll } from "@/engine";

const timeline = EngineScroll.timeline({
	start: "#hero",
	end: "#features",
	source: "current",
});

const stop = timeline.subscribe((frame) => {
	console.log(frame.progress);
	console.log(frame.rawProgress);
	console.log(frame.direction);
	console.log(frame.velocity);
});
```

## Crossing events

Use `onCross()` for one-shot orchestration at a normalized position. Crossings
use raw timeline progress, so they fire in both directions even when the
timeline has easing:

```ts
const stopHalfway = timeline.onCross(0.5, (event) => {
	if (event.direction > 0) {
		console.log("crossed halfway going forward");
	} else {
		console.log("crossed halfway going backward");
	}
});
```

`onEnter()` and `onLeave()` expose active-range transitions:

```ts
const stopEnter = timeline.onEnter((event) => {
	console.log(event.boundary); // "start" or "end"
	console.log(event.direction);
});

const stopLeave = timeline.onLeave((event) => {
	console.log(event.boundary);
});
```

The timeline owns only one subscription to `EngineScrollRuntime`, regardless of
how many normal subscribers, crossing callbacks, and activity callbacks it has.
When the last listener is removed, that runtime subscription is released.

Calling `snapshot()` manually does not consume or suppress later crossing
events. Event detection keeps a separate runtime-observed frame baseline.

## Frame state

```ts
interface EngineScrollTimelineFrame {
	point: number;
	startPoint: number | null;
	endPoint: number | null;
	rawProgress: number;
	progress: number;
	before: boolean;
	active: boolean;
	after: boolean;
	direction: -1 | 0 | 1;
	velocity: number;
}
```

`progress` is clamped to `0..1`. `rawProgress` remains unbounded so
orchestration code can tell how far before or after the range the viewport is.

## Alignment and offsets

```ts
const timeline = EngineScroll.timeline({
	start: "#hero",
	end: "#features",
	startAlign: "center",
	endAlign: "end",
	startOffset: -4,
	endOffset: 8,
});
```

## Segments and tracks

```ts
const fadeProgress = timeline.segment(0, 0.25);
const parallaxProgress = timeline.segment(0.15, 0.8, "easeOutCubic");

const parallaxY = timeline.track([
	{ at: 0, value: 80, easing: "easeOutCubic" },
	{ at: 0.5, value: 0 },
	{ at: 1, value: -40 },
]);
```

Tracks do not own listeners or RAF loops; `value()` reads parent timeline
progress.

## Direct DOM/CSS bindings

```ts
const stopBinding = timeline.bindStyles(element, {
	opacity: [0, 1],
	"--hero-y": {
		from: 80,
		to: 0,
		unit: "px",
		easing: "easeOutCubic",
	},
});
```

Bindings skip DOM writes when the formatted value has not changed, avoiding a
React render for high-frequency scroll visuals.

## Scrubbing / seeking

```ts
timeline.seek(0.5);

timeline.seek(1, {
	duration: 350,
	easing: "easeOutCubic",
});
```

## React

```tsx
import { useEngineScrollTimeline } from "@/engine";

function HeroProgress() {
	const timeline = useEngineScrollTimeline({
		start: "#hero",
		end: "#features",
		source: "current",
	});

	return <progress max={1} value={timeline.progress} />;
}
```

The hook uses `useSyncExternalStore` and does not attach browser listeners
itself. For animation-heavy DOM work, prefer `bindStyles()`.

## Performance model

```text
native scroll/resize/input
        ↓
BrowserScheduler (single RAF)
        ↓
EngineScroll runtime update
        ↓
viewport / physics / animation
        ↓
runtime.notify()
        ↓
timelines / snapping / bindings / crossings
```

No standalone ScrollTimeline schema type is required; timelines are
orchestration inside EngineScroll.
