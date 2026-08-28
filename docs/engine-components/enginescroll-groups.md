# EngineScroll Point Groups

EngineScroll point groups let one page keep multiple independent navigation and
snapping sets without creating separate scroll runtimes.

A point still has one globally addressable name. Groups are tags that decide
which points participate in operations such as `nearest()`, `next()`,
`previous()`, and snapping.

## Schema-native points

Normal NE schemas can declare the full point behavior directly:

```ts
{
	type: "section",
	props: {
		point: "features",
		pointGroup: ["chapters", "home"],
		pointAlign: "center",
		pointOffset: -4,
	},
}
```

`pointGroup` accepts one group name or an array. `pointAlign` accepts `start`,
`center`, `end`, or `nearest`. `pointOffset` is measured in EngineScroll point
units, so it follows the same coordinate model as `EngineScroll.move()`.

These three fields are Engine metadata. `SchemaRenderer` consumes them during
point registration and does not forward them to the rendered component or DOM.
The existing `point` field still supplies the point name and, when no explicit
`id` exists, the DOM id used to locate the mounted element.

## Manual registration

Manual registration remains available outside normal schema rendering:

```ts
import { EngineScrollPointManager } from "@/engine";

EngineScrollPointManager.registerElement("intro", introElement, {
	group: "slides",
});

EngineScrollPointManager.registerElement("demo", demoElement, {
	group: ["slides", "chapters"],
});

EngineScrollPointManager.registerElement("pricing", pricingElement, {
	group: "chapters",
});
```

Duplicate group names on one point are removed automatically. Empty group names
are ignored.

For namespace-like naming, combine a dotted point name with a group:

```ts
EngineScrollPointManager.registerElement("slides.intro", introElement, {
	group: "slides",
});
```

The point remains directly addressable as `#slides.intro`, while grouped
operations can work on all `slides` points.

## Inspect groups

```ts
EngineScrollPointManager.groups();
// ["chapters", "slides"]

EngineScrollPointManager.names("slides");
// ["intro", "demo"]

EngineScrollPointManager.inGroup("slides");
// registered point objects ordered by page position
```

Group order uses the same cached point ordering as normal EngineScroll
navigation. Layout changes invalidate the cache through the existing
`ResizeObserver`; group filtering does not add browser listeners.

## Grouped navigation

```ts
EngineScroll.next({
	group: "slides",
});

EngineScroll.previous({
	group: "slides",
	wrap: true,
});

EngineScroll.nearest({
	group: "chapters",
	duration: 300,
});
```

A specific target such as `EngineScroll.move("#pricing")` does not need a group
because the point name already identifies the destination.

## Grouped snapping

```ts
const disableSlidesSnap = EngineScroll.enableSnap({
	group: "slides",
	mode: "directional",
	threshold: 18,
	duration: 260,
	easing: "easeOutCubic",
});
```

Only points tagged `slides` are considered as candidates. The snapping engine
still uses the existing EngineScroll runtime subscription and scheduler; point
groups do not create a second scroll listener or RAF loop.

One-shot snapping works the same way:

```ts
EngineScroll.snap({
	group: "chapters",
	threshold: 12,
});
```

## API shape

```ts
type EngineScrollPointGroupInput = string | readonly string[];

interface EngineScrollPointOptions {
	align?: "start" | "center" | "end" | "nearest";
	offset?: number;
	group?: EngineScrollPointGroupInput;
}

interface EngineScrollPointSchemaProps {
	pointGroup?: EngineScrollPointGroupInput;
	pointAlign?: "start" | "center" | "end" | "nearest";
	pointOffset?: number;
}
```

`EngineScrollRegisteredPoint.groups` is always a normalized readonly string
array.

## Performance model

The point manager keeps one global ordered cache and lazy per-group ordered
caches:

```text
point registration / layout invalidation
        ↓
invalidate ordered caches once
        ↓
first grouped query
        ↓
filter global order
        ↓
cache group order
```

Repeated `next({ group: "slides" })` and grouped snap checks therefore do not
re-sort every point on the page.
