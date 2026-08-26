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

## EngineCanvas

- one component-owned RAF loop per EngineCanvas instance;
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

## EngineScroll

EngineScroll has no intentional permanent idle RAF loop. Native scroll/resize
work is coalesced into its BrowserScheduler. Programmatic smooth movement starts
that scheduler itself and keeps requesting frames only while animation is active.

## Lazy rendering

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

## Images and video

Responsive image quality uses `<picture>/<source>` selection with one fallback
image rather than rendering two CSS-hidden Next Image instances.

Ordinary video defaults to metadata preload once it is near the viewport.
Autoplay video defaults to auto preload and shows a loading indicator until it
can play. This avoids displaying a perpetual buffering state for a video that
was explicitly configured not to preload.

## Hero parallax

Parallax scroll updates are RAF-throttled and stop while the hero is outside a
300px viewport margin. Reduced-motion users skip the JS motion path.

## Build performance

The repository build script does not run `npm install` inside the build command.
Dependency installation belongs to the caller/CI step. This keeps repeated local
builds from re-running package resolution for no reason.

The main CI workflow currently performs:

1. dependency install;
2. TypeScript check;
3. optimized Next.js integration build;
4. client chunk inventory from the configured `dist/static/chunks` output.

The repository uses `distDir: "dist"`; tooling must not assume `.next`.

## Known architectural limitation: style collection

Most generated style helpers still write through the process-level
`globalStyleCollector`. `createPage()` resets it at the start of its render pass.
`createComponent()` no longer resets it from inside a nested render because that
could erase CSS already collected by a parent page.

Full per-request style-collector isolation is still a larger architectural item.
Do not interpret current style deduplication as a guarantee that the global
collector is concurrency-isolated across every possible server rendering model.

This limitation is documented deliberately instead of claiming the optimizer
has already solved something it has not.

## Measuring instead of guessing

Use production builds when evaluating bundle size or runtime behavior. Development
mode includes React/Next diagnostics, HMR, source maps, and other overhead that
changes the performance profile.

When a performance change lands, CI should remain type-clean and the chunk
inventory should be checked for unexpected growth. Runtime-heavy changes such as
Canvas rendering should additionally be profiled in the browser with a scene
large enough to expose allocation and frame-time problems.
