"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineMarkdown
//
//  Renders a Markdown string as semantic HTML inside an <article>.
//
//  Features:
//    · Parses headings, paragraphs, bold, italic, inline links, lists, <hr>
//    · Per-block staggered animations (fade-in, slide-up) — CSS-only,
//      respects prefers-reduced-motion, injected once on first mount
//    · Article-level animation via textAnimation prop
//    · Full typography control: fontFamily, bodySize, bodyLineHeight,
//      headingSizes, textColor, headingColor, linkColor, mutedColor
//    · Lazy loaded by default when below the fold (via lazyDetect.ts)
//    · Safe href parsing — only http/https/mailto/tel/relative accepted
//
//  EngineScroll integration:
//    · h1 (#) headings are anchor points by default — disable with
//      disablepointformarkdownhash: true
//    · h2 (##) headings are anchor points by default — disable with
//      disablepointformarkdownhashhash: true
//    · All generated heading ids are still present for manual href="#slug"
//      links regardless of these flags.
//
//  Content loading:
//    Inline:    pass `content` — the markdown string
//    From file: pass `filePath` — resolved server-side in createPage before
//               this component ever mounts. The component always gets `content`.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useEffect,
	type CSSProperties,
	type JSX,
	type ReactNode,
} from "react";
import type { MarkdownProps } from "../schema/types";
import { usePropStyles } from "../hooks/usePropStyles";

// ── One-time CSS injection ────────────────────────────────────────────────────

let mdCSSInjected = false;

function injectMarkdownCSS(): void {
	if (typeof document === "undefined" || mdCSSInjected) return;
	mdCSSInjected = true;
	const s = document.createElement("style");
	s.id = "__engine_md__";
	s.textContent = MD_ANIMATION_CSS;
	document.head.appendChild(s);
}

const MD_ANIMATION_CSS = `
@keyframes e-md-fade{from{opacity:0}to{opacity:1}}
@keyframes e-md-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.e-md-anim-fade{animation:e-md-fade var(--e-md-dur,0.4s) ease var(--e-md-delay,0s) both}
.e-md-anim-slide{animation:e-md-slide var(--e-md-dur,0.4s) ease var(--e-md-delay,0s) both}
@media(prefers-reduced-motion:reduce){
  .e-md-anim-fade,.e-md-anim-slide{animation:none!important}
}
`.trim();

// ── Token / block types ───────────────────────────────────────────────────────

type InlineToken =
	| { type: "text";   text: string }
	| { type: "strong"; text: string }
	| { type: "em";     text: string }
	| { type: "link";   text: string; href: string };

type MarkdownBlock =
	| { type: "heading";   level: number; text: string; id: string }
	| { type: "paragraph"; text: string }
	| { type: "ul";        items: string[] }
	| { type: "ol";        items: string[] }
	| { type: "hr" };

