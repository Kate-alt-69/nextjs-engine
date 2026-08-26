# EngineSuspense (ESU)

Schema type: `"suspense"`.

EngineSuspense wraps children in `React.Suspense` and provides built-in loading
presets, delayed fallback display, and an optional timeout UI.

## How the fallback lifecycle works

```text
children render
    │
    ├── do not suspend ───────────────► children stay visible
    │
    └── suspend
         │
         ├── delay elapsed ───────────► loading fallback becomes visible
         │
         └── timeout elapsed ─────────► timeout slot / built-in timeout alert

children later resolve ───────────────► React replaces the fallback with children
```

The delay and timeout timers start when React mounts the Suspense fallback — in
other words, when this boundary is actually suspended. A timeout changes what is
shown while waiting; it does **not** abort the underlying fetch/work and it is
not an error boundary. Rejected promises/errors still require a React error
boundary if you want exception handling.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `preset` | `"skeleton" \| "spinner" \| "shimmer" \| "pulse" \| "blur"` | `"skeleton"` | Built-in loading fallback |
| `minHeight` | `string \| number` | — | Reserves placeholder height |
| `skeletonLines` | `number` | `4` | Number of skeleton lines |
| `delay` | `number` | `0` | Ms before the loading fallback becomes visible |
| `timeout` | `number` | — | Ms before timeout UI replaces the loading fallback |
| `errorFallback` | `string` | — | **Page slot name** to show after timeout |
| `fallback` | `ReactNode` | — | Direct React loading fallback override |

Shared engine props such as `id`, `point`, `className`, `style`, and `cprop`
also apply.

## Timeout fallback slots

`errorFallback` resolves through the existing page-level slot registry. It is
not a DOM id and it does not search elsewhere in the schema tree.

```tsx
export default createPage({
  schema: pageSchema,
  slots: {
    loadError: (
      <div role="alert">
        This section is taking longer than expected.
      </div>
    ),
  },
});
```

```ts
{
  type: "suspense",
  props: {
    preset: "skeleton",
    delay: 150,
    timeout: 8000,
    errorFallback: "loadError",
  },
  children: [/* async/suspending content */],
}
```

If `timeout` is configured but the named slot is missing (or no
`errorFallback` is supplied), EngineSuspense renders its built-in accessible
`Loading timed out.` alert. If the children subsequently resolve, React still
replaces that timeout UI with the resolved children.

Older documentation described `errorFallback` as an arbitrary schema-node id.
That mechanism was not implementable from inside an already-rendered Suspense
boundary and was never functional. The current API deliberately uses page slots,
which EngineProvider can resolve at runtime.

## Delayed fallback

Use `delay` to avoid flashing a placeholder for work that resolves almost
instantly:

```ts
{
  type: "suspense",
  props: {
    preset: "skeleton",
    skeletonLines: 6,
    minHeight: "320px",
    delay: 200,
  },
  children: [/* content */],
}
```

If the boundary resolves before the delay expires, the fallback component
unmounts and its timer is cleared.

## Built-in presets

### `skeleton`

Animated placeholder lines for article/card-style content.

```ts
{ type: "suspense", props: { preset: "skeleton", skeletonLines: 5 } }
```

### `spinner`

Centered circular loading indicator.

```ts
{ type: "suspense", props: { preset: "spinner", minHeight: "120px" } }
```

### `shimmer`

A full-area shimmer placeholder.

```ts
{ type: "suspense", props: { preset: "shimmer", minHeight: "400px" } }
```

### `pulse`

A solid placeholder with an opacity pulse.

```ts
{ type: "suspense", props: { preset: "pulse", minHeight: "280px" } }
```

### `blur`

An inert blurred placeholder surface. It intentionally does **not** render the
suspended children again inside the fallback. Doing that would allow the
fallback itself to suspend when the same unresolved child is rendered twice,
which can bubble suspension into an outer boundary.

```ts
{ type: "suspense", props: { preset: "blur", minHeight: "500px" } }
```

## Reduced motion

The animated built-in presets share the `e-suspense-motion` class. Under
`prefers-reduced-motion: reduce`, their keyframe animations are disabled. The
one-time stylesheet also has a stable id, so development hot reloads do not
intentionally keep appending duplicate Suspense keyframe sheets.

## Custom React fallback

When using `EngineSuspense` directly from React, `fallback` overrides the built-in
loading preset:

```tsx
<EngineSuspense fallback={<MyLoader />} timeout={10_000} errorFallback="loadError">
  <AsyncPanel />
</EngineSuspense>
```

For schema-driven pages, prefer the built-in loading presets and a named page
slot for timeout UI.
