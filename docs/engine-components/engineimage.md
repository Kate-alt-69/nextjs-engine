# EngineImage + EngineVideo

Schema types: `"image"` and `"video"`.

These components defer network-heavy media until it is near the viewport while
reserving layout space so media does not need to be mounted eagerly just to
avoid CLS.

## EngineImage

`EngineImage` wraps Next.js image optimization. The component itself uses an
`IntersectionObserver`; `priority: true` bypasses that viewport gate.

```ts
{
  type: "image",
  props: {
    src: "/hero.jpg",
    alt: "Product preview",
    width: 1600,
    height: 900,
    qualityPreset: "balanced",
    rounded: "1rem",
  },
}
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `src` | `string` | required | Next.js-compatible image source |
| `alt` | `string` | required | Accessible alternative text |
| `width` / `height` | `number` | `800 / 600` fallback | Used for intrinsic size and preload-distance estimation |
| `fill` | `boolean` | `false` | Uses Next Image fill mode |
| `priority` | `boolean` | `false` | Mount immediately instead of waiting for IntersectionObserver |
| `quality` | `number` | preset value | Explicit Next image quality |
| `qualityPreset` | `"performance" \| "balanced" \| "sharp"` | `"balanced"` | 65 / 78 / 90 |
| `qualityMobile` | `number` | — | Mobile quality for `<768px` |
| `qualityDesktop` | `number` | — | Desktop quality for `>=768px` |
| `objectFit` | CSS `object-fit` value | `"cover"` | Applied to the rendered image |
| `aspectRatio` | `string` | — | Reserves responsive layout space |
| `sizes` | `string` | generated | Passed to Next image selection |
| `blurDataURL` | `string` | — | Optional blur-up placeholder |
| `rounded` | `boolean \| string` | — | `true` = `8px` |
| `caption` | `string` | — | Wraps image in `<figure>` with `<figcaption>` |

### Responsive quality does not render two images

When `qualityMobile` or `qualityDesktop` is set, EngineImage uses a real
`<picture>` with media-specific `<source>` elements and one fallback `<img>`.
The browser selects one candidate. NE does **not** render two CSS-hidden Next
Image elements, so responsive quality does not intentionally double-download
the asset.

```ts
props: {
  src: "/feature.png",
  alt: "Feature",
  width: 1400,
  height: 900,
  qualityMobile: 65,
  qualityDesktop: 86,
}
```

### Viewport distance

The built-in observer starts mounting larger images earlier:

| Estimated area | Root margin |
|---|---:|
| small | `200px` |
| around 800×600 | `400px` |
| around 1280×720 | `600px` |
| around 1920×1080+ | `800px` |

The schema renderer may additionally defer very large image nodes. Small images
skip the outer `LazyMount`; EngineImage's own observer remains responsible for
the media request.

## EngineVideo

EngineVideo does not create the `<video>` element until its wrapper is within
`rootMargin` of the viewport.

```ts
{
  type: "video",
  props: {
    src: "/demo.mp4",
    poster: "/demo-poster.jpg",
    aspectRatio: "16/9",
    controls: true,
  },
}
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `src` | `string \| VideoSource[]` | required | Single source or ordered `<source>` list |
| `poster` | `string` | — | Poster shown before playback |
| `aspectRatio` | `string` | `"16/9"` | Reserves space before mounting |
| `autoPlay` | `boolean` | `false` | Passed to the native video element once mounted |
| `muted` | `boolean` | `true` | Browser-friendly autoplay default |
| `loop` | `boolean` | `false` | Native video loop |
| `controls` | `boolean` | `true` | Native controls |
| `playsInline` | `boolean` | `true` | Native inline playback hint |
| `preload` | `"none" \| "metadata" \| "auto"` | metadata normally, auto for autoplay | Passed through as the browser preload hint |
| `rootMargin` | `string` | `"800px 0px"` | How early the video element mounts |
| `eager` | `boolean` | `false` | Mount immediately |

Non-autoplay videos do not show a fake perpetual buffering spinner while using
`preload="none"`. With the default configuration NE loads metadata near the
viewport and leaves playback to the user. Autoplay videos default to
`preload="auto"` and show the loading indicator until playback is ready.

`preload` remains a browser hint, not a network guarantee. An explicit value is
passed through unchanged, but `autoPlay: true` also sets the native `autoplay`
attribute; browsers may therefore fetch enough media to honor the playback
request even when `preload="none"` was supplied.

### Changing video sources

Updating `src` after EngineVideo has mounted now creates a fresh native media
element keyed by the ordered source list. This matters because changing React
`<source>` children alone does not reliably make an existing `<video>` run the
HTML media resource-selection algorithm again.

On a source change NE:

1. stops/removes the old media element through React replacement;
2. resets ready/buffering state for the wrapper;
3. mounts the new ordered `<source>` list;
4. lets the native element apply the current preload/autoplay policy.

The source key is based on source URL, MIME type, and order, so recreating an
array with identical entries does not intentionally restart playback.

## Automatic lazy policy

The schema renderer currently uses these additional rules:

- `video` nodes are lazy-mounted with an `800px` root margin.
- large `image` nodes are lazy-mounted; small images rely on EngineImage's own observer.
- nested `canvas`, `manim`, and `manim3d` nodes are lazy-mounted.
- ordinary nested sections/heroes use `content-visibility` for sufficiently large subtrees instead of being removed from React solely because they are nested.
- `lazy: false`, `priority: true`, or `eager: true` forces eager rendering.
- `lazy: true` explicitly requests lazy mounting.

Schema nesting depth is not treated as proof that content is below the fold.