function slugifyHeading(text: string): string {
	const plain = text
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_`~]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return plain || "section";
}

// ── Inline parser ─────────────────────────────────────────────────────────────

function isSafeHref(href: string): boolean {
	return /^(https?:\/\/|mailto:|tel:|\/|#)/.test(href);
}

function parseInline(text: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		if (match.index > cursor) {
			tokens.push({ type: "text", text: text.slice(cursor, match.index) });
		}
		const value = match[0];
		const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(value);
		if (link) {
			const href = link[2].trim();
			tokens.push({ type: "link", text: link[1], href: isSafeHref(href) ? href : "#" });
		} else if (value.startsWith("**")) {
			tokens.push({ type: "strong", text: value.slice(2, -2) });
		} else {
			tokens.push({ type: "em", text: value.slice(1, -1) });
		}
		cursor = match.index + value.length;
	}

	if (cursor < text.length) {
		tokens.push({ type: "text", text: text.slice(cursor) });
	}
	return tokens;
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseMarkdown(content: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const headingCounts = new Map<string, number>();
	let i = 0;

	while (i < lines.length) {
		const line = lines[i].trim();

		if (!line) { i++; continue; }

		if (/^---+$/.test(line)) {
			blocks.push({ type: "hr" });
			i++;
			continue;
		}

		const hm = /^(#{1,6})\s+(.+)$/.exec(line);
		if (hm) {
			const baseId = slugifyHeading(hm[2]);
			const count = headingCounts.get(baseId) ?? 0;
			headingCounts.set(baseId, count + 1);
			blocks.push({
				type: "heading",
				level: hm[1].length,
				text: hm[2],
				id: count === 0 ? baseId : `${baseId}-${count + 1}`,
			});
			i++;
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
				items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
				i++;
			}
			blocks.push({ type: "ul", items });
			continue;
		}

		if (/^\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
				items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
				i++;
			}
			blocks.push({ type: "ol", items });
			continue;
		}

		const para: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() &&
			!/^#{1,6}\s+/.test(lines[i].trim()) &&
			!/^[-*]\s+/.test(lines[i].trim()) &&
			!/^\d+\.\s+/.test(lines[i].trim()) &&
			!/^---+$/.test(lines[i].trim())
		) {
			para.push(lines[i].trim());
			i++;
		}
		blocks.push({ type: "paragraph", text: para.join(" ") });
	}

	return blocks;
}

// ── Inline renderer ───────────────────────────────────────────────────────────

function renderInline(tokens: InlineToken[], linkColor: string): ReactNode[] {
	return tokens.map((token, index) => {
		if (token.type === "strong") return <strong key={index}>{token.text}</strong>;
		if (token.type === "em")     return <em     key={index}>{token.text}</em>;
		if (token.type === "link") {
			const external = /^https?:\/\//.test(token.href);
			return (
				<a
					key={index}
					href={token.href}
					target={external ? "_blank" : undefined}
					rel={external ? "noopener noreferrer" : undefined}
					style={{ color: linkColor, fontWeight: 700 }}
				>
					{token.text}
				</a>
			);
		}
		return token.text;
	});
}

// ── Animation helpers ─────────────────────────────────────────────────────────

type AnimKind = "none" | "fade-in" | "slide-up";

function animClass(kind: AnimKind | undefined): string {
	if (!kind || kind === "none") return "";
	return kind === "slide-up" ? "e-md-anim-slide" : "e-md-anim-fade";
}

function blockAnimStyle(
	index: number,
	kind: AnimKind | undefined,
	duration: string,
	stagger: number,
): CSSProperties {
	if (!kind || kind === "none") return {};
	return {
		"--e-md-dur":   duration,
		"--e-md-delay": `${index * stagger}ms`,
	} as CSSProperties;
}

// ── Default heading sizes ─────────────────────────────────────────────────────

const DEFAULT_HEADING_SIZES: Record<string, string> = {
	h1: "clamp(2rem, 5vw, 3.5rem)",
	h2: "1.75rem",
	h3: "1.25rem",
	h4: "1.1rem",
	h5: "1rem",
	h6: "0.95rem",
};

// ── isScrollPoint — decides whether a heading level gets a scroll point id ───

function isScrollPoint(
	level: number,
	disableH1: boolean,
	disableH2: boolean,
): boolean {
	if (level === 1) return !disableH1;
	if (level === 2) return !disableH2;
	// h3-h6: always have ids for anchor links, treated as points
	return true;
}

// ── Main component ────────────────────────────────────────────────────────────

export const EngineMarkdown = memo(function EngineMarkdown({
	content           = "",
	textColor         = "#30475f",
	headingColor      = "#07111f",
	linkColor         = "#12304c",
	mutedColor        = "rgba(7,17,31,0.16)",
	fontFamily,
	bodySize          = "1rem",
	bodyLineHeight    = 1.8,
	headingSizes,
	headingIdPrefix,
	textAnimation,
	blockAnimation,
	animationDuration = "0.4s",
	animationStagger  = 50,
	// EngineScroll flags
	disablepointformarkdownhash      = false,
	disablepointformarkdownhashhash  = false,
	style,
	...props
}: MarkdownProps) {
	useEffect(() => { injectMarkdownCSS(); }, []);

	const blocks = parseMarkdown(content);

	const resolvedStyle = usePropStyles(props as any, {
		display:    "grid",
		gap:        "1.25rem",
		color:      textColor,
		fontFamily: fontFamily ?? undefined,
		...style,
	});

	const articleClass = animClass(textAnimation);
	const articleAnimStyle: CSSProperties = textAnimation && textAnimation !== "none"
		? { "--e-md-dur": animationDuration, "--e-md-delay": "0s" } as CSSProperties
		: {};

	return (
		<article
			style={{ ...resolvedStyle, ...articleAnimStyle }}
			className={articleClass || undefined}
		>
			{blocks.map((block, index) => {
				const bClass = animClass(blockAnimation);
				const bStyle = blockAnimStyle(index, blockAnimation, animationDuration, animationStagger);

				if (block.type === "hr") {
					return (
						<hr
							key={index}
							className={bClass || undefined}
							style={{
								...bStyle,
								width:     "100%",
								border:    "none",
								borderTop: `1px solid ${mutedColor}`,
								margin:    "0.5rem 0",
							}}
						/>
					);
				}

				if (block.type === "heading") {
					const Tag         = `h${block.level}` as keyof JSX.IntrinsicElements;
					const defaultSize = DEFAULT_HEADING_SIZES[`h${block.level}`] ?? "1rem";
					const size        = headingSizes?.[`h${block.level}` as keyof typeof headingSizes] ?? defaultSize;

					// Decide whether this heading is a scroll anchor point.
					// IDs are always generated — the flag only controls data-scroll-point.
					const isPoint  = isScrollPoint(block.level, disablepointformarkdownhash, disablepointformarkdownhashhash);
					const headingId = headingIdPrefix ? `${headingIdPrefix}-${block.id}` : block.id;

					return (
						<Tag
							key={index}
							id={headingId}
							data-scroll-point={isPoint ? headingId : undefined}
							className={bClass || undefined}
							style={{
								...bStyle,
								color:           headingColor,
								fontSize:        size,
								lineHeight:      1.18,
								fontWeight:      block.level <= 2 ? 900 : 800,
								margin:          block.level === 1 ? "0 0 0.5rem" : "1rem 0 0",
								scrollMarginTop: "7rem",
								textAlign:       "left",
							}}
						>
							{renderInline(parseInline(block.text), linkColor)}
						</Tag>
					);
				}

				if (block.type === "ul" || block.type === "ol") {
					const Tag = block.type;
					return (
						<Tag
							key={index}
							className={bClass || undefined}
							style={{
								...bStyle,
								margin:      0,
								paddingLeft: "1.4rem",
								lineHeight:  bodyLineHeight,
								fontSize:    bodySize,
							}}
						>
							{block.items.map((item, ii) => (
								<li key={ii}>{renderInline(parseInline(item), linkColor)}</li>
							))}
						</Tag>
					);
				}

				return (
					<p
						key={index}
						className={bClass || undefined}
						style={{
							...bStyle,
							margin:     0,
							color:      textColor,
							fontSize:   bodySize,
							lineHeight: bodyLineHeight,
						}}
					>
						{renderInline(parseInline(block.text), linkColor)}
					</p>
				);
			})}
		</article>
	);
});
