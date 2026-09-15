"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Engine — EngineMarkdown
//
// Safe CommonMark + GFM documentation rendering. Raw HTML is intentionally not
// executed; Markdown is converted to React elements instead of injected HTML.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	Children,
	cloneElement,
	isValidElement,
	memo,
	useEffect,
	useMemo,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react";
import ReactMarkdown, { type Components, type UrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MarkdownProps } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";
import {
	normalizeEngineMarkdownSource,
	slugifyMarkdownHeading,
} from "../core/markdownParser";

const MARKDOWN_STYLE_ID = "__engine_md__";
let mdCSSInjected = false;

const MD_CSS = `
@keyframes e-md-fade{from{opacity:0}to{opacity:1}}
@keyframes e-md-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.e-md-anim-fade{animation:e-md-fade var(--e-md-dur,0.4s) ease var(--e-md-delay,0s) both}
.e-md-anim-slide{animation:e-md-slide var(--e-md-dur,0.4s) ease var(--e-md-delay,0s) both}
.e-md-code-block>pre>code{display:block;min-width:max-content;background:transparent!important;color:inherit!important;border:0!important;border-radius:0!important;padding:0!important}
.e-md-code-block pre::-webkit-scrollbar,.e-md-table-wrap::-webkit-scrollbar{height:8px}
.e-md-code-block pre::-webkit-scrollbar-thumb,.e-md-table-wrap::-webkit-scrollbar-thumb{background:rgba(148,163,184,.42);border-radius:999px}
.e-md-table-wrap table{border-collapse:collapse;width:100%;min-width:34rem}
.e-md-table-wrap th,.e-md-table-wrap td{border:1px solid var(--e-md-border,rgba(148,163,184,.28));padding:.65rem .8rem;text-align:left;vertical-align:top}
.e-md-table-wrap th{background:var(--e-md-table-head,rgba(148,163,184,.12));font-weight:800}
.e-md-table-wrap tr:nth-child(even) td{background:var(--e-md-table-stripe,rgba(148,163,184,.055))}
.e-md-task-list{list-style:none;padding-left:.2rem!important}
.e-md-task-item{list-style:none}
.e-md-task-item>input{margin-right:.55rem}
@media(prefers-reduced-motion:reduce){
  .e-md-anim-fade,.e-md-anim-slide{animation:none!important}
}
`.trim();

function injectMarkdownCSS(): void {
	if (typeof document === "undefined") return;
	if (mdCSSInjected || document.getElementById(MARKDOWN_STYLE_ID)) {
		mdCSSInjected = true;
		return;
	}
	mdCSSInjected = true;
	const style = document.createElement("style");
	style.id = MARKDOWN_STYLE_ID;
	style.textContent = MD_CSS;
	document.head.appendChild(style);
}

type AnimKind = "none" | "fade-in" | "slide-up";
type PositionedNode = { position?: { start?: { line?: number } } };

interface MarkdownRenderConfig {
	textColor: string;
	headingColor: string;
	linkColor: string;
	mutedColor: string;
	bodySize: string;
	bodyLineHeight: number | string;
	headingSizes?: MarkdownProps["headingSizes"];
	headingIdPrefix?: string;
	disableH1Point: boolean;
	disableH2Point: boolean;
	blockAnimation?: AnimKind;
	animationDuration: string;
	animationStagger: number;
	codeBackground: string;
	codeColor: string;
	inlineCodeBackground: string;
	inlineCodeColor: string;
	codeBorderColor: string;
	codeFontFamily: string;
	showCodeLanguage: boolean;
}

const DEFAULT_HEADING_SIZES: Record<string, string> = {
	h1: "clamp(2rem, 5vw, 3.5rem)",
	h2: "1.75rem",
	h3: "1.25rem",
	h4: "1.1rem",
	h5: "1rem",
	h6: "0.95rem",
};

function joinClassNames(...names: Array<string | undefined>): string | undefined {
	return names.filter(Boolean).join(" ") || undefined;
}

