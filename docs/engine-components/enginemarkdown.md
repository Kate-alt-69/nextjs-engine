# EngineMarkdown

> Markdown renderer with animations, heading anchor slugs, and file loading.

---

### markdown

Renders trusted Markdown content through the engine. This is intended for local content files such as legal pages, documentation, and policy copy.

Supported Markdown:
- `#` through `######` headings
- paragraphs
- unordered and ordered lists
- `**bold**`, `*italic*`, and inline links like `[label](/path)`
- horizontal rules using `---`

| Prop | Type | Description |
|------|------|-------------|
| `content` | `string` | Markdown source text |
| `filePath` | `string` | Local Markdown file path. `createPage` reads it on the server before rendering. |
| `textColor` | `string` | Paragraph/list text color |
| `headingColor` | `string` | Heading color |
| `linkColor` | `string` | Link color |
| `mutedColor` | `string` | Divider/border color |

### section

Page section with a centered max-width content column.

| Prop | Type | Default |
|------|------|---------|
| `contentMaxWidth` | `ResponsiveValue<string\|number>` | `"1200px"` |
| `centered` | `boolean` | `true` |
| `fullViewport` | `boolean` | `false` (sets `min-height: 100svh`) |
| `snapAlign` | `"start" \| "center" \| "end"` | — |

### markdown

Renders a Markdown string as semantic HTML inside an `<article>`. Lazy-loaded when below the fold (400px rootMargin). Parsed blocks: headings `#`–`######`, paragraphs, `**bold**`, `*italic*`, `[links](url)`, unordered/ordered lists, `---` horizontal rules.

**Content loading:**

```ts
// Inline string
{ type: "markdown", props: { content: "# Hello\n\nParagraph text." } }

// From a .md file (server-side only — resolved by createPage before render)
{ type: "markdown", props: { filePath: "./content/about.md" } }
```

**Colour props:**

| Prop | Default | Description |
|------|---------|-------------|
| `textColor` | `"#30475f"` | Body paragraph colour |
| `headingColor` | `"#07111f"` | Heading colour |
| `linkColor` | `"#12304c"` | Inline link colour |
| `mutedColor` | `"rgba(7,17,31,0.16)"` | `<hr>` / divider colour |

**Typography props:**

| Prop | Default | Description |
|------|---------|-------------|
| `fontFamily` | inherited | Font family for the whole article |
| `bodySize` | `"1rem"` | Paragraph font-size |
| `bodyLineHeight` | `1.8` | Paragraph line-height |
| `headingSizes` | scale defaults | Per-level overrides — `{ h1: "clamp(2rem,5vw,3.5rem)", h2: "1.75rem" }` |
| `headingIdPrefix` | — | Optional prefix for generated heading ids used by `href="#..."` navigation |

Markdown headings automatically receive slug ids based on their text. For example, `## Use of Services` renders with `id="use-of-services"`, so an engine button or link can point to `href: "#use-of-services"`. Add `html { scroll-behavior: smooth; }` in page `theme.globalStyles` for smooth jumps.

**Animation props:**

| Prop | Values | Default | Description |
|------|--------|---------|-------------|
| `textAnimation` | `"none" \| "fade-in" \| "slide-up"` | — | Animates the whole article on mount |
| `blockAnimation` | `"none" \| "fade-in" \| "slide-up"` | — | Staggered per-block animation |
| `animationDuration` | CSS time string | `"0.4s"` | Duration per animation |
| `animationStagger` | number (ms) | `50` | Extra delay added per block |

All animations respect `prefers-reduced-motion: reduce` — set to `animation: none !important` automatically.

```ts
{
  type: "markdown",
  props: {
    filePath: "./content/post.md",
    blockAnimation: "slide-up",
    animationDuration: "0.5s",
    animationStagger: 60,
    headingColor: "#9bcf3a",
    bodySize: "1.05rem",
  }
}
```

Renders a `<button>` or `<a>`. Note: For advanced routing and smooth transitions, use the `link` component.

| Variant | Style |
|---------|-------|
| `solid` | Filled with accent colour |
| `outline` | Transparent with accent border |
| `ghost` | Transparent, no border |
| `elevated` | Solid with glowing shadow |
| `link` | Underlined text, no padding |

Sizes: `xs`, `sm`, `md`, `lg`, `xl`.
