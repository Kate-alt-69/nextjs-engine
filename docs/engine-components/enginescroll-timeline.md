# EngineScroll Timeline

EngineScroll timelines are part of the core EngineScroll runtime. They do not create a second scroll listener or requestAnimationFrame loop. Timeline subscribers are driven by the same coalesced runtime updates that already power point navigation, viewport state, physics, and programmatic movement.

## Create a timeline

```ts
import { EngineScroll } from "@/engine";

const timeline = EngineScroll.timeline({
	start: "#hero",
	end: "#features",
	source: "current",
});

const stop = timeline.subscribe((frame) => {
	console.log(frame.progress); // 0..1
	console.log(frame.rawProgress); // may be below 0 or above 1
	console.log(frame.direction);
	console.log(frame.velocity);
});
```

Named timeline boundaries use registered EngineScroll points. Schema nodes with `point` already register themselves, so normal page schemas do not need manual DOM measurement code.

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

`progress` is clamped to `0..1`. `rawProgress` remains unbounded so orchestration code can tell how far before or after the range the viewport is.

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

Point alignment uses the same EngineScroll point coordinate system as navigation: `start`, `center`, `end`, or `nearest`.

## Interpolation

```ts
const opacity = timeline.value(0, 1);
const translateY = timeline.value(80, 0);
```

This keeps scroll-linked values deterministic without introducing another animation scheduler.

## Scrubbing / seeking

A timeline can also move EngineScroll to a normalized position inside its range:

```ts
timeline.seek(0.5);

timeline.seek(1, {
	duration: 350,
	easing: "easeOutCubic",
});
```

This makes sliders, scrubbers, chapter controls, and timeline UIs use the same movement runtime instead of manually translating percentages into browser pixels.

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

The hook uses `useSyncExternalStore` and subscribes to the EngineScroll runtime. It does not attach browser listeners itself.

## Automatic geometry invalidation

Registered points are observed through the point manager. Layout/viewport changes invalidate cached timeline boundaries. The timeline then resolves those boundaries again on the next EngineScroll update instead of calling `getBoundingClientRect()` on every scroll frame.

This is the intended performance model:

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
all active timelines
```

No standalone ScrollTimeline schema type is required; timelines are orchestration inside EngineScroll.