function animClass(kind: AnimKind | undefined): string | undefined {
	if (!kind || kind === "none") return undefined;
	return kind === "slide-up" ? "e-md-anim-slide" : "e-md-anim-fade";
}

function sourceAnimationStyle(node: PositionedNode | undefined, config: MarkdownRenderConfig): CSSProperties {
	if (!config.blockAnimation || config.blockAnimation === "none") return {};
	const sourceIndex = Math.min(20, Math.max(0, (node?.position?.start?.line ?? 1) - 1));
	return {
		"--e-md-dur": config.animationDuration,
		"--e-md-delay": `${sourceIndex * config.animationStagger}ms`,
	} as CSSProperties;
}

function isScrollPoint(level: number, disableH1: boolean, disableH2: boolean): boolean {
	if (level === 1) return !disableH1;
	if (level === 2) return !disableH2;
	return true;
}

function reactNodeText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(reactNodeText).join("");
	if (isValidElement<{ children?: ReactNode }>(node)) return reactNodeText(node.props.children);
	return "";
}

function codeLanguage(children: ReactNode): string | undefined {
	const child = Children.toArray(children)[0];
	if (!isValidElement<{ className?: string }>(child)) return undefined;
	return /(?:^|\s)language-([^\s]+)/.exec(child.props.className ?? "")?.[1];
}

function safeMarkdownUrl(url: string, key: string): string {
	if (!url) return key === "href" ? "#" : "";
	const compact = url.replace(/[\u0000-\u0020\u007f]/g, "");
	if (!compact || compact.startsWith("//") || compact.startsWith("\\")) {
		return key === "href" ? "#" : "";
	}
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
	if (!scheme) return url;
	const allowed = key === "src"
		? scheme === "http" || scheme === "https"
		: scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel";
	return allowed ? url : key === "href" ? "#" : "";
}

const markdownUrlTransform: UrlTransform = (url, key) => safeMarkdownUrl(url, key);

