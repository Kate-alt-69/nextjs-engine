"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineMarkdown
//
//  Small semantic Markdown renderer for trusted/local documentation content.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useEffect,
	useMemo,
	type CSSProperties,
	type JSX,
	type ReactNode,
} from "react";
import type { MarkdownProps } from "../schema/types";
import { useCpropClass, usePropStyles } from "../hooks/usePropStyles";

const MARKDOWN_STYLE_ID = "__engine_md__";
let mdCSSInjected = false;

function injectMarkdownCSS(): void {
	if (typeof document === "undefined") return;
	if (mdCSSInjected || document.getElementById(MARKDOWN_STYLE_ID)) {
		mdCSSInjected = true;
		return;
	}
	mdCSSInjected = true;
	const style = document.createElement("style");
	style.id = MARKDOWN_STYLE_ID;
	style.textContent = MD_ANIMATION_CSS;
	document.head.appendChild(style);
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

type InlineToken =
	| { type: "text"; text: string }
	| { type: "strong"; text: string }
	| { type: "em"; text: string }
	| { type: "link"; text: string; href: string };

type MarkdownBlock =
	| { type: "heading"; level: number; text: string; id: string }
	| { type: "paragraph"; text: string }
	| { type: "ul"; items: string[] }
	| { type: "ol"; items: string[] }
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

function isSafeHref(href: string): boolean {
	if (!href) return false;
	// Browsers ignore several ASCII control/whitespace characters while parsing
	// URL schemes. Compact them for validation so "java\nscript:" cannot hide.
	const compact = href.replace(/[\u0000-\u0020\u007f]/g, "");
	if (!compact) return false;
	if (compact.startsWith("//") || compact.startsWith("\\")) return false;

	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
	if (scheme) return scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel";
	return true;
}

function parseInline(text: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
	let cursor = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		if (match.index > cursor) tokens.push({ type: "text", text: text.slice(cursor, match.index) });
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

	if (cursor < text.length) tokens.push({ type: "text", text: text.slice(cursor) });
	return tokens;
}

function parseMarkdown(content: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	const lines = content.replace(/\r\n/g, "\n").split("\n");
	const headingCounts = new Map<string, number>();
	let index = 0;

	while (index < lines.length) {
		const line = lines[index].trim();
		if (!line) {
			index++;
			continue;
		}

		if (/^---+$/.test(line)) {
			blocks.push({ type: "hr" });
			index++;
			continue;
		}

		const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
		if (headingMatch) {
			const baseId = slugifyHeading(headingMatch[2]);
			const count = headingCounts.get(baseId) ?? 0;
			headingCounts.set(baseId, count + 1);
			blocks.push({
				type: "heading",
				level: headingMatch[1].length,
				text: headingMatch[2],
				id: count === 0 ? baseId : `${baseId}-${count + 1}`,
			});
			index++;
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
				items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
				index++;
			}
			blocks.push({ type: "ul", items });
			continue;
		}

		if (/^\d+\.\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
				items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
				index++;
			}
			blocks.push({ type: "ol", items });
			continue;
		}

		const paragraph: string[] = [];
		while (
			index < lines.length &&
			lines[index].trim() &&
			!/^#{1,6}\s+/.test(lines[index].trim()) &&
			!/^[-*]\s+/.test(lines[index].trim()) &&
			!/^\d+\.\s+/.test(lines[index].trim()) &&
			!/^---+$/.test(lines[index].trim())
		) {
			paragraph.push(lines[index].trim());
			index++;
		}
		blocks.push({ type: "paragraph", text: paragraph.join(" ") });
	}

	return blocks;
}

