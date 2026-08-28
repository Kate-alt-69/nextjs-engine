# EngineScroll Point Tracking

EngineScroll point tracking is the scroll-spy layer for named EngineScroll points. It identifies the active point for the current viewport position, exposes the previous/next point and local progress, and can notify only when the active named point changes.

It runs on the existing EngineScroll runtime subscription. It does not attach another browser scroll listener or requestAnimationFrame loop.

## Track the current chapter

```ts
import { EngineScroll } from "@/engine";

const chapters = EngineScroll.trackPoints({
	group: "chapters",
	source: "current",
});

const frame = chapters.snapshot();

console.log(frame.current?.name);
console.log(frame.previous?.name);
console.log(frame.next?.name);
console.log(frame.progress);
```

`progress` is local progress from the active point to the next point. For example, if `intro` is at point `10`, `features` is at point `30`, and the selected viewport source is at point `20`, progress is `0.5`.

Before the first point, `current` is `null`, `next` is the first point, `index` is `-1`, and progress is `0`. At the final point, progress is `1`.

## Source position

```ts
EngineScroll.trackPoints({
	group: "chapters",
	source: "top",
	offset: 4,
});
```

`source` can be `top`, `current`, or `bottom`, matching the EngineScroll viewport state. `offset` is in EngineScroll point units.

## Subscribe to progress

```ts
const stop = chapters.subscribe((frame) => {
	progressBar.style.setProperty("--chapter-progress", String(frame.progress));
});
```

Normal tracker subscribers receive updates only when the computed tracker frame changes.

## Subscribe only when the active point changes

For navigation highlighting, analytics, chapter labels, or URL state, use `onChange()` instead of reacting to every progress update:

```ts
const stop = chapters.onChange((frame, previousPoint) => {
	console.log("left", previousPoint?.name);
	console.log("entered", frame.current?.name);
});
```

This callback is driven by the same runtime subscription as normal tracker subscribers. A tracker owns at most one EngineScroll runtime subscription regardless of how many callbacks it has, and releases it when the final subscriber is removed.

Calling `snapshot()` manually does not consume a future `onChange()` event. Runtime-observed state is tracked separately from read caching.

## Direct point lookup

The lower-level point manager exposes the binary-search primitive used by trackers:

```ts
const location = EngineScroll.points().locate(
	EngineScroll.currentPoint(),
	"chapters",
);
```

The result contains:

```ts
interface EngineScrollPointLocation {
	referencePoint: number;
	current: EngineScrollRegisteredPoint | null;
	previous: EngineScrollRegisteredPoint | null;
	next: EngineScrollRegisteredPoint | null;
	index: number;
	count: number;
	progress: number;
}
```

## Performance model

Point order is already cached by `EngineScrollPointManager`. Tracking uses a binary search over that cache rather than scanning every registered point:

```text
EngineScroll runtime update
        ↓
point order cache
        ↓
binary search active point
        ↓
tracker frame
        ↓
subscribers / onChange
```

The same internal cached arrays are also reused by `nearest()`, `next()`, and `previous()`, so those navigation helpers no longer clone the ordered point array before searching it.

This makes point tracking appropriate for long documentation pages, chaptered landing pages, slide-like sections, and other pages with hundreds of registered anchors.
