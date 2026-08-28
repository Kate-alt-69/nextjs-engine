# Runtime & Performance Notes

This page documents performance behavior that is true in the current source.
It is not a promise that every schema is automatically fast; expensive custom
callbacks, huge scenes, media, and application code can still dominate runtime.

## Client module loading

The schema registry keeps the small primitive set eager and puts optional/heavy
built-ins behind lazy module boundaries. Pages made from ordinary boxes, text,
grid, stack, buttons, and similar primitives do not need to eagerly evaluate
the full Markdown/Canvas/Video/Nav/Forms/Manim catalog just because those node
types are registered.

Three.js remains dynamically imported by the 3D render paths.

A split registry component can still be **layout-eager** (for example a priority
image, root Canvas/Manim, Hero, Nav, or form control). SchemaRenderer wraps those
eager split modules in an Engine-owned Suspense boundary so code splitting cannot
surface as an unowned `React.lazy()` suspension. Media/graphics fallbacks reserve
a known aspect ratio/height when the schema provides one. Nodes already deferred
through `LazyMount` use that existing Suspense boundary instead of being wrapped
a second time.

## EngineCanvas

- one component-owned RAF loop per active EngineCanvas frame source;
- callback mode does not schedule RAF when `onDraw` is absent;
- callback mode stops RAF when `onDraw` returns `false` and only wakes for a changed callback or backing-store redraw;
- pauses while offscreen and/or while the document is hidden;
- adaptive DPR adjustments are rate-limited to at most one decision per 750ms;
- built-in graphics engines are imported only when selected;
- 2D retains compiled topology and `Path2D` geometry for unchanged meshes;
- 3D and SVG graphics backends retain output objects rather than rebuilding the complete scene/tree every frame;
- removed Three.js geometry/material resources are disposed;
- DPR changes are forwarded to rendering engines during resize.

For complex scenes, keep EC node ids stable and reuse vertex/index typed arrays
when geometry has not changed. Replacing those arrays tells retained renderers
that geometry needs rebuilding. For Engine2D specifically, material and transform
updates do not invalidate cached geometry paths.

## EngineShader

Animated EngineShader instances share one `EngineShaderScheduler` RAF rather
than starting one browser frame loop per shader. The scheduler isolates frame
callback failures: if one shader callback throws, that callback is removed from
the shared scheduler while the remaining shaders still receive the same frame
and continue scheduling future frames. This prevents one broken shader from
freezing every animated EngineShader or throwing again on every RAF indefinitely.

The shared RAF is cancelled when the final callback leaves the scheduler.

Manifest publication is ordered per shader base path. Forced refreshes and cache
clears invalidate the publication rights of older in-flight manifest requests,
so a slower stale response cannot overwrite a newer manifest or prune artifacts
using stale metadata. Artifact promise cleanup is identity-checked as well: an
old rejected request cannot delete a replacement promise created after a cache
clear.

Development hot reload does not force a second manifest request while the initial
shader manifest is still loading. Once a baseline exists, the poller owns forced
manifest refreshes and notifies affected shaders; component reloads then reuse the
fresh manifest already in cache instead of immediately requesting it again. If an
initial load failed and no request remains pending, polling can establish a fresh
baseline and wake subscribers.

## EngineManim

Manim2D compiles shape geometry outside RAF. Transform pairs with mismatched
point counts are normalized once per compiled timeline and interpolation writes
into a retained `Float32Array`; transform frames do not allocate replacement
geometry arrays.

`settings.fpsLimit` caps Manim2D timeline sampling/painting. Non-looping
animations use EngineCanvas's completion signal to release RAF after the final
frame. `Wait` holds the existing bitmap instead of clearing it and repainting an
empty/background-only frame.

Manim3D static scenes are demand-rendered rather than continuously redrawn.
Animated Manim3D scenes cancel RAF while offscreen or while the document is
hidden, and model/renderer resources are disposed on teardown.

## EngineScroll

EngineScroll has no intentional permanent idle RAF loop. Native scroll/resize
work is coalesced into its BrowserScheduler. Programmatic smooth movement starts
that scheduler itself and keeps requesting frames only while animation is active.

Schema `point` props register their actual mounted element with the point manager.
A node may keep a different DOM `id`; the point remains a semantic alias and is
refreshed from current layout before navigation.

## Lazy rendering and observer pooling

Lazy decisions are conservative:

- explicit `lazy: false`, `priority: true`, or `eager: true` wins;
- explicit `lazy: true` requests lazy mounting;
- video is deferred with an 800px margin;
- large images are deferred; EngineImage also has its own size-aware observer;
- nested Canvas/Manim nodes are deferred;
- ordinary nested sections are not assumed to be below the fold solely from tree depth; heavy ones use `content-visibility` rather than automatic full unmounting;
- descendant counts are cached while analyzing a schema tree.

`LazyMount.rootMargin` is passed to its actual IntersectionObserver. It is not a
documentation-only tuning value.

`useInView()` does not allocate one native `IntersectionObserver` per hook.
Instances with the same root, root margin, and threshold share one observer and
keep per-element listeners in the Engine pool. When the final element leaves a
pool, the native observer is disconnected and removed. This keeps pages with
large lazy lists from multiplying identical native observers.

`once: true` unregisters only the intersected element after its first hit; it does
not disconnect the shared observer while other elements still depend on it.

## Responsive hook listener ownership

