# EngineTransitions+ Browser Compatibility

EngineTransitions+ treats page animation as progressive enhancement. Navigation and state updates must remain functional even when a browser does not expose the native View Transitions API.

## Runtime tiers

v2.6.2 uses three compatibility tiers:

```text
native View Transitions available
	→ native captured-page transition + NE preset animation

no native View Transitions, Web Animations available
	→ short NE root fade around the update/navigation

no compatible animation API
	→ normal update/navigation with no animation
```

This means an NE link is never allowed to become unusable merely because a browser is older than the transition effect.

## Current major browsers

Modern Chromium-family browsers, Firefox, and Safari/WebKit builds with same-document View Transitions use the full native Transitions+ path.

Chromium-family includes browsers such as Chrome, Edge, Brave, and current Opera builds. Safari/WebKit and Firefox use their own implementations rather than Chromium's.

The browser matrix in CI exercises:

```text
Chromium
Firefox
WebKit
```

The WebKit project is the closest automated proxy for current Safari behavior available on Linux CI.

## Older browser behavior

A browser can be supported by a Next.js application while still being too old for native View Transitions. v2.6.2 no longer turns that into an all-or-nothing transition feature.

When `document.startViewTransition` is unavailable, NE uses Web Animations for a small root fade and still waits for the actual Next.js update/navigation. If Web Animations is also unavailable, the update runs immediately.

No polyfill is required.

## Firefox and older-engine CSS compatibility

Transitions+ no longer emits typed multiplication expressions such as:

```css
calc(-1 * 10deg)
calc(-.35 * 36px)
calc(.5 * 7px)
```

Those calculations are unnecessary because NE already owns the numeric preset values. v2.6.2 performs the arithmetic in JavaScript and emits ordinary values:

```css
-10deg
-12.6px
3.5px
```

This applies to the more complex `liquid`, `depth`, `flip`, `page-turn`, `scatter`, `rgb`, and `portal` preset frames.

## Shared element names

Shared transitions use DOM ids, but a DOM id is not copied directly into `view-transition-name`.

v2.6.2 creates a readable sanitized prefix plus a deterministic hash of the original id:

```text
raw DOM id
	→ readable safe prefix
	→ deterministic id hash
	→ unique view-transition-name
```

This prevents names such as `Foo Bar` and `foo-bar`, or two very long ids with the same truncated prefix, from collapsing to the same transition name.

## Animation fallback safety

If a browser exposes View Transitions but rejects one of NE's requested pseudo-element animations, NE now follows this fallback order:

```text
requested preset frames
	↓ failure
safe fade frames
	↓ failure
skip custom transition animation
	↓
finish the update/navigation
```

A transition effect is never more important than completing the route change.

## Same-URL navigation

Animated `push()` / `replace()` calls now normalize the destination URL before starting the navigation wait.

If the requested URL is already the current URL, NE lets the router handle it immediately rather than waiting for a URL mutation that can never occur.

## Reduced motion

`prefers-reduced-motion: reduce` remains a hard animation bypass for Transitions+. The actual update/navigation still occurs.

## Automated compatibility coverage

`tests/browser/engine-compat.spec.ts` runs through Playwright on Chromium, Firefox, and WebKit. The suite checks:

- real SSR/client hydration of generated Engine styles;
- an initially-open EngineDialog;
- a complex `liquid` state transition;
- animated route navigation;
- same-URL transition completion;
- the fallback path with native View Transitions disabled;
- reduced-motion behavior;
- browser page errors and hydration-related console errors.

The lighter `scripts/engine-transitions-compat-smoke.js` additionally rejects typed CSS multiplication and checks collision-safe shared names without needing a browser download.

## Compatibility principle

NE does not require every supported browser to render every visual effect identically.

The contract is:

1. the page and route must work;
2. accessibility preferences must be respected;
3. modern browsers receive the richest safe effect they support;
4. older engines degrade to a simpler animation or normal navigation;
5. compatibility fallback must never require disabling SSR or turning the Engine into a client-only framework.
