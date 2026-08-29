# EngineScroll Viewport Focus

`viewport.current` is EngineScroll's logical reading/attention point inside the visible viewport. It is separate from the exact physical edges exposed as `viewport.top` and `viewport.bottom`.

## v2.6.2 default: progressive focus

The default focus strategy is now `"progressive"`.

Instead of permanently sampling the center of the screen, EngineScroll moves the logical focus through the viewport according to document progress:

```text
document start     -> focus 0.00 -> viewport top
document 25%       -> focus 0.25
document halfway   -> focus 0.50
document 75%       -> focus 0.75
document end       -> focus 1.00 -> viewport bottom
```

The calculation uses raw scroll geometry rather than partially-updated EngineScroll state:

```ts
maximumScroll = Math.max(0, documentHeight - viewportHeight);
focus = maximumScroll === 0
	? 0
	: clamp(scrollY / maximumScroll, 0, 1);
```

This avoids circular state dependencies while `Viewport.update()` is calculating `top`, `current`, `bottom`, and `page.totalPoints`.

The main benefit is progress/orchestration behavior. A timeline using `source: "current"` now begins at the logical document start instead of immediately starting roughly half a viewport ahead.

## Public control

Use `EngineScroll.setFocus()` to select a strategy:

```ts
EngineScroll.setFocus("progressive"); // v2.6.2 default
EngineScroll.setFocus("top");
EngineScroll.setFocus("center");
EngineScroll.setFocus("bottom");
EngineScroll.setFocus(0.35);
```

Read the current resolved numeric focus:

```ts
EngineScroll.getFocus();
```

Read the configured strategy/value:

```ts
EngineScroll.getFocusMode();
```

Supported focus values are:

```ts
type EngineScrollViewportFocus =
	| number
	| "top"
	| "center"
	| "bottom"
	| "progressive";
```

Numeric values are clamped to `0..1`.

## Fixed focus compatibility

Applications that depended on the old center-based `viewport.current` behavior can opt back in explicitly:

```ts
EngineScroll.setFocus("center");
```

`viewport.top` and `viewport.bottom` remain exact physical viewport coordinates and are unaffected by the focus strategy.

## Timelines

```ts
const reading = EngineScroll.timeline({
	start: "#article-start",
	end: "#article-end",
	source: "current",
});
```

With progressive focus, `source: "current"` is useful for reading progress, documentation navigation, active-section tracking, and long-form orchestration without giving the timeline an artificial half-viewport head start.

Use `source: "top"` or `source: "bottom"` when a timeline specifically needs a physical viewport edge rather than the logical current position.
