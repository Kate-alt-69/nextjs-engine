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
2. APIStatic and EngineBrowser regression smoke tests;
3. TypeScript check;
4. optimized Next.js integration build;
5. client chunk inventory from the configured `dist/static/chunks` output.

The repository uses `distDir: "dist"`; tooling must not assume `.next`.

## Style collection

Normal generated CSS is deduplicated by exact content **inside the current
collector only**. The old cross-render registry retained up to thousands of
ordinary CSS blocks and hashed every add even though each response still needed
those blocks in its own stylesheet. That cache has been removed: normal styles
no longer pay cross-render retention/hash overhead, and exact-content keys avoid
collector-level hash collisions.

Only CSS deliberately added with `StyleCollector.addGlobal()` survives across
render passes for `EngineGlobalStyles()`.

`EngineProvider` points its default context value at the real global collector
instead of allocating a fresh collector that generated style helpers would never
write to.

### Remaining architectural limitations

Most generated style helpers still write through the process-level
`globalStyleCollector`. `createPage()` resets it at the start of its render pass.
`createComponent()` no longer resets it from inside a nested render because that
could erase CSS already collected by a parent page.

Full per-request style-collector isolation is still a larger architectural item.
Do not interpret current per-render deduplication as a guarantee that the global
collector is concurrency-isolated across every possible server rendering model.

There is also a remaining output concern around nested `createComponent()` style
emission: each component boundary can ask the same process collector to serialize
already-collected CSS again. Removing the component style boundary outright would
break standalone `createComponent()` usage, so this needs an emission-ownership
solution rather than a blind deletion.

A related client-side limitation is dynamic generated CSS after hydration. Style
helpers can add a newly generated responsive/pseudo rule to the client collector,
but collector ownership and DOM flushing are still server-oriented. A proper fix
must avoid render-time DOM side effects and avoid duplicating the full SSR
stylesheet during hydration.

These style issues are tracked explicitly rather than being hidden behind an
unsupported quick fix.

## Measuring instead of guessing

Use production builds when evaluating bundle size or runtime behavior. Development
mode includes React/Next diagnostics, HMR, source maps, and other overhead that
changes the performance profile.

When a performance change lands, CI should remain type-clean and the chunk
inventory should be checked for unexpected growth. Runtime-heavy changes such as
Canvas rendering should additionally be profiled in the browser with a scene
large enough to expose allocation and frame-time problems.
