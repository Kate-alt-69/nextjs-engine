# EngineScroll — Runtime Scroll System

EngineScroll provides point-based navigation, named targets, a URL protocol,
and a React hook. Its browser runtime coalesces scroll/resize work and smooth
programmatic movement through one RAF scheduler.

`createPage()` wraps rendered pages in `EngineScrollProvider`. Add your own
provider only when using the core scroll API outside a page created by
`createPage`, or when intentionally placing one higher in the application tree.

## Hook

```tsx
import { useEngineScroll } from "@/engine";

function NavButton() {
  const scroll = useEngineScroll();
  return <button onClick={() => scroll.move("#pricing")}>Pricing</button>;
}
```

`EngineScrollProvider` is safe under React Strict Mode. Each effect setup owns
its URL-protocol subscription, while the underlying browser runtime remains a
singleton.

## Navigation

```ts
import { EngineScrollNavigator } from "@/engine";

EngineScrollNavigator.move("#hero");
EngineScrollNavigator.move("#pricing", 2);
EngineScrollNavigator.move("#hero", 0, 400);
EngineScrollNavigator.move(120.5);
EngineScrollNavigator.move("current", 5);
EngineScrollNavigator.move("top");
EngineScrollNavigator.move("bottom");
```

```ts
type EngineScrollTarget =
  | number
  | "top"
  | "bottom"
  | "current"
  | `#${string}`;
```

### Coordinate model

Movement and animation coordinates represent the **top scroll edge** of the
page. `viewport.top` is therefore the correct starting point for an animation
or relative movement.

`viewport.current` remains an observational value, normally the center of the
visible viewport. It is useful for state/telemetry, but it is not written
directly to `window.scrollY`.

`page.totalPoints` is the maximum reachable top-edge point:

```text
(documentHeight - viewportHeight) / pointSpacing
```

This keeps `bottom()` and percentage movement inside the browser's actual
scrollable range.

## Named points and DOM ids

Any schema node can expose a scroll anchor through `point`:

```ts
{
  type: "section",
  props: { point: "pricing" },
}
```

Manual registration is also available:

```ts
EngineScrollPointManager.register("pricing", point, element);
EngineScrollPointManager.registerElement("pricing", element);
EngineScrollPointManager.unregister("pricing");
EngineScrollPointManager.recalculate();
EngineScrollPointManager.get("pricing");
EngineScrollPointManager.names();
```

Before navigating to a registered point, EngineScroll refreshes its coordinate
from the current DOM layout. This prevents stale targets after fonts, images,
accordions, or other content move the element.

For `#name`, the navigator first checks the point manager and then falls back to
a literal DOM id. The fallback uses `getElementById`, not CSS selector parsing,
so valid ids containing characters such as `:` are supported. URL-encoded hash
ids are decoded before lookup. Offsets apply to both registered points and DOM
id fallbacks.

## URL protocol

EngineScroll commands use `#-es?` so ordinary `#section` anchors remain normal
browser anchors.

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

Protocol numbers are parsed as complete finite decimal values. A semantic id
such as `12monkeys` remains an id instead of being partially parsed as point 12.
Invalid offsets fall back to zero; invalid durations fall back to the normal
animation duration; negative durations are clamped to zero.

After a command executes, EngineScroll removes the command from the address bar
with `history.replaceState()`.

## RAF ownership

Programmatic movement wakes the scheduler itself. It does not wait for an
unrelated native `scroll` or `resize` event.

The scheduler behavior is:

1. `EngineScrollAnimation.start()` marks animation active and requests a frame.
2. the single BrowserScheduler RAF updates browser measurements, viewport state, physics, observers, and animation;
3. requests made while a frame is running are coalesced into one follow-up frame;
4. native scroll/resize events use the same scheduler instead of creating parallel RAF loops;
5. when there is no animation and no pending browser work, there is no permanent RAF loop.

Scheduler cleanup preserves ownership of the currently scheduled RAF id, so
`cancel()` cannot lose a frame that was requested from inside another frame.
State cleanup also runs when an update callback throws.

When the document becomes hidden, the active RAF is cancelled. If a smooth
animation is active, its elapsed timeline is paused for the hidden interval.
On resume EngineScroll refreshes once and continues without treating the entire
background interval as one giant frame delta.

## Initial browser state

EngineScroll snapshots `scrollX`, `scrollY`, viewport size, document size, and
DPR during its first runtime update. A page restored or mounted at a non-zero
scroll position therefore starts with truthful viewport point state instead of
waiting for the next native scroll event.

`EngineScrollBrowser.initialize()` remains an explicit opt-in helper for apps
that want `history.scrollRestoration = "manual"`; normal EngineScroll startup
does not silently take ownership of browser history restoration.

## Easing

```ts
EngineScrollEasing.linear(t)
EngineScrollEasing.easeInQuad(t)
EngineScrollEasing.easeOutQuad(t)
EngineScrollEasing.easeInOutQuad(t)
EngineScrollEasing.easeInCubic(t)
EngineScrollEasing.easeOutCubic(t)
EngineScrollEasing.easeInOutCubic(t)
```

Smooth movement defaults to roughly `550ms` unless a duration is supplied.

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

The schema `"scroll"` component remains for compatibility and is separate from
the core runtime automatically installed by `createPage()`. New imperative
navigation should prefer `EngineScrollProvider`, `useEngineScroll`, and the core
navigator APIs.