function renderInline(tokens: InlineToken[], linkColor: string): ReactNode[] {
	return tokens.map((token, index) => {
		if (token.type === "strong") return <strong key={index}>{token.text}</strong>;
		if (token.type === "em") return <em key={index}>{token.text}</em>;
		if (token.type === "link") {
			const external = /^https?:/i.test(token.href);
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
		"--e-md-dur": duration,
		"--e-md-delay": `${index * stagger}ms`,
	} as CSSProperties;
}

const DEFAULT_HEADING_SIZES: Record<string, string> = {
	h1: "clamp(2rem, 5vw, 3.5rem)",
	h2: "1.75rem",
	h3: "1.25rem",
	h4: "1.1rem",
	h5: "1rem",
	h6: "0.95rem",
};

function isScrollPoint(level: number, disableH1: boolean, disableH2: boolean): boolean {
	if (level === 1) return !disableH1;
	if (level === 2) return !disableH2;
	return true;
}

export const EngineMarkdown = memo(function EngineMarkdown({
	content = "",
	textColor = "#30475f",
	headingColor = "#07111f",
	linkColor = "#12304c",
	mutedColor = "rgba(7,17,31,0.16)",
	fontFamily,
	bodySize = "1rem",
	bodyLineHeight = 1.8,
	headingSizes,
	headingIdPrefix,
	textAnimation,
	blockAnimation,
	animationDuration = "0.4s",
	animationStagger = 50,
	disablepointformarkdownhash = false,
	disablepointformarkdownhashhash = false,
	style,
	className,
	id,
	point,
	cprop,
	...props
}: MarkdownProps) {
	useEffect(() => { injectMarkdownCSS(); }, []);
	const blocks = useMemo(() => parseMarkdown(content), [content]);

	const resolvedStyle = usePropStyles({ ...props, fontFamily } as any, {
		display: "grid",
		gap: "1.25rem",
		color: textColor,
		...style,
	});
	const articleAnimationClass = animClass(textAnimation);
	const stateClass = useCpropClass(cprop);
	const mergedClass = [className, stateClass, articleAnimationClass].filter(Boolean).join(" ") || undefined;
	const resolvedId = id ?? point;
	const articleAnimStyle: CSSProperties = textAnimation && textAnimation !== "none"
		? { "--e-md-dur": animationDuration, "--e-md-delay": "0s" } as CSSProperties
		: {};

	return (
		<article id={resolvedId} style={{ ...resolvedStyle, ...articleAnimStyle }} className={mergedClass}>
			{blocks.map((block, index) => {
				const blockClass = animClass(blockAnimation);
				const blockStyle = blockAnimStyle(index, blockAnimation, animationDuration, animationStagger);

				if (block.type === "hr") {
					return (
						<hr
							key={index}
							className={blockClass || undefined}
							style={{
								...blockStyle,
								width: "100%",
								border: "none",
								borderTop: `1px solid ${mutedColor}`,
								margin: "0.5rem 0",
							}}
						/>
					);
				}

				if (block.type === "heading") {
					const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
					const defaultSize = DEFAULT_HEADING_SIZES[`h${block.level}`] ?? "1rem";
					const size = headingSizes?.[`h${block.level}` as keyof typeof headingSizes] ?? defaultSize;
					const pointEnabled = isScrollPoint(
						block.level,
						disablepointformarkdownhash,
						disablepointformarkdownhashhash,
					);
					const headingId = headingIdPrefix ? `${headingIdPrefix}-${block.id}` : block.id;

					return (
						<Tag
							key={index}
							id={headingId}
							data-scroll-point={pointEnabled ? headingId : undefined}
							className={blockClass || undefined}
							style={{
								...blockStyle,
								color: headingColor,
								fontSize: size,
								lineHeight: 1.18,
								fontWeight: block.level <= 2 ? 900 : 800,
								margin: block.level === 1 ? "0 0 0.5rem" : "1rem 0 0",
								scrollMarginTop: "7rem",
								textAlign: "left",
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
							className={blockClass || undefined}
							style={{
								...blockStyle,
								margin: 0,
								paddingLeft: "1.4rem",
								lineHeight: bodyLineHeight,
								fontSize: bodySize,
							}}
						>
							{block.items.map((item, itemIndex) => (
								<li key={itemIndex}>{renderInline(parseInline(item), linkColor)}</li>
							))}
						</Tag>
					);
				}

				return (
					<p
						key={index}
						className={blockClass || undefined}
						style={{
							...blockStyle,
							margin: 0,
							color: textColor,
							fontSize: bodySize,
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