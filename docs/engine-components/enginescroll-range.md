# EngineScroll Range

`EngineScrollRange` is the non-reactive geometry layer for a reusable scroll interval. Use it when code needs to reason about `start -> end`, convert normalized progress into an EngineScroll point, measure progress at an arbitrary point, or move somewhere inside a range without creating a Timeline subscription.

A Range does not attach a scroll listener and does not request animation frames. It only resolves geometry when one of its methods is called.

## Create a range

```ts
import { EngineScroll } from "@/engine";

const chapter = EngineScroll.range({
	start: "#intro",
	end: "#pricing",
});
```

Range targets use the same boundary syntax as EngineScroll Timeline:

```ts
number
"top"
"bottom"
"#registered-point-or-dom-id"
```

Since v2.6.2, `#...` uses the same target resolver as navigation. Resolution order is:

```text
registered EngineScroll point
        ↓ when missing
normal DOM element with matching id
```

So this works for both an Engine schema point and an ordinary mounted element:

```ts
const chapter = EngineScroll.range({
	start: "#article-start",
	end: "#article-end",
});
```

Registered points take precedence when a registered point and DOM id share the same name.

Alignment and offsets are also shared:

```ts
const chapter = EngineScroll.range({
	start: "#intro",
	end: "#pricing",
	startAlign: "center",
	endAlign: "end",
	startOffset: -4,
	endOffset: 8,
});
```

Offsets are EngineScroll point units.

## Inspect resolved geometry

```ts
const frame = chapter.snapshot();

frame.startPoint;
frame.endPoint;
frame.span;
frame.minimum;
frame.maximum;
frame.direction;
frame.valid;
```

A missing named boundary produces `valid: false`. A reversed range is valid and reports `direction: -1`.

A plain DOM id that is missing on the first read is **not permanently cached as missing**. If a lazy/Suspense target mounts later, the next Range/Timeline read can resolve it without recreating the range.

## Point at progress

```ts
chapter.pointAt(0);   // start
chapter.pointAt(0.5); // halfway
chapter.pointAt(1);   // end
```

Progress is clamped to `0..1` by default. Extrapolation is opt-in:

```ts
chapter.pointAt(1.25, false);
```

## Progress at a point

```ts
const progress = chapter.progressAt(
	EngineScroll.currentPoint(),
);
```

This returns normalized `0..1` progress. Ask for raw progress when code needs to know how far before/after the range it is:

```ts
chapter.progressAt(EngineScroll.currentPoint(), false);
chapter.rawProgressAt(EngineScroll.currentPoint());
```

Zero-length ranges preserve Timeline semantics: before the boundary is negative, exactly on the boundary is `1`, and after it is greater than `1`.

## Containment

```ts
if (chapter.contains(EngineScroll.currentPoint())) {
	// viewport point lies inside either orientation of the range
}
```

`contains()` works for normal and reversed ranges.

## Move inside a range

```ts
chapter.moveTo(0.5, {
	duration: 320,
	easing: "easeOutCubic",
});
```

This uses the normal EngineScroll movement runtime, including reduced-motion handling and user interruption.

## Range vs Timeline

Use Range when you need geometry/navigation only:

```text
Range
  resolve boundaries
  pointAt / progressAt
  contains
  moveTo
  no subscription
```

Use Timeline when progress should update automatically as scrolling changes:

```text
Timeline
  Range boundary resolver
       +
  existing ES runtime subscription
  crossings / enter / leave
  keyframes / style bindings
```

Timeline internally reuses `EngineScrollRange`, so target semantics, alignment, offsets, invalidation, and boundary behavior have one implementation.

## Caching

Registered EngineScroll point boundaries are cached until either:

- `EngineScrollPointManager.revision()` changes because point/layout geometry was invalidated; or
- the page's maximum reachable point changes.

Plain DOM ids are deliberately different. They are not owned/observed by the point registry, so Range treats them as live boundaries and re-resolves their current DOM geometry when read. This avoids stale coordinates when ordinary elements move and avoids permanently caching a target that had not mounted yet.

For large orchestration graphs where boundary measurement cost matters, register frequently-used boundaries as EngineScroll points.

Normal scroll movement does not invalidate registered boundary geometry by itself. Document/viewport size changes are detected by the existing EngineScroll browser measurement pass and invalidate the shared point registry.

You can explicitly refresh a Range when external code changes registered layout in a way the browser observers cannot infer:

```ts
chapter.invalidate();
```

The next Range/Timeline read resolves its boundaries again.
