# Mobile scroll stability

Next.js Engine treats native touch scrolling as the owner of the viewport whenever the user starts interacting with the page. Engine-driven movement may animate the window, but it must release control immediately when touch, wheel, or page-scroll keyboard intent arrives.

## Stable layout is more important than speculative lazy mounting

Structural nodes such as `section`, `hero`, `grid`, `stack`, `card`, and `markdown` are eager by default. Schema nesting depth is not a viewport coordinate, so a deeply nested card is not automatically considered off-screen.

This avoids replacing unknown-height page structure with guessed 200–500px placeholders. On mobile, those estimates can change document height while momentum scrolling is still active, which presents as content flicker or a scroll position that jumps backward.

Automatic lazy mounting remains for expensive media/graphics where geometry is more predictable: large images, video, and nested Canvas/Manim surfaces. Any schema node can still opt into lazy mounting with `props.lazy: true`; provide a stable `height`, `minH`, or `minHeight` whenever possible.

## Core EngineScroll touch settling

Core EngineScroll keeps a short desktop idle window for wheel/keyboard scrolling and a longer touch settling window for mobile momentum. While a finger is still down, user-scroll idle cannot expire. After touch end, recent momentum scroll events extend the touch-specific deadline before auto-snap is allowed to run.

This prevents optional `EngineScroll.enableSnap()` from deciding that a kinetic fling has ended during a short event gap and starting a competing programmatic animation.

## Legacy schema `scroll`

The compatibility `scroll` component also releases its custom ease RAF on `touchstart`, `touchmove`, wheel, and page-scroll keyboard input. Delayed anchor movement is cancelled at the same time so a route/hash timer cannot pull the viewport back after the user has taken control.

`method: "snap"` now applies scroll snapping to the document root. The old nested `height: 100vh; overflow-y: scroll` container created a second scroll owner while the component's navigation code continued to call `window.scrollTo()`. Mobile dynamic browser bars made that mismatch especially unstable.

Page-transition content starts visible on initial mount. Opacity is only driven to zero for an actual transition, avoiding a hydration/remount flash.
