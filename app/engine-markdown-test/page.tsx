import { createPage } from "../../src/engine/createPage";
import { createTheme } from "../../src/engine/theme/createTheme";

const markdownShowcaseTheme = createTheme({
	id: "emd-showcase",
	scope: "global",
	vars: { "--emd-theme-accent": "#826f9b" },
	markdown: {
		defaults: {
			codeBackground: "#241b38",
			codeBorderColor: "#826f9b",
			codeColor: "#f5efff",
		},
		templates: {
			codeBlock: {
				schema: {
					type: "stack",
					props: {
						as: "figure",
						className: "emd-themed-code",
						direction: "column",
						gap: "0",
						style: {
							border: "1px solid {{codeBorderColor}}",
							borderRadius: "1rem",
							background: "{{codeBackground}}",
							color: "{{codeColor}}",
						},
					},
					children: [
						{ type: "slot", props: { name: "languageLabel" } },
						{ type: "slot", props: { name: "content" } },
					],
				},
			},
			tableHeader: {
				schema: {
					type: "stack",
					props: { direction: "row", gap: "0.4rem", align: "center" },
					children: [{ type: "slot", props: { name: "content" } }],
				},
			},
		},
		styles: {
			codeBlock: { borderColor: "#826f9b" },
		},
		variants: {
			dark: {
				defaults: { codeBackground: "#241b38" },
				styles: { codeBlock: { borderColor: "#826f9b" } },
			},
		},
	},
});

const MARKDOWN_SHOWCASE = `# EngineMarkdown showcase

This route exercises the **complete documented EngineMarkdown feature set**: safe CommonMark and GitHub Flavored Markdown, typography, links, images, code, ANSI output, responsive styles, animations, generated heading ids, and per-element theme overrides.

## Inline formatting and links

Use **bold**, *italic*, ***combined emphasis***, ~~strikethrough~~, and \`inline code\` in a paragraph. This sentence ends with two spaces  
so the next phrase starts on a hard line break.

Visit [the Next.js website](https://nextjs.org) or <https://github.com>. Relative links such as [the top of this page](#markdown-showcase-engine-markdown-showcase), [email](mailto:hello@example.com), and [phone](tel:+15551234567) remain in the current browsing context. A [blocked JavaScript link](javascript:alert(1)) is rendered as a harmless placeholder.

## Lists and task lists

- Unordered item one
- Unordered item two
	- Nested item with **formatting**

1. Ordered item one
2. Ordered item two
	 1. Nested ordered item

- [x] GFM task completed
- [ ] GFM task still open

## Blockquotes and thematic breaks

> A styled blockquote demonstrates the semantic quote treatment.
>
> > Nested blockquotes work too, with **inline emphasis** preserved.

---

## Images

![A small EngineMarkdown feature illustration](/markdown-demo.svg)

## Fenced code and compatibility repair

Standard fenced code retains whitespace and displays its language label:

\`\`\`typescript
type MarkdownFeatures = {
	safeByDefault: true;
	serverRendered: true;
};

const feature: MarkdownFeatures = { safeByDefault: true, serverRendered: true };
\`\`\`

Compact one-line fences emitted by some generators are repaired too:

\`\`\`text <ROOT>/compact/ ├── storage/ └── backup/\`\`\`

## ANSI terminal output

ANSI SGR sequences become safe styled text spans, including custom palette colors:

\`\`\`ansi
\u001b[1;32m✓ Build complete\u001b[0m
\u001b[38;2;255;120;50mTruecolor output\u001b[0m
\u001b[38;5;196m256-color output\u001b[0m
\`\`\`

## GitHub Flavored Markdown table

| Feature | Status | Notes |
| :--- | :---: | ---: |
| GFM table | **Ready** | Wide tables scroll inside their container |
| Task lists | ✓ | Native checkbox state |
| Strikethrough | ~~old parser~~ | Semantic deletion element |

## Heading levels and duplicate ids

### Heading level three

#### Heading level four

##### Heading level five

###### Heading level six

### Heading level three

Duplicate headings receive unique numeric suffixes; this heading should end in \`-2\`.

## Raw HTML and URL safety

Raw HTML is intentionally skipped for safety. The following should not create an image or script element:

<script data-engine-markdown-unsafe>window.__markdownUnsafe = true</script>
<img src="javascript:alert(1)" onerror="alert(1)">

## Renderer configuration exercised here

This article also applies responsive font family and body sizing, heading scales and id prefix, independent H1/H2 scroll-point flags, article and staggered block animations, code and inline-code theme colors, code-language labels, all semantic markdownStyles slots, ANSI palette overrides, and opt-in external-link favicons.
`;

