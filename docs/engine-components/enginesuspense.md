# EngineSuspense

> Schema-native Suspense with built-in loading presets:
> skeleton, shimmer, spinner, pulse, blur.

---

### suspense

Wraps children in a React Suspense boundary with optimized loading presets.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `preset` | `string` | `"skeleton"` | `"skeleton" | "spinner" | "shimmer" | "pulse" | "blur"` |
| `minHeight` | `string\|number` | — | Reserved vertical space for the placeholder |
| `skeletonLines` | `number` | `4` | Lines for the skeleton preset |
| `delay` | `number` | `0` | Delay in ms before fallback appears |
| `fallback` | `ReactNode` | — | Custom fallback override |

**Note:** Uses `DelayedFallback` internally to prevent "flashing" on fast network connections.
