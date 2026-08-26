# EngineScroll — Runtime Scroll System

EngineScroll provides point-based navigation, named targets, a URL protocol,
and a React hook. Its browser runtime coalesces scroll/resize work and smooth
programmatic movement through one RAF scheduler.

`createPage()` already wraps rendered pages in `EngineScrollProvider`. Add your
own provider only when you are using the core scroll API outside a page created
by `createPage` or you intentionally want a higher app-wide provider.

## Hook

```tsx
import { useEngineScroll } from "@/engine";

function NavButton() {
  const scroll = useEngineScroll();
  return <button onClick={() => scroll.move("pricing")}>Pricing</button>;
}
```

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

For `#name`, the navigator first checks `EngineScrollPointManager`; if there is
no registered point it falls back to the matching DOM id.

## Named points

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
EngineScrollPointManager.unregister("pricing");
EngineScrollPointManager.recalculate();
EngineScrollPointManager.get("pricing");
EngineScrollPointManager.names();
```

## URL protocol

EngineScroll commands use `#-es?` so normal `#section` anchors remain normal
browser anchors.

```text
#-es?move=pricing
#-es?move=current&offset=10
#-es?move=footer&duration=600
#-es?move=top
```

```ts
import { EngineScrollURL } from "@/engine";

EngineScrollURL.has();
EngineScrollURL.execute();
const stopListening = EngineScrollURL.listen();
```

After a command executes, EngineScroll removes the command from the address bar
with `history.replaceState()`.

## RAF ownership

Programmatic movement starts the scheduler immediately. It does **not** wait for
an unrelated native `scroll` or `resize` event to wake the animation.

The scheduler behavior is:

1. `EngineScrollAnimation.start()` marks the animation active and requests the first frame.
2. the single BrowserScheduler RAF updates viewport state, physics, observers, and animation;
3. while animation remains active, the scheduler requests the next frame itself;
4. native scroll/resize events request the same scheduler and are coalesced when a frame is already pending;
5. when there is no animation and no pending browser work, there is no permanent RAF loop.

This means EngineScroll does not intentionally burn one animation frame forever
on an idle page.

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

EngineMarkdown can register generated heading ids as EngineScroll points.
Current compatibility flags are:

```ts
props: {
  disablepointformarkdownhash: true,
  disablepointformarkdownhashhash: true,
}
```

The HTML heading id remains available even when EngineScroll point registration
is disabled.

## Legacy schema `"scroll"`

The schema `"scroll"` component remains for compatibility. New imperative
navigation should prefer `EngineScrollProvider`, `useEngineScroll`, and the core
navigator APIs.
