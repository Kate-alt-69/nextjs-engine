# EngineImage + EngineVideo

> Smart lazy image with AVIF/WebP format negotiation, blur-up placeholders, and quality presets.
> Lazy video — src is never injected into the DOM until 800px from the viewport.

---

## Lazy Loading System

## Lazy Loading System

### Decision Logic

The engine analyses every schema node before rendering it and decides the lazy strategy automatically. You do not need to add anything — it just works.

| Node Type | Condition | Strategy |
|-----------|-----------|----------|
| `video` | Always | Full lazy mount, rootMargin 800px |
| `markdown` | Never by default | Uses normal text flow; set `lazy` manually if needed |
| `image` | Width × Height > 640×480 | Lazy mount, rootMargin based on size |
| `image` | Full HD (1920×1080+) | Lazy mount, rootMargin 800px |
| `section` / `hero` | Depth > 0, more than 10 descendants | Full lazy mount, rootMargin 600px |
| `section` / `hero` | Depth > 0, few descendants | `content-visibility: auto` only |
| `grid` / `stack` | Depth > 1, more than 6 items | Lazy mount, rootMargin 400px |
| `card` | Depth > 2 | Lazy mount, rootMargin 300px |
| Any node | `props.priority = true` | Always eager, skip all lazy logic |
| Any node | `props.lazy = false` | Always eager |
| Any node | `props.lazy = true` | Always lazy |

### What Lazy Mount Actually Does

`LazyMount` does not render its children to the DOM at all until the container enters the viewport. This is different from native `loading="lazy"` on images, which still creates the DOM node immediately and lets the browser decide on network timing.

With `LazyMount`:
- Zero DOM nodes for the child tree
- Zero React renders
- Zero network requests
- Zero JS execution

The container div holds its reserved height (preventing layout shift), and once it comes within `rootMargin` of the viewport, the child tree is mounted and wrapped in a `Suspense` boundary.

### content-visibility: auto

For lighter sections that don't need full lazy mounting, the engine applies `content-visibility: auto`. This is a CSS hint to the browser to skip layout, paint, and compositing for off-screen content entirely — even though the DOM nodes exist. Combined with `contain-intrinsic-height`, the browser reserves the correct scroll space.

This is applied automatically. You don't configure it.

### IntersectionObserver: rootMargin Pre-loading

The engine does not wait until an element is literally in the viewport to start loading. It uses `rootMargin` to begin loading content before it arrives:

- Videos: 800px before viewport — buffer time for large files
- Large images (Full HD): 800px before viewport
- HD images: 600px before viewport
- Medium images: 400px before viewport
- Heavy sections: 600px before viewport

### Priority Images

If you set `props.priority = true` on an image node, the engine:
1. Passes `priority` to `next/image` (which preloads the image in `<head>`)
2. Skips IntersectionObserver entirely — image is considered always in-view
3. Never renders a skeleton placeholder

Use this for hero images and above-fold photos.

### Blur-Up Progressive Loading

Every image shows a blur placeholder while the full image loads. If you provide a `blurDataURL` (a tiny base64-encoded low-quality version of the image), the engine renders it blurred and cross-fades to the full image. If no `blurDataURL` is provided, a shimmer skeleton is shown instead.

### Video Loading

Videos are the heaviest assets on any page. The engine's strategy:

1. Render an empty container that holds the aspect-ratio space (no CLS)
2. Show the poster image if provided
3. Wait until the container is 800px from the viewport
4. Only then inject the `<video>` element into the DOM
5. The `<video>` starts with `preload="none"` — no buffering until play
6. Show a loading spinner while the browser buffers
7. Fade the video in once `canplay` fires

The video's `src` literally does not exist in the DOM until the user is about to see it.

---

---

## image

### image

Automatically uses `next/image`. Lazy loads by default unless `priority: true`.

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | Image source (required) |
| `alt` | `string` | Alt text (required) |
| `width` | `number` | Pixel width |
| `height` | `number` | Pixel height |
| `fill` | `boolean` | Fill parent container |
| `priority` | `boolean` | Preload, skip lazy |
| `quality` | `number` | 1–100, default 85 |
| `objectFit` | `string` | cover, contain, etc |
| `aspectRatio` | `string` | CSS aspect-ratio |
| `sizes` | `string` | Responsive sizes hint |
| `blurDataURL` | `string` | Base64 low-quality placeholder |
| `rounded` | `boolean\|string` | Border radius |
| `caption` | `string` | Renders inside `<figure><figcaption>` |

---

## video

### video

Lazy video player. `src` is never fetched until 800px before viewport entry.

| Prop | Type | Default |
|------|------|---------|
| `src` | `string \| VideoSource[]` | Required |
| `poster` | `string` | Thumbnail image |
| `aspectRatio` | `string` | `"16/9"` |
| `autoPlay` | `boolean` | `false` |
| `muted` | `boolean` | `true` |
| `loop` | `boolean` | `false` |
| `controls` | `boolean` | `true` |
| `rootMargin` | `string` | `"800px 0px"` |
| `eager` | `boolean` | `false` |

Multiple sources:
```ts
src: [
  { src: "/video.webm", type: "video/webm" },
  { src: "/video.mp4",  type: "video/mp4" },
]
```

---

## Image Optimisation

## Image Optimisation

All images are served as **AVIF → WebP → original format** automatically via Next.js image optimisation (configured in `next.config.js`). No changes needed in your schema — it's transparent.

### Quality presets

| Preset | Quality | Use for |
|--------|---------|---------|
| `"performance"` | 65 | Thumbnails, backgrounds, grids |
| `"balanced"` | 78 | General purpose (default) |
| `"sharp"` | 90 | Heroes, product shots, detail images |

```ts
{ type: "image", props: { src: "/hero.jpg", alt: "Hero", qualityPreset: "sharp" } }
```

### Per-viewport quality

Renders two `<Image>` elements and uses CSS to show the right one per viewport:

```ts
{
  type: "image",
  props: {
    src: "/photo.jpg",
    alt: "Photo",
    qualityMobile: 60,    // mobile (<768px) — smaller file
    qualityDesktop: 88,   // desktop (≥768px) — full quality
  }
}
```

### Format notes

- **AVIF** — 30–50% smaller than WebP at the same visual quality. Supported in Chrome 85+, Firefox 93+, Safari 16+.
- **WebP** — fallback for older browsers. Supported everywhere modern.
- **Original** — PNG/JPEG served only to browsers that don't support either.

No configuration needed — `next.config.js` sets `formats: ["image/avif", "image/webp"]` and Next.js handles the rest via `Accept` header negotiation.

---