function createMarkdownComponents(config: MarkdownRenderConfig): Components {
	const headingCounts = new Map<string, number>();
	const blockClass = animClass(config.blockAnimation);

	function renderHeading(
		level: 1 | 2 | 3 | 4 | 5 | 6,
		node: PositionedNode | undefined,
		children: ReactNode,
		props: React.HTMLAttributes<HTMLHeadingElement>,
	): ReactElement {
		const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
		const baseId = slugifyMarkdownHeading(reactNodeText(children));
		const count = headingCounts.get(baseId) ?? 0;
		headingCounts.set(baseId, count + 1);
		const uniqueId = count === 0 ? baseId : `${baseId}-${count + 1}`;
		const headingId = config.headingIdPrefix ? `${config.headingIdPrefix}-${uniqueId}` : uniqueId;
		const pointEnabled = isScrollPoint(level, config.disableH1Point, config.disableH2Point);

		return (
			<Tag
				{...props}
				id={headingId}
				data-scroll-point={pointEnabled ? headingId : undefined}
				className={joinClassNames(props.className, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					color: config.headingColor,
					fontSize: config.headingSizes?.[`h${level}`] ?? DEFAULT_HEADING_SIZES[`h${level}`],
					lineHeight: 1.18,
					fontWeight: level <= 2 ? 900 : 800,
					margin: level === 1 ? "0 0 0.5rem" : "1rem 0 0",
					scrollMarginTop: "7rem",
					textAlign: "left",
					...props.style,
				}}
			>
				{children}
			</Tag>
		);
	}

	return {
		h1: ({ node, children, ...props }) => renderHeading(1, node, children, props),
		h2: ({ node, children, ...props }) => renderHeading(2, node, children, props),
		h3: ({ node, children, ...props }) => renderHeading(3, node, children, props),
		h4: ({ node, children, ...props }) => renderHeading(4, node, children, props),
		h5: ({ node, children, ...props }) => renderHeading(5, node, children, props),
		h6: ({ node, children, ...props }) => renderHeading(6, node, children, props),
		p: ({ node, className, style, ...props }) => (
			<p
				{...props}
				className={joinClassNames(className, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					margin: 0,
					color: config.textColor,
					fontSize: config.bodySize,
					lineHeight: config.bodyLineHeight,
					overflowWrap: "anywhere",
					...style,
				}}
			/>
		),
		a: ({ node: _node, href = "#", className, style, ...props }) => {
			const safeHref = safeMarkdownUrl(href, "href");
			const external = /^https?:/i.test(safeHref);
			return (
				<a
					{...props}
					href={safeHref}
					target={external ? "_blank" : undefined}
					rel={external ? "noopener noreferrer" : undefined}
					className={className}
					style={{ color: config.linkColor, fontWeight: 700, overflowWrap: "anywhere", ...style }}
				/>
			);
		},
		ul: ({ node, className, style, ...props }) => (
			<ul
				{...props}
				className={joinClassNames(className, className?.includes("contains-task-list") ? "e-md-task-list" : undefined, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					margin: 0,
					paddingLeft: "1.4rem",
					fontSize: config.bodySize,
					lineHeight: config.bodyLineHeight,
					...style,
				}}
			/>
		),
		ol: ({ node, className, style, ...props }) => (
			<ol
				{...props}
				className={joinClassNames(className, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					margin: 0,
					paddingLeft: "1.55rem",
					fontSize: config.bodySize,
					lineHeight: config.bodyLineHeight,
					...style,
				}}
			/>
		),
		li: ({ node: _node, className, style, ...props }) => (
			<li
				{...props}
				className={joinClassNames(className, className?.includes("task-list-item") ? "e-md-task-item" : undefined)}
				style={{ margin: ".18rem 0", ...style }}
			/>
		),
		blockquote: ({ node, className, style, ...props }) => (
			<blockquote
				{...props}
				className={joinClassNames(className, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					margin: 0,
					padding: ".75rem 1rem",
					borderLeft: `4px solid ${config.linkColor}`,
					background: "rgba(148,163,184,.08)",
					borderRadius: "0 .5rem .5rem 0",
					color: config.textColor,
					...style,
				}}
			/>
		),
		code: ({ node: _node, className, style, ...props }) => (
			<code
				{...props}
				className={joinClassNames(className, "e-md-code", className ? undefined : "e-md-inline-code")}
				style={{
					fontFamily: config.codeFontFamily,
					fontSize: "0.9em",
					background: config.inlineCodeBackground,
					color: config.inlineCodeColor,
					border: `1px solid ${config.codeBorderColor}`,
					borderRadius: ".3rem",
					padding: ".12em .35em",
					...style,
				}}
			/>
		),
		pre: ({ node, children }) => {
			const language = codeLanguage(children);
			const codeChildren = Children.map(children, (child) => {
				if (!isValidElement<{ style?: CSSProperties }>(child)) return child;
				return cloneElement(child, {
					style: {
						...child.props.style,
						display: "block",
						minWidth: "max-content",
						padding: 0,
						border: 0,
						borderRadius: 0,
						background: "transparent",
						color: "inherit",
					},
				});
			});
			return (
				<figure
					className={joinClassNames("e-md-code-block", blockClass)}
					data-language={language}
					style={{
						...sourceAnimationStyle(node, config),
						margin: 0,
						minWidth: 0,
						maxWidth: "100%",
						border: `1px solid ${config.codeBorderColor}`,
						borderRadius: ".75rem",
						overflow: "hidden",
						background: config.codeBackground,
						color: config.codeColor,
					}}
				>
					{language && config.showCodeLanguage ? (
						<figcaption style={{
							padding: ".45rem .85rem",
							borderBottom: `1px solid ${config.codeBorderColor}`,
							fontFamily: config.codeFontFamily,
							fontSize: ".72rem",
							fontWeight: 800,
							letterSpacing: ".08em",
							textTransform: "uppercase",
							color: "rgba(226,232,240,.72)",
						}}>{language}</figcaption>
					) : null}
					<pre style={{
						margin: 0,
						padding: "1rem",
						overflowX: "auto",
						overflowY: "hidden",
						maxWidth: "100%",
						whiteSpace: "pre",
						tabSize: 4,
						fontFamily: config.codeFontFamily,
						fontSize: ".88rem",
						lineHeight: 1.65,
						WebkitOverflowScrolling: "touch",
					}}>{codeChildren}</pre>
				</figure>
			);
		},
		table: ({ node, children }) => (
			<div
				className={joinClassNames("e-md-table-wrap", blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					maxWidth: "100%",
					overflowX: "auto",
					borderRadius: ".65rem",
				}}
			>
				<table>{children}</table>
			</div>
		),
		img: ({ node: _node, src = "", alt = "", className, style, ...props }) => (
			<img
				{...props}
				src={safeMarkdownUrl(typeof src === "string" ? src : "", "src")}
				alt={alt}
				loading="lazy"
				className={className}
				style={{ display: "block", maxWidth: "100%", height: "auto", borderRadius: ".65rem", ...style }}
			/>
		),
		hr: ({ node, className, style, ...props }) => (
			<hr
				{...props}
				className={joinClassNames(className, blockClass)}
				style={{
					...sourceAnimationStyle(node, config),
					width: "100%",
					border: "none",
					borderTop: `1px solid ${config.mutedColor}`,
					margin: ".5rem 0",
					...style,
				}}
			/>
		),
		input: ({ node: _node, style, ...props }) => (
			<input {...props} style={{ accentColor: config.linkColor, ...style }} />
		),
	};
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
	codeBackground = "#0b1020",
	codeColor = "#e6edf3",
	inlineCodeBackground = "rgba(148,163,184,.14)",
	inlineCodeColor = headingColor,
	codeBorderColor = "rgba(148,163,184,.28)",
	codeFontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
	showCodeLanguage = true,
	style,
	className,
	id,
	point,
	cprop,
	...props
}: MarkdownProps) {
	useEffect(() => { injectMarkdownCSS(); }, []);
	const normalizedContent = useMemo(() => normalizeEngineMarkdownSource(content), [content]);
	const renderConfig: MarkdownRenderConfig = {
		textColor,
		headingColor,
		linkColor,
		mutedColor,
		bodySize,
		bodyLineHeight,
		headingSizes,
		headingIdPrefix,
		disableH1Point: disablepointformarkdownhash,
		disableH2Point: disablepointformarkdownhashhash,
		blockAnimation,
		animationDuration,
		animationStagger,
		codeBackground,
		codeColor,
		inlineCodeBackground,
		inlineCodeColor,
		codeBorderColor,
		codeFontFamily,
		showCodeLanguage,
	};
	const components = createMarkdownComponents(renderConfig);
	const resolvedStyle = usePrimitiveStyles(
		{ ...props, fontFamily } as never,
		{
			defaults: {
				display: "grid",
				gap: "1.25rem",
				minWidth: 0,
				color: textColor,
			},
			style,
		},
	);
	const articleAnimationClass = animClass(textAnimation);
	const stateClass = useCpropClass(cprop);
	const mergedClass = joinClassNames(className, stateClass, articleAnimationClass);
	const resolvedId = id ?? point;
	const articleAnimStyle = {
		"--e-md-border": codeBorderColor,
		...(textAnimation && textAnimation !== "none"
			? { "--e-md-dur": animationDuration, "--e-md-delay": "0s" }
			: {}),
	} as CSSProperties;

	return (
		<article id={resolvedId} style={{ ...resolvedStyle, ...articleAnimStyle }} className={mergedClass}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={components}
				urlTransform={markdownUrlTransform}
				skipHtml
			>
				{normalizedContent}
			</ReactMarkdown>
		</article>
	);
});
