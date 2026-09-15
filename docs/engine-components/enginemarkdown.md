# EngineMarkdown

Schema type: `"markdown"`.

EngineMarkdown is a safe AST-backed renderer for documentation, legal pages,
README-style content, and policy copy. It supports CommonMark plus the common
GitHub Flavored Markdown extensions without injecting generated HTML.

## Supported Markdown

- headings, paragraphs, thematic breaks, and hard/soft line breaks
- bold, italic, strikethrough, and nested inline formatting
- inline code and fenced/indented code blocks
- ordered, unordered, nested, and task lists
- links, automatic links, and images
- blockquotes and nested blockquotes
- GitHub-style tables

Raw HTML is deliberately skipped. Applications do not need to sanitize HTML
produced by EngineMarkdown because it renders the parsed syntax as React
elements and never enables `rehype-raw`.

## Code blocks

Standard fenced blocks retain whitespace exactly and expose their language as a
`language-*` class for optional syntax highlighters:

````md
```text
<ROOT>/rbe/
├── storage/
│   └── <object-sha256>/
└── recovery-staging/
```
````

Wide code scrolls inside the code surface instead of widening or wrapping the
page. EngineMarkdown also repairs the compact one-line form sometimes emitted
by documentation generators:

````md
```text <ROOT>/rbe/ ├── storage/ └── backup/```
````

That compatibility repair is limited to a complete opening and closing fence
on the same physical line; valid CommonMark input remains unchanged.

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

In the Generation 3 `createPage` path, the compiler classifies Markdown as
`static` and `EngineServerRenderer` parses it into semantic markup on the
server. The parser, GFM runtime, and Markdown compatibility pass are therefore
not required by that route's browser bundle.

Direct `<EngineMarkdown />` imports remain supported through a client adapter.
That adapter receives resolved `content` and retains the legacy client style
hooks; it never reads files from the browser.

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
| `codeBackground` | `string` | `"#0b1020"` | Fenced-code surface color |
| `codeColor` | `string` | `"#e6edf3"` | Fenced-code text color |
| `inlineCodeBackground` | `string` | translucent gray | Inline-code surface color |
| `inlineCodeColor` | `string` | `headingColor` | Inline-code text color |
| `codeBorderColor` | `string` | translucent gray | Code and table border color |
| `codeFontFamily` | `string` | system monospace stack | Inline and fenced-code font |
| `showCodeLanguage` | `boolean` | `true` | Show the fenced language label |
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

EngineMarkdown renders its Markdown AST through React; it does not inject raw
Markdown as HTML. Links and images additionally validate their URL before an
element is emitted.
Allowed explicit schemes are:

- `http:`
- `https:`
- `mailto:`
- `tel:`

Normal relative paths and hashes are allowed. Protocol-relative URLs such as
`//example.com`, backslash-prefixed network paths, and explicit schemes such as
`javascript:` or `data:` are rejected. Image sources allow only relative paths
and HTTP(S).

HTTP(S) links open in a new tab with `rel="noopener noreferrer"`. Relative,
hash, mail, and telephone links stay in the current browsing context.

## Parsing/runtime behavior

The source compatibility pass and CommonMark/GFM AST produce deterministic
React elements for the same content. Schema Markdown is rendered directly by
the Gen 3 server renderer with its CSS collected into the page style output;
it does not allocate a hydrated client island. `textAnimation` and
`blockAnimation` remain server-renderable because they compile to CSS classes
and variables rather than a browser animation controller.

The direct component compatibility adapter shares the same renderer and keeps
legacy client style work behind a memoized compatibility boundary.
EngineMarkdown does not suppress hydration warnings to hide content mismatches.

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

The animation stylesheet respects `prefers-reduced-motion: reduce`. Gen 3
schema rendering collects it on the server. The direct client adapter uses a
stable DOM id, so development hot reloads do not intentionally append duplicate
Markdown keyframe style elements.