export default createPage({
	compiler: { pageId: "engine-markdown-test" },
	schema: {
		theme: { id: "emd-showcase.markdown.dark" },
		meta: { title: "EngineMarkdown complete feature showcase" },
		root: {
			type: "section",
			props: {
				contentMaxWidth: "56rem",
				px: { xs: "1.25rem", md: "2rem" },
				py: { xs: "2rem", md: "3rem" },
			},
			children: [{
				type: "markdown",
				name: "complete-engine-markdown-showcase",
				props: {
					id: "markdown-showcase",
					point: "markdown-showcase-fallback-id",
					className: "markdown-showcase",
					style: {
						padding: "1.5rem",
						backgroundColor: "#ffffff",
						borderRadius: "1rem",
						boxShadow: "0 20px 48px rgba(15, 23, 42, 0.08)",
					},
					cprop: { onHover: { boxShadow: "0 24px 56px rgba(15, 23, 42, 0.14)" } },
					content: MARKDOWN_SHOWCASE,
					textColor: "#334155",
					headingColor: "#10233f",
					linkColor: "#075985",
					mutedColor: "rgba(51, 65, 85, 0.24)",
					fontFamily: { xs: "system-ui, sans-serif", lg: "Georgia, serif" },
					bodySize: "1.025rem",
					bodyLineHeight: 1.8,
					headingSizes: {
						h1: "clamp(2.25rem, 6vw, 3.75rem)",
						h2: "2rem",
						h3: "1.4rem",
						h4: "1.2rem",
						h5: "1.05rem",
						h6: "0.95rem",
					},
					headingIdPrefix: "markdown-showcase",
					disablepointformarkdownhash: false,
					disablepointformarkdownhashhash: false,
					textAnimation: "fade-in",
					blockAnimation: "slide-up",
					animationDuration: "0.45s",
					animationStagger: 12,
					codeBackground: "#111827",
					codeColor: "#e2e8f0",
					inlineCodeBackground: "rgba(14, 116, 144, 0.1)",
					inlineCodeColor: "#0e7490",
					codeBorderColor: "rgba(100, 116, 139, 0.35)",
					codeFontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
					showCodeLanguage: true,
					ansiPalette: { green: "#4ade80", brightRed: "#fb7185" },
					ansiForeground: "#e2e8f0",
					ansiBackground: "#111827",
					"emd_show-url-icon": true,
					"emd_url-icon-size": "auto",
					markdownStyles: {
						heading: { letterSpacing: "-0.025em" },
						paragraph: { lineHeight: 1.85 },
						link: { textDecoration: "underline", textUnderlineOffset: "0.2em" },
						blockquote: { borderLeftWidth: 5, borderRadius: "0 1rem 1rem 0" },
						inlineCode: { borderRadius: "0.4rem" },
						codeBlock: { borderRadius: "1rem", boxShadow: "0 12px 32px #0f172a1a" },
						codeLanguage: { color: "#7dd3fc" },
						table: { minWidth: "100%" },
						tableHeader: { color: "#10233f" },
						tableCell: { padding: "0.8rem 1rem" },
						horizontalRule: { margin: "1rem 0" },
					},
				},
			}, {
				type: "markdown",
				name: "file-loaded-markdown-example",
				props: {
					id: "markdown-file-loading",
					filePath: "./app/engine-markdown-test/file-loading-example.md",
					bodySize: "0.9rem",
					textColor: "#475569",
				},
			}],
		},
	},
});