All `useBreakpoint()` / `useMinBreakpoint()` instances share one passive window
`resize` listener. Native resize events are coalesced through one RAF, and each
hook only notifies React when its **resolved breakpoint changes**. Dragging a
window within the same breakpoint therefore does not rerender every breakpoint
consumer on every pixel.

Custom EngineProvider breakpoint maps remain supported; each subscriber resolves
against its own provider configuration while sharing the same browser listener.

## Provider context stability

`EngineProvider` uses stable shared empty handler/slot maps when those props are
omitted. It does not create fresh `{}` defaults on every provider render. This
matters because a new handler/slot object changes the context value and can wake
all context consumers below the provider even when the application supplied no
handlers or slots at all.

Applications that construct their own handler or slot maps dynamically should
still memoize those maps when their contents are unchanged if provider rerenders
are frequent.

Each provider also owns one stable `StyleCollector` instance for its lifetime.
Generated CSS helpers read that collector from context, which keeps concurrent
server renders isolated without allocating a new collector on every child render.

## Responsive resolver cache

Responsive variable resolution is deterministic for a canonical cache key, so
its memoized `ResolvedVar` objects can be reused safely across independent page
and component renders. `createPage()` does not clear this shared cache during
render; doing so would make concurrent renders evict each other's useful work.

The cache is bounded to 2,048 entries and promotes hits in LRU order. Once full,
adding a new unique responsive value evicts the least recently used entry. This
keeps repeated schemas cheap without allowing standalone components or long-lived
client sessions with highly dynamic values to grow the resolver map without
bound. Explicit cache clearing remains an internal test/tool operation.

## Images and video

Responsive image quality uses `<picture>/<source>` selection with one fallback
image rather than rendering two CSS-hidden Next Image instances. The generated
mobile/desktop candidate data is memoized from request-defining image props so a
placeholder/opacity state change does not rebuild both srcset payloads.

For non-fill images, positive numeric `width` + `height` automatically reserve
that aspect ratio before the image mounts. This also covers small images that do
not receive an outer LazyMount, reducing avoidable CLS. Image readiness is keyed
to the current `src`, so changing the source does not inherit the old image's
loaded state.

Ordinary video defaults to metadata preload once it is near the viewport.
Autoplay video defaults to auto preload and shows a loading indicator until it
can play. This avoids displaying a perpetual buffering state for a video that
was explicitly configured not to preload.

Before mount, EngineVideo may use its own poster surface. Once a normal
non-autoplay video exists, the native `<video poster>` owns that image instead of
keeping a duplicate poster element stacked over the video. Autoplay retains the
external poster only while the video is intentionally transparent and becoming
playable.

## Hero parallax

Parallax scroll updates are RAF-throttled and stop while the hero is outside a
300px viewport margin. Reduced-motion users skip the JS motion path.

## Build performance

The repository build script does not run `npm install` inside the build command.
Dependency installation belongs to the caller/CI step. This keeps repeated local
builds from re-running package resolution for no reason.

The main CI workflow currently performs:

1. dependency install;
2. APIStatic, EngineShader compiler/runtime, EngineBrowser, EngineTransitions, EngineScroll, EngineOverlay, and style-compiler regression smoke tests;
3. TypeScript check;
4. optimized Next.js integration build;
5. client chunk inventory from the configured `dist/static/chunks` output.

The repository uses `distDir: "dist"`; tooling must not assume `.next`.

## Style collection

Normal generated CSS is deduplicated by exact content **inside the current
provider collector only**. The old cross-render registry retained up to thousands
of ordinary CSS blocks and hashed every add even though each response still
needed those blocks in its own stylesheet. That cache remains removed: normal
styles do not pay cross-render retention/hash overhead, and exact-content keys
avoid collector-level hash collisions.

`EngineProvider` now owns the normal generated-style collector used by its
rendering subtree. `usePropStyles()`, responsive visibility rules, cprop helpers,
shader pending rules, navigation styles, and built-in static classes route
through that provider collector. `createPage()` no longer resets a process-level
collector at render start, so overlapping server renders cannot erase each
other's generated CSS.

Nested `createComponent()` providers own and serialize their own generated CSS
rather than resetting or re-serializing the parent page collector. This keeps
standalone component usage intact while giving each emission boundary clear
ownership.

The CSS serializer preserves nested conditional scope and handles rule-body
grammars separately. Nested `@media` / `@supports` rules retain their selector,
`@keyframes` retains frame selectors, and declaration at-rules such as
`@font-face`, `@page`, and `@property` emit declarations directly.

Only CSS deliberately added with `StyleCollector.addGlobal()` survives across
render passes for `EngineGlobalStyles()`. The exported `globalStyleCollector`
remains as a compatibility fallback for low-level helpers invoked outside an
`EngineProvider`; built-in page rendering does not use it as the normal request
collector.

### Remaining style-runtime limitation

Dynamic generated CSS created **after hydration** is still primarily collected
rather than incrementally flushed into the live DOM stylesheet. The ownership
problem is fixed, but a future client-side flusher must append only new rules,
avoid render-time DOM side effects, and avoid duplicating the complete SSR
stylesheet.

This is separate from server-render concurrency: provider-scoped SSR collection
is isolated now.

## Measuring instead of guessing

Use production builds when evaluating bundle size or runtime behavior. Development
mode includes React/Next diagnostics, HMR, source maps, and other overhead that
changes the performance profile.

When a performance change lands, CI should remain type-clean and the chunk
inventory should be checked for unexpected growth. Runtime-heavy changes such as
Canvas rendering should additionally be profiled in the browser with a scene
large enough to expose allocation and frame-time problems.
