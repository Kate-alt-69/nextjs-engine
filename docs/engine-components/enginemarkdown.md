# EngineMarkdown

Schema type: `"markdown"`.

EngineMarkdown is a small semantic renderer for trusted/local Markdown content
such as documentation, legal pages, and policy copy. It is intentionally not a
full CommonMark/GFM implementation.

## Supported Markdown

- headings `#` through `######`
- paragraphs
- unordered lists using `-` or `*`
- ordered lists using `1.` style markers
- `**bold**`
- `*italic*`
- inline links: `[label](href)`
- horizontal rules using `---`

Code fences, tables, blockquotes, nested-list syntax, raw HTML, images, and the
full GFM extension set are not parsed by this component.

## Content loading

```ts
// Inline
{
  type: "markdown",
  props: { content: "# Hello\n\nParagraph text." },
}

// Local file — createPage resolves filePath on the server before EngineMarkdown mounts
{
  type: "markdown",
  props: { filePath: "./content/about.md" },
}
```

EngineMarkdown itself is a client component and receives the resolved `content`
string. It does not read files from the browser.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `string` | `""` | Markdown source after server file resolution |
| `filePath` | `string` | — | Local file path consumed by `createPage` |
| `textColor` | `string` | `"#30475f"` | Paragraph/list color |
| `headingColor` | `string` | `"#07111f"` | Heading color |
| `linkColor` | `string` | `"#12304c"` | Inline link color |
| `mutedColor` | `string` | `rgba(7,17,31,0.16)` | Horizontal-rule color |
| `fontFamily` | `ResponsiveValue<CSSProperties["fontFamily"]>` | inherited | Article font family, including breakpoint values |
| `bodySize` | `string` | `"1rem"` | Paragraph/list font size |
| `bodyLineHeight` | `string \| number` | `1.8` | Paragraph/list line height |
| `headingSizes` | partial `h1`…`h6` map | built-in scale | Per-level heading-size overrides |
| `headingIdPrefix` | `string` | — | Prefix for generated heading ids |
| `textAnimation` | `"none" \| "fade-in" \| "slide-up"` | — | Whole-article entrance animation |
| `blockAnimation` | same | — | Per-block staggered animation |
| `animationDuration` | CSS time | `"0.4s"` | Animation duration |
| `animationStagger` | number | `50` | Extra delay per block in ms |
| `disablepointformarkdownhash` | `boolean` | `false` | Stops h1 headings from being EngineScroll points |
| `disablepointformarkdownhashhash` | `boolean` | `false` | Stops h2 headings from being EngineScroll points |

Shared styling/identity props apply to the actual `<article>`. `id` wins over
`point` for the article id; `className` is preserved and merged with `cprop`
state classes and any article animation class.

## Responsive font family

`fontFamily` goes through the same engine style resolver as other responsive CSS
values instead of being reduced to a scalar inline style:

```ts
{
  type: "markdown",
  props: {
    fontFamily: {
      xs: "system-ui, sans-serif",
      lg: "var(--font-reading)",
    },
  },
}
```

## Heading ids and EngineScroll points

Heading ids are deterministic slugs. Duplicate headings receive numeric suffixes:

```md
## API
## API
```

becomes roughly:

```html
<h2 id="api">...</h2>
<h2 id="api-2">...</h2>
```

`headingIdPrefix: "guide"` turns those into `guide-api` and `guide-api-2`.

H1 and H2 point participation can be disabled independently with the two legacy
`disablepoint...` flags above. H3–H6 still receive ids and are currently emitted
as scroll points.

## Link safety

EngineMarkdown renders text through React; it does not inject raw Markdown as
HTML. Inline links additionally validate their URL before an anchor is emitted.
Allowed explicit schemes are:

- `http:`
- `https:`
- `mailto:`
- `tel:`

Normal relative paths and hashes are allowed. Protocol-relative URLs such as
`//example.com`, backslash-prefixed network paths, and explicit schemes such as
`javascript:` or `data:` are rejected and replaced with `#`.

HTTP(S) links open in a new tab with `rel="noopener noreferrer"`. Relative,
hash, mail, and telephone links stay in the current browsing context.

## Parsing/runtime behavior

The block parse is memoized by the `content` string. Changing an unrelated style
or color prop therefore does not rescan the full Markdown document. Inline token
rendering remains intentionally small and happens during the React render of each
block.

The parser is deterministic for the same `content`; EngineMarkdown does not
suppress React hydration warnings to hide content mismatches.

## Animations

```ts
{
  type: "markdown",
  props: {
    content: "# Animated\n\nSome copy.",
    blockAnimation: "slide-up",
    animationDuration: "0.5s",
    animationStagger: 60,
  },
}
```

The injected animation stylesheet respects `prefers-reduced-motion: reduce`.
It also uses a stable DOM id, so development hot reloads do not intentionally
append duplicate Markdown keyframe style elements.
