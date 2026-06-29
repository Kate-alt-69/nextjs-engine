# EngineScroll — Runtime Scroll System

> RAF-based scroll runtime. Point-based navigation, semantic named targets,
> URL protocol (`#-es?`), and React integration via `useEngineScroll`.

---

## EngineScroll — Runtime Scroll System

EngineScroll is a framework-agnostic scroll runtime with a React integration layer. It replaces browser scroll APIs with a point-based system, a RAF scheduler, semantic named targets, and its own URL protocol.

Every page created with `createPage` automatically initializes EngineScroll and activates the URL protocol listener. No manual setup required for basic usage.

---

### Architecture

```
EngineScroll (entry point)
    │
    ├── EngineScrollRuntime      — singleton state + subscriber registry
    ├── EngineScrollAnimation    — easing + interpolation
    ├── EngineScrollMovement     — absolute / relative / percent movement
    ├── EngineScrollNavigator    — public navigation API (resolves targets)
    │       ├── EngineScrollPointManager  — named point registry
    │       └── EngineScrollHash         — DOM id fallback
    ├── EngineScrollURL          — #-es? URL protocol parser
    ├── EngineScrollBrowser      — browser abstraction (Firefox compat)
    ├── EngineScrollEasing       — easing function library
    └── EngineScrollProvider     — React context + useEngineScroll hook
```

---

### Setup

`createPage` auto-initializes EngineScroll on every page. For app-wide scroll (e.g. cross-page transitions) also add the provider in `layout.tsx`:

```tsx
// app/layout.tsx
import { EngineScrollProvider } from "@/engine";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <EngineScrollProvider>{children}</EngineScrollProvider>
      </body>
    </html>
  );
}
```

---

### `useEngineScroll` hook

```tsx
import { useEngineScroll } from "@/engine";

function NavButton() {
  const scroll = useEngineScroll();
  return (
    <button onClick={() => scroll.move("pricing")}>Go to Pricing</button>
  );
}
```

Returns `{ move }`. Throws if used outside `<EngineScrollProvider>`.

---

### `EngineScrollNavigator.move()` — full navigation API

```ts
import { EngineScrollNavigator } from "@/engine";

// Named semantic point (registered via `point` prop or EngineScrollPointManager)
EngineScrollNavigator.move("#hero");
EngineScrollNavigator.move("#pricing", 2);       // with +2 point offset
EngineScrollNavigator.move("#hero", 0, 400);     // custom duration ms

// Absolute scroll point
EngineScrollNavigator.move(120.5);

// Relative from current position
EngineScrollNavigator.move("current", 5);        // scroll forward 5 points

// Jump to top or bottom
EngineScrollNavigator.move("top");
EngineScrollNavigator.move("bottom");
```

**`EngineScrollTarget` type:**

```ts
type EngineScrollTarget =
  | number        // absolute scroll point
  | "top"         // scroll to 0
  | "bottom"      // scroll to page maximum
  | "current"     // offset from current position
  | `#${string}`; // named semantic point or DOM id
```

**Target resolution order for `#name`:**
1. `EngineScrollPointManager.has(name)` → use exact registered scroll point
2. `document.querySelector("#name")` → compute position from DOM rect

---

### `point` prop — registering scroll anchors

Any schema node can become a named scroll target:

```ts
{ type: "section", props: { point: "hero" } }
// → <section id="hero"> registered in EngineScrollPointManager
// → reachable via EngineScrollNavigator.move("#hero")
// → reachable via URL:  #-es?move=hero
```

Points are registered when the element mounts and unregistered on unmount.

---

### `EngineScrollPointManager` — manual registration

```ts
import { EngineScrollPointManager } from "@/engine";

// Register (call from useEffect or similar)
EngineScrollPointManager.register("my-section", point, element);

// Unregister on unmount
EngineScrollPointManager.unregister("my-section");

// Recalculate all positions after layout changes
EngineScrollPointManager.recalculate();

// Query
EngineScrollPointManager.has("my-section");   // boolean
EngineScrollPointManager.get("my-section");   // EngineRegisteredPoint | undefined
EngineScrollPointManager.names();             // string[]
```

```ts
interface EngineRegisteredPoint {
  name:    string;
  point:   number;        // scroll point value
  element: HTMLElement;
}
```

---

### URL Protocol

EngineScroll uses the `#-es?` prefix as its own URL protocol. After execution the command is removed from the address bar with `history.replaceState()`. Standard `#section` anchors are unaffected.

```text
#-es?move=hero
#-es?move=pricing
#-es?move=current&offset=25
#-es?move=120.5
#-es?move=footer&duration=600
#-es?move=top
#-es?move=bottom
```

| Parameter  | Type   | Description |
|------------|--------|-------------|
| `move`     | string | Target: semantic name, `top`, `bottom`, `current`, or numeric |
| `offset`   | number | Scroll-point offset added to target |
| `duration` | number | Override animation duration (ms) |

**Link usage:**

```html
<a href="#-es?move=pricing">Go to pricing</a>
<a href="#-es?move=current&offset=10">Scroll down 10 points</a>
```

**Programmatic:**

```ts
import { EngineScrollURL } from "@/engine";

EngineScrollURL.has();      // true when current URL has #-es? command
EngineScrollURL.execute();  // parse + run + clean URL
EngineScrollURL.listen();   // subscribe to hashchange (returns unsubscribe fn)
```

---

### `EngineScrollEasing`

```ts
import { EngineScrollEasing } from "@/engine";

// All accept t ∈ [0,1] and return value in [0,1]
EngineScrollEasing.linear(t)
EngineScrollEasing.easeInQuad(t)
EngineScrollEasing.easeOutQuad(t)
EngineScrollEasing.easeInOutQuad(t)
EngineScrollEasing.easeInCubic(t)
EngineScrollEasing.easeOutCubic(t)
EngineScrollEasing.easeInOutCubic(t)
```

---

### EngineMarkdown scroll points

`h1` and `h2` headings in `EngineMarkdown` auto-register as named scroll points. Disable per-component:

```ts
{
  type: "markdown",
  props: {
    disablepointformarkdownhash:     true,  // disable h1 → point
    disablepointformarkdownhashhash: true,  // disable h2 → point
  }
}
```

The HTML `id` is still generated regardless — so `href="#slug"` links still work.

---

### Legacy schema node: `"scroll"`

```ts
{
  type: "scroll",
  props: {
    method:             "ease",
    easing:             "ease-in-out",
    scrollDuration:     600,
    pageTransition:     true,
    transitionDuration: 350,
    scrollOffset:       80,
  },
  children: [...]
}
```

Supported for backwards compatibility. New projects should use `EngineScrollProvider` + `useEngineScroll` directly.

---

### Why RAF over `scroll-behavior: smooth`

| | `scroll-behavior: smooth` | EngineScroll RAF |
|---|---|---|
| Duration control | ❌ browser decides | ✅ configurable ms |
| Easing curve | ❌ browser decides | ✅ full easing library |
| Safari compatibility | ⚠️ bugs on `<body>` | ✅ works everywhere |
| `prefers-reduced-motion` | ✅ browser handles | ✅ instant jump |
| Interrupt on new scroll | ❌ fights native | ✅ RAF cancels cleanly |
