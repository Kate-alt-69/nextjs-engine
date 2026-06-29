# EngineHero

> Layout-heavy hero sections. Supports centered, split, and fullbleed variants.
> Includes overlay colors/gradients and scroll-parallax.

---

### hero

A layout-heavy section primitive designed for high-impact banners.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `string` | `"centered"` | `"centered" | "split" | "fullbleed"` |
| `overlay` | `string` | — | Background overlay (CSS color/gradient). |
| `parallax` | `boolean` | `false` | Enable scroll-parallax effect. |
| `contentMaxWidth` | `ResponsiveValue` | `"1200px"` | Max width of the inner content container |
| `centered` | `boolean` | `true` | Horizontally centers the content container |
| `snapAlign` | `string` | — | CSS `scroll-snap-align` property |
| `fullViewport` | `boolean` | `true` | Sets `min-height: 100svh` |

**Layout Variants:**
- `centered`: Flex-column with center alignment.
- `split`: 1:1 CSS Grid layout for side-by-side content.
- `fullbleed`: No container constraints; children fill the entire section width.
