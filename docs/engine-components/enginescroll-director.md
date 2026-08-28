# EngineScroll Director

`EngineScrollDirector` coordinates many named EngineScroll timelines through one
shared EngineScroll runtime subscription.

Use it for pages where several scroll phases need to move together: cinematic
landing pages, long product stories, docs chapters, scene sequences, or complex
scroll-linked interfaces.

## Create a director

```ts
import { EngineScroll } from "@/engine";

const director = EngineScroll.direct({
	hero: {
		start: "#hero",
		end: "#features",
		source: "current",
	},
	features: {
		start: "#features",
		end: "#pricing",
		source: "current",
	},
	footer: {
		start: "#pricing",
		end: "#footer",
		source: "current",
	},
});
```

The object keys become strongly typed track names. Each value accepts the same
configuration as `EngineScroll.timeline()`.

```ts
const names = director.names();
// ["hero", "features", "footer"]

director.size;
director.has("features");
```

Empty track names fail immediately with an EngineScroll diagnostic instead of
silently creating an unreachable track.

## One runtime subscription

A director does not subscribe each internal timeline independently.

```text
browser scroll / movement
        ↓
EngineScrollRuntime
        ↓
ONE director subscription
        ↓
hero / features / footer
        ↓
changed-track dispatch
```

Aggregate subscribers, per-track subscribers, crossing events, activity events,
and director CSS bindings all share that one subscription.

When the last listener is removed, the director releases the runtime
subscription automatically.

## Aggregate frames

```ts
const stop = director.subscribe((frame) => {
	console.log(frame.changed);
	console.log(frame.active);
	console.log(frame.timelines.hero.progress);
	console.log(frame.timelines.features.progress);
});
```

A director frame contains:

```ts
{
	timelines,
	changed,
	active,
	direction,
	velocity,
}
```

`timelines` contains the current `EngineScrollTimelineFrame` for every named
track.

`changed` intentionally reports tracks whose useful orchestration state changed:
normalized progress, range boundaries, before/active/after state, or active
physics state. A track that is already clamped before or after its range does
not wake subscribers merely because its unbounded `rawProgress` keeps changing.

This keeps large directors from dispatching every inactive scene on every scroll
frame.

## Per-track subscriptions

```ts
const stopHero = director.subscribeTrack("hero", (frame) => {
	console.log(frame.progress);
});
```

Per-track callbacks still use the director's single runtime subscription. They do
not subscribe the child `EngineScrollTimeline` directly.

## Crossing and activity events

```ts
const stopHalfway = director.onCross("hero", 0.5, (event) => {
	console.log(event.direction);
});

const stopEnter = director.onEnter("features", (event) => {
	console.log(event.boundary);
});

const stopLeave = director.onLeave("hero", (event) => {
	console.log(event.boundary);
});
```

Crossing detection uses raw timeline progress, so a large scroll jump can still
cross a threshold correctly.

Manual `director.snapshot()` calls do not consume the event baseline. A later
runtime update still compares against the last runtime-observed frame.

## Direct CSS bindings

Director bindings use the same compiled binding format as normal timelines:

```ts
const stopStyles = director.bindStyles("features", element, {
	opacity: [0, 1],
	"--feature-y": {
		from: 80,
		to: 0,
		unit: "px",
		easing: "easeOutCubic",
	},
});
```

The binding subscribes to the named director track, not directly to
`EngineScrollRuntime`. Multiple director bindings therefore still share the one
director subscription.

The generic `bindEngineScrollTimelineStyles()` helper now accepts any
`EngineScrollTimelineFrameSource`, allowing EngineScroll orchestration objects to
reuse the same zero-React hot path.

## Sampling and navigation

```ts
const hero = director.snapshotTrack("hero");
const halfway = director.pointAt("hero", 0.5);

director.seek("features", 0.75, {
	duration: 320,
	easing: "easeOutCubic",
});
```

Non-reactive interpolation helpers are also available:

```ts
const fade = director.segment("hero", 0, 0.3, "easeOutCubic");
const opacity = director.value("hero", 0, 1);

const parallax = director.track("hero", [
	{ at: 0, value: 80 },
	{ at: 1, value: -40 },
]);
```

These helpers sample the underlying timeline without adding runtime listeners.

## Invalidation

Named timeline geometry uses the same cached `EngineScrollRange` boundary
resolver as standalone timelines.

```ts
director.invalidate("hero");
director.invalidate();
```

Normal EngineScroll point/layout invalidation is automatic. Manual invalidation
is for external geometry changes that the engine cannot observe itself.

## Cleanup

```ts
director.dispose();
```

`dispose()` clears every director listener, releases its runtime subscription,
and disposes its internal timeline objects.

## When to use Director vs Timeline

Use `EngineScroll.timeline()` for one independent reactive range.

Use `EngineScroll.direct()` when several timeline ranges belong to one visual or
interaction system and should share one subscription and one orchestration
surface.
