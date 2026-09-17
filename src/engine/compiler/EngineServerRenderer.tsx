// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server-first renderer
// ─────────────────────────────────────────────────────────────────────────────

import React, { type CSSProperties, type ElementType, type ReactNode } from "react";
import NextImage, { getImageProps } from "next/image";
import NextLink from "next/link";
import {
	BREAKPOINTS,
	BREAKPOINT_ORDER,
	type Breakpoint,
	type EngineConfig,
	type EngineStyleObject,
	type MarkdownProps,
	type PageSchema,
	type SchemaNode,
	type TextVariant,
} from "../schema/types";
import { StyleCollector } from "../core/StyleCollector";
import type { EngineCompiledNode, EngineCompiledPage } from "./types";
import {
	compileCpropClass,
	compileEngineStyles,
	compilePrimitiveStyles,
} from "./EngineStyleCompiler";
import { EngineClientIsland } from "./EngineClientIsland";
import { compileEngineDebugAttributes } from "./EngineDebugMetadata";
import {
	ENGINE_MARKDOWN_CSS,
	EngineMarkdownRenderer,
} from "../components/EngineMarkdownRenderer";

export interface EngineServerRendererProps {
	schema: PageSchema;
	plan: EngineCompiledPage;
	config?: EngineConfig;
	slots?: Record<string, ReactNode>;
}

const TEXT_TAGS: Record<TextVariant, ElementType> = {
	h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6",
	body: "p", "body-sm": "p", lead: "p", caption: "span", label: "label", mono: "code", overline: "span",
};

const TEXT_STYLES: Record<TextVariant, CSSProperties> = {
	h1: { fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" },
	h2: { fontSize: "clamp(1.5rem, 4vw, 2.5rem)", fontWeight: 700, lineHeight: 1.2 },
	h3: { fontSize: "clamp(1.25rem, 3vw, 1.875rem)", fontWeight: 600, lineHeight: 1.3 },
	h4: { fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", fontWeight: 600, lineHeight: 1.4 },
	h5: { fontSize: "1.125rem", fontWeight: 600 },
	h6: { fontSize: "1rem", fontWeight: 600 },
	body: { fontSize: "1rem", lineHeight: 1.6 },
	"body-sm": { fontSize: "0.875rem", lineHeight: 1.6 },
	lead: { fontSize: "1.25rem", lineHeight: 1.7, fontWeight: 400 },
	caption: { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--e-caption-color, #64748b)" },
	label: { fontSize: "0.875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
	mono: { fontFamily: "var(--e-font-mono, monospace)", fontSize: "0.9em", background: "var(--e-code-bg, rgba(0,0,0,.06))", padding: "0.1em 0.3em", borderRadius: "4px" },
	overline: { fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" },
};

const BUTTON_BASE: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "0.5rem",
	border: "none",
	fontFamily: "inherit",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
	userSelect: "none",
};

const BUTTON_SIZES: Record<string, CSSProperties> = {
	xs: { fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: "6px" },
	sm: { fontSize: "0.875rem", padding: "0.5rem 1rem", borderRadius: "6px" },
	md: { fontSize: "1rem", padding: "0.625rem 1.5rem", borderRadius: "8px" },
	lg: { fontSize: "1.125rem", padding: "0.75rem 2rem", borderRadius: "10px" },
	xl: { fontSize: "1.25rem", padding: "1rem 2.5rem", borderRadius: "12px" },
};

const IMAGE_QUALITY_PRESET: Record<string, number> = {
	performance: 65,
	balanced: 78,
	sharp: 90,
};

const SERVER_RENDERED_TYPES = new Set([
	"box", "stack", "grid", "text", "heading", "section", "hero", "card", "button",
	"link", "EngineLink", "spacer", "divider", "option", "optgroup", "label", "slot", "image", "markdown",
]);

function shortHash(value: string): string {
	let hash = 5381;
	for (let index = 0; index < value.length; index += 1) {
		hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36).slice(0, 7);
}

function explicitStyle(props: Record<string, unknown>): EngineStyleObject | undefined {
	const value = props.style;
	return value != null && typeof value === "object" && !Array.isArray(value)
		? value as EngineStyleObject
		: undefined;
}

function visibilityClass(
	props: Record<string, unknown>,
	collector: StyleCollector,
): string | undefined {
	const hideOn = Array.isArray(props.hideOn) ? props.hideOn as Breakpoint[] : [];
	const showOnly = Array.isArray(props.showOnly) ? props.showOnly as Breakpoint[] : [];
	if (hideOn.length === 0 && showOnly.length === 0) return undefined;

	const hidden = BREAKPOINT_ORDER.filter((breakpoint) => (
		(showOnly.length > 0 && !showOnly.includes(breakpoint))
		|| hideOn.includes(breakpoint)
	));
	if (hidden.length === 0) return undefined;

	const className = `e-v-${shortHash(hidden.join("|"))}`;
	for (const breakpoint of hidden) {
		const index = BREAKPOINT_ORDER.indexOf(breakpoint);
		const min = BREAKPOINTS[breakpoint];
		const next = BREAKPOINT_ORDER[index + 1];
		const max = next ? BREAKPOINTS[next] - 0.02 : undefined;
		const rule = `.${className}{display:none!important}`;
		collector.add(min === 0 && max !== undefined
			? `@media(max-width:${max}px){${rule}}`
			: max === undefined
				? `@media(min-width:${min}px){${rule}}`
				: `@media(min-width:${min}px) and (max-width:${max}px){${rule}}`);
	}
	return className;
}

function mergePropsClassName(
	props: Record<string, unknown>,
	collector: StyleCollector,
): string | undefined {
	return [
		typeof props.className === "string" ? props.className : undefined,
		compileCpropClass(props.cprop as any, collector),
		visibilityClass(props, collector),
	].filter(Boolean).join(" ") || undefined;
}

function mergeClassName(node: SchemaNode, collector: StyleCollector): string | undefined {
	return mergePropsClassName(node.props ?? {}, collector);
}

function wrapHref(href: unknown, child: ReactNode): ReactNode {
	if (typeof href !== "string" || href.length === 0) return child;
	const external = /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
	return external
		? <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "contents", color: "inherit", textDecoration: "none" }}>{child}</a>
		: <NextLink href={href} style={{ display: "contents", color: "inherit", textDecoration: "none" }}>{child}</NextLink>;
}

function renderTextContent(
	props: Record<string, unknown>,
	children: ReactNode,
): ReactNode {
	const parts = Array.isArray(props.parts) ? props.parts as Array<Record<string, unknown>> : [];
	if (parts.length > 0) {
		return parts.map((part, index) => {
			const text = String(part.text ?? "");
			if (typeof part.href === "string") {
				const external = /^https?:\/\//i.test(part.href);
				const target = (part.target as string | undefined) ?? (external ? "_blank" : "_self");
				const rel = (part.rel as string | undefined) ?? (target === "_blank" || external ? "noopener noreferrer" : undefined);
				return <a key={index} href={part.href} target={target} rel={rel} style={part.style as CSSProperties | undefined}>{text}</a>;
			}
			return part.style
				? <span key={index} style={part.style as CSSProperties}>{text}</span>
				: text;
		});
	}
	return props.content !== undefined ? String(props.content) : children;
}

function textDerivedStyles(props: Record<string, unknown>): CSSProperties {
	const truncate = props.truncate;
	const truncateStyle: CSSProperties = truncate === true
		? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
		: typeof truncate === "number"
			? {
				overflow: "hidden",
				display: "-webkit-box",
				WebkitLineClamp: truncate,
				WebkitBoxOrient: "vertical",
			}
			: {};
	const gradientStyle: CSSProperties = typeof props.gradient === "string"
		? {
			backgroundImage: props.gradient,
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
		}
		: {};
	return {
		...(props.italic === true ? { fontStyle: "italic" } : {}),
		...(props.underline === true ? { textDecoration: "underline" } : {}),
		...truncateStyle,
		...gradientStyle,
	};
}

function normalizeStackDirection(direction: unknown): unknown {
	if (direction != null && typeof direction === "object" && !Array.isArray(direction)) {
		return Object.fromEntries(
			Object.entries(direction as Record<string, unknown>).map(([breakpoint, value]) => [
				breakpoint,
				value === "horizontal" ? "row" : "column",
			]),
		);
	}
	return direction === "horizontal" ? "row" : "column";
}

function normalizeFullWidth(value: unknown): unknown {
	if (value === undefined) return undefined;
	if (typeof value === "boolean") return value ? "100%" : "auto";
	if (value != null && typeof value === "object" && !Array.isArray(value)) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([breakpoint, enabled]) => [
				breakpoint,
				enabled ? "100%" : "auto",
			]),
		);
	}
	return undefined;
}

function buttonDefaults(props: Record<string, unknown>): CSSProperties {
	const variant = String(props.variant ?? "solid");
	const accent = String(props.accentColor ?? "var(--e-accent, #4f46e5)");
	const variantStyle: CSSProperties = variant === "solid"
		? { background: accent, color: "#fff" }
		: variant === "outline"
			? { background: "transparent", color: accent, border: `2px solid ${accent}` }
			: variant === "ghost"
				? { background: "transparent", color: accent }
				: variant === "elevated"
					? { background: accent, color: "#fff", boxShadow: `0 4px 14px ${accent}55` }
					: { background: "transparent", color: accent, textDecoration: "underline", padding: 0 };
	return {
		...BUTTON_BASE,
		...(BUTTON_SIZES[String(props.size ?? "md")] ?? BUTTON_SIZES.md),
		...variantStyle,
	};
}

function imageSizes(fill: boolean, width: number | undefined): string {
	if (fill || !width) return "100vw";
	return `(max-width: 480px) 100vw, (max-width: 768px) calc(100vw - 2rem), ${width}px`;
}

function renderServerImage(
	compiled: EngineCompiledNode,
	props: Record<string, unknown>,
	collector: StyleCollector,
): ReactNode {
	if (typeof props.src !== "string" || typeof props.alt !== "string") return null;

	const debug = compileEngineDebugAttributes(compiled);
	const className = mergePropsClassName(props, collector);
	const fill = props.fill === true;
	const width = typeof props.width === "number" ? props.width : undefined;
	const height = typeof props.height === "number" ? props.height : undefined;
	const resolvedWidth = width ?? 800;
	const resolvedHeight = height ?? 600;
	const sizes = typeof props.sizes === "string" ? props.sizes : imageSizes(fill, width);
	const qualityPreset = typeof props.qualityPreset === "string" ? props.qualityPreset : "balanced";
	const quality = typeof props.quality === "number"
		? props.quality
		: IMAGE_QUALITY_PRESET[qualityPreset] ?? IMAGE_QUALITY_PRESET.balanced;
	const mobileQuality = typeof props.qualityMobile === "number" ? props.qualityMobile : quality;
	const desktopQuality = typeof props.qualityDesktop === "number" ? props.qualityDesktop : quality;
	const usePerViewportQuality = props.qualityMobile !== undefined || props.qualityDesktop !== undefined;
	const aspectRatio = typeof props.aspectRatio === "string"
		? props.aspectRatio
		: !fill && width && height && height > 0
			? `${width} / ${height}`
			: undefined;
	const rounded = props.rounded === true
		? "8px"
		: typeof props.rounded === "string"
			? props.rounded
			: undefined;
	const wrapperUserStyle = compileEngineStyles({}, collector, explicitStyle(props));
	const wrapperStyle: CSSProperties = {
		position: "relative",
		overflow: "hidden",
		borderRadius: rounded,
		contain: "layout paint",
		...(aspectRatio && !fill ? { aspectRatio, width: "100%" } : {}),
		...(fill ? { width: "100%", height: "100%" } : {}),
		...wrapperUserStyle,
	};
	const imageStyle: CSSProperties = {
		...(!fill ? {
			width: "100%",
			height: aspectRatio ? "100%" : "auto",
		} : {}),
		objectFit: (props.objectFit as CSSProperties["objectFit"] | undefined) ?? "cover",
		display: "block",
	};
	const blurDataURL = typeof props.blurDataURL === "string" ? props.blurDataURL : undefined;
	const sizing = fill
		? { fill: true as const }
		: { width: resolvedWidth, height: resolvedHeight };
	const commonProps = {
		src: props.src,
		alt: props.alt,
		sizes,
		priority: props.priority === true,
		...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {}),
		...sizing,
	};

	let image: ReactNode;
	if (usePerViewportQuality) {
		const mobile = getImageProps({ ...commonProps, quality: mobileQuality });
		const desktop = getImageProps({ ...commonProps, quality: desktopQuality });
		const generatedStyle = desktop.props.style as CSSProperties | undefined;
		image = (
			<picture style={{ display: "block", width: "100%", height: fill || aspectRatio ? "100%" : "auto" }}>
				<source media="(max-width: 767px)" srcSet={mobile.props.srcSet} sizes={mobile.props.sizes} />
				<source media="(min-width: 768px)" srcSet={desktop.props.srcSet} sizes={desktop.props.sizes} />
				<img {...desktop.props} style={{ ...generatedStyle, ...imageStyle }} />
			</picture>
		);
	} else {
		image = <NextImage {...commonProps} quality={quality} style={imageStyle} />;
	}

	const wrapper = (
		<div key={compiled.id} {...debug} className={className} style={wrapperStyle}>
			{image}
		</div>
	);
	if (typeof props.caption !== "string") return wrapper;
	return (
		<figure key={compiled.id} style={{ margin: 0, padding: 0 }}>
			{wrapper}
			<figcaption style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--e-caption-color, #64748b)", marginTop: "0.5rem" }}>
				{props.caption}
			</figcaption>
		</figure>
	);
}

function renderServerNode(
	compiled: EngineCompiledNode,
	collector: StyleCollector,
	config: EngineConfig | undefined,
	slots: Record<string, ReactNode> | undefined,
): ReactNode {
	const node = compiled.source;
	const props = node.props ?? {};
	const debug = compileEngineDebugAttributes(compiled);

	const renderChildren = (): ReactNode => {
		if (typeof node.children === "string") return node.children;
		return compiled.children.map((child) => renderServerNode(child, collector, config, slots));
	};

	if (compiled.runtime === "client" || !SERVER_RENDERED_TYPES.has(String(node.type))) {
		const children = renderChildren();
		return (
			<EngineClientIsland
				key={compiled.id}
				node={{ ...node, children: undefined }}
				config={config}
				slots={slots}
				debug={debug}
			>
				{children}
			</EngineClientIsland>
		);
	}

	if (node.type === "slot") {
		const name = typeof props.name === "string" ? props.name : "";
		const slotContent = slots?.[name];
		if (slotContent != null) return <React.Fragment key={compiled.id}>{slotContent}</React.Fragment>;
		const fallback = compiled.children[0];
		return (
			<React.Fragment key={compiled.id}>
				{fallback ? renderServerNode(fallback, collector, config, slots) : null}
			</React.Fragment>
		);
	}

	const children = renderChildren();
	const className = mergeClassName(node, collector);
	const id = typeof props.id === "string"
		? props.id
		: typeof props.point === "string"
			? props.point
			: undefined;
	const userStyle = explicitStyle(props);
	const style = compileEngineStyles(props as any, collector, userStyle);

	switch (node.type) {
		case "box": {
			const Tag = (typeof props.as === "string" ? props.as : "div") as ElementType;
			return wrapHref(
				props.href,
				<Tag key={compiled.id} {...debug} id={id} className={className} style={style}>{children}</Tag>,
			);
		}

		case "stack": {
			const stackProps = { ...props };
			delete stackProps.direction;
			delete stackProps.wrap;
			delete stackProps.dividers;
			delete stackProps.style;
			const stackStyle = compilePrimitiveStyles(
				{
					...stackProps,
					flexDir: normalizeStackDirection(props.direction),
				},
				collector,
				{
					defaults: { display: "flex" },
					derived: props.wrap === true ? { flexWrap: "wrap" } : undefined,
					style: userStyle,
				},
			);
			const items = React.Children.toArray(children);
			return wrapHref(
				props.href,
				<div key={compiled.id} {...debug} id={id} className={className} style={stackStyle}>
					{props.dividers === true
						? items.map((child, index) => (
							<React.Fragment key={index}>
								{child}
								{index < items.length - 1 ? (
									<hr style={{ border: "none", borderTop: "1px solid var(--e-divider, rgba(0,0,0,.1))", margin: 0 }} />
								) : null}
							</React.Fragment>
						))
						: children}
				</div>,
			);
		}

		case "grid": {
			const gridProps = { ...props };
			delete gridProps.autoFit;
			delete gridProps.minColWidth;
			delete gridProps.style;
			const columns = props.autoFit === true
				? `repeat(auto-fit, minmax(${String(props.minColWidth ?? "200px")}, 1fr))`
				: props.columns ?? 1;
			const gridStyle = compilePrimitiveStyles(
				{ ...gridProps, columns },
				collector,
				{ defaults: { display: "grid" }, style: userStyle },
			);
			return wrapHref(
				props.href,
				<div key={compiled.id} {...debug} id={id} className={className} style={gridStyle}>{children}</div>,
			);
		}

		case "text": {
			const variant = (props.variant ?? "body") as TextVariant;
			const Tag = (typeof props.as === "string" ? props.as : TEXT_TAGS[variant] ?? "p") as ElementType;
			const textStyle = compilePrimitiveStyles(
				props as any,
				collector,
				{
					defaults: TEXT_STYLES[variant],
					derived: textDerivedStyles(props),
					style: userStyle,
				},
			);
			return wrapHref(
				props.href,
				<Tag key={compiled.id} {...debug} id={id} className={className} style={textStyle}>
					{renderTextContent(props, children)}
				</Tag>,
			);
		}

		case "heading": {
			const level = Math.min(6, Math.max(1, Number(props.level ?? 2))) as 1 | 2 | 3 | 4 | 5 | 6;
			const variant = `h${level}` as TextVariant;
			const Tag = `h${level}` as ElementType;
			const headingStyle = compilePrimitiveStyles(
				props as any,
				collector,
				{
					defaults: TEXT_STYLES[variant],
					derived: textDerivedStyles(props),
					style: userStyle,
				},
			);
			const heading = wrapHref(
				props.href,
				<Tag {...debug} id={id} className={className} style={headingStyle}>
					{renderTextContent(props, children)}
				</Tag>,
			);
			const subheadingProps = props.subheadingProps != null
				&& typeof props.subheadingProps === "object"
				&& !Array.isArray(props.subheadingProps)
				? props.subheadingProps as Record<string, unknown>
				: {};
			const subheadingInput = {
				color: "var(--e-muted, #64748b)",
				mt: "0.5rem",
				...subheadingProps,
			};
			const subheadingVariant = (subheadingInput.variant ?? "lead") as TextVariant;
			const SubheadingTag = (
				typeof subheadingInput.as === "string"
					? subheadingInput.as
					: TEXT_TAGS[subheadingVariant] ?? "p"
			) as ElementType;
			const subheadingStyle = compilePrimitiveStyles(
				subheadingInput as any,
				collector,
				{
					defaults: TEXT_STYLES[subheadingVariant],
					derived: textDerivedStyles(subheadingInput),
					style: explicitStyle(subheadingInput),
				},
			);
			const subheadingClassName = mergePropsClassName(subheadingInput, collector);
			const subheadingId = typeof subheadingInput.id === "string"
				? subheadingInput.id
				: typeof subheadingInput.point === "string"
					? subheadingInput.point
					: undefined;
			const subheading = typeof props.subheading === "string"
				? wrapHref(
					subheadingInput.href,
					<SubheadingTag id={subheadingId} className={subheadingClassName} style={subheadingStyle}>
						{renderTextContent(subheadingInput, props.subheading)}
					</SubheadingTag>,
				)
				: null;
			return <React.Fragment key={compiled.id}>{heading}{subheading}</React.Fragment>;
		}

		case "section": {
			const sectionProps = { ...props };
			delete sectionProps.px;
			delete sectionProps.py;
			delete sectionProps.style;
			const outer = compilePrimitiveStyles(
				sectionProps,
				collector,
				{
					defaults: { width: "100%" },
					derived: {
						...(props.fullViewport === true ? { minHeight: "100svh" } : {}),
						...(props.snapAlign ? { scrollSnapAlign: props.snapAlign as CSSProperties["scrollSnapAlign"] } : {}),
					},
					style: userStyle,
				},
			);
			const inner = compileEngineStyles(
				{
					maxW: props.contentMaxWidth ?? "1200px",
					px: props.px ?? "1.5rem",
					py: props.py ?? "4rem",
				},
				collector,
				{
					width: "100%",
					...(props.centered !== false ? { marginLeft: "auto", marginRight: "auto" } : {}),
				},
			);
			return wrapHref(
				props.href,
				<section key={compiled.id} {...debug} id={id} className={className} style={outer}>
					<div style={inner}>{children}</div>
				</section>,
			);
		}

		case "hero": {
			const variant = String(props.variant ?? "centered");
			const outerProps = { ...props };
			for (const key of [
				"variant", "overlay", "parallax", "contentMaxWidth", "centered",
				"fullViewport", "snapAlign", "px", "py", "style",
			]) delete outerProps[key];
			if (props.backgroundImage) {
				outerProps.backgroundImage = props.backgroundImage;
				outerProps.backgroundSize = props.backgroundSize ?? "cover";
				outerProps.backgroundPosition = props.backgroundPosition ?? "center";
				outerProps.backgroundRepeat = props.backgroundRepeat ?? "no-repeat";
			}
			const outer = compilePrimitiveStyles(
				outerProps,
				collector,
				{
					defaults: { position: "relative", width: "100%", overflow: "hidden" },
					derived: {
						...(props.fullViewport !== false ? { minHeight: "100svh" } : {}),
						...(props.snapAlign ? { scrollSnapAlign: props.snapAlign as CSSProperties["scrollSnapAlign"] } : {}),
					},
					style: userStyle,
				},
			);
			const inner = compileEngineStyles(
				{
					px: props.px ?? (variant === "fullbleed" ? "0" : "1.5rem"),
					py: props.py ?? "6rem",
					...(variant !== "fullbleed" ? { maxW: props.contentMaxWidth ?? "1200px" } : {}),
					...(variant === "split" ? {
						columns: { xs: 1, md: 2 },
						gap: { xs: "2rem", lg: "4rem" },
					} : {}),
				},
				collector,
				{
					position: "relative",
					zIndex: 1,
					width: "100%",
					...(props.centered !== false && variant !== "fullbleed" ? { marginLeft: "auto", marginRight: "auto" } : {}),
					...(variant === "centered" ? { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" } : {}),
					...(variant === "split" ? { display: "grid", alignItems: "center" } : {}),
				},
			);
			const hero = (
				<section key={compiled.id} {...debug} id={id} className={className} style={outer}>
					{typeof props.overlay === "string" ? (
						<div aria-hidden="true" style={{ position: "absolute", inset: 0, background: props.overlay, zIndex: 0, pointerEvents: "none" }} />
					) : null}
					<div style={inner}>{children}</div>
				</section>
			);
			return wrapHref(props.href, hero);
		}

		case "card": {
			const direction = props.direction === "horizontal" ? "row" : "column";
			const variant = String(props.variant ?? "elevated");
			const variantStyle: CSSProperties = variant === "elevated"
				? { background: "var(--e-card-bg, #fff)", boxShadow: "0 2px 12px rgba(0,0,0,.08)" }
				: variant === "outlined"
					? { background: "var(--e-card-bg, #fff)", border: "1px solid var(--e-border, rgba(0,0,0,.12))" }
					: variant === "filled"
						? { background: "var(--e-card-filled, #f8fafc)" }
						: { background: "var(--e-card-bg, #fff)" };
			const cardProps = { ...props };
			for (const key of [
				"variant", "interactive", "cover", "coverAlt", "coverRatio", "coverFit",
				"coverClassName", "direction", "innerPadding", "coverWidth", "style",
			]) delete cardProps[key];
			const cardStyle = compilePrimitiveStyles(
				cardProps,
				collector,
				{
					defaults: {
						borderRadius: "12px",
						overflow: "hidden",
						display: "flex",
						flexDirection: direction,
						...variantStyle,
					},
					style: userStyle,
				},
			);
			const horizontal = direction === "row";
			const cover = typeof props.cover === "string" ? (
				<div
					style={{
						flexShrink: 0,
						width: horizontal ? String(props.coverWidth ?? "40%") : "100%",
						aspectRatio: horizontal ? undefined : String(props.coverRatio ?? "16/9"),
						minHeight: horizontal ? "100%" : undefined,
						overflow: "hidden",
						position: "relative",
					}}
				>
					<img
						src={props.cover}
						alt={String(props.coverAlt ?? "")}
						className={typeof props.coverClassName === "string" ? props.coverClassName : undefined}
						style={{
							width: "100%",
							height: "100%",
							objectFit: (props.coverFit as CSSProperties["objectFit"] | undefined) ?? "cover",
							display: "block",
							position: horizontal ? "absolute" : "static",
							top: horizontal ? 0 : undefined,
							left: horizontal ? 0 : undefined,
						}}
					/>
				</div>
			) : null;
			const content = (
				<div style={{ flex: 1, padding: String(props.innerPadding ?? "1.25rem"), display: "flex", flexDirection: "column", minWidth: 0 }}>
					{children}
				</div>
			);
			return wrapHref(
				props.href,
				<div key={compiled.id} {...debug} id={id} className={className} style={cardStyle}>
					{cover}
					{content}
				</div>,
			);
		}

		case "button": {
			const buttonProps = { ...props };
			for (const key of [
				"variant", "size", "accentColor", "label", "icon", "iconPosition",
				"disabled", "fullWidth", "loading", "type", "href", "style",
			]) delete buttonProps[key];
			buttonProps.width = normalizeFullWidth(props.fullWidth);
			const buttonStyle = compilePrimitiveStyles(
				buttonProps,
				collector,
				{
					defaults: buttonDefaults(props),
					style: userStyle,
					runtime: props.disabled === true ? { opacity: 0.5, cursor: "not-allowed" } : undefined,
				},
			);
			const content = props.label !== undefined && props.label !== null
				? String(props.label)
				: children;
			if (typeof props.href === "string") {
				if (props.disabled === true) {
					return (
						<a key={compiled.id} {...debug} id={id} aria-disabled="true" tabIndex={-1} className={className} style={buttonStyle}>
							{content}
						</a>
					);
				}
				const external = /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(props.href);
				return external
					? <a key={compiled.id} {...debug} id={id} href={props.href} className={className} style={buttonStyle}>{content}</a>
					: <NextLink key={compiled.id} {...debug} id={id} href={props.href} className={className} style={buttonStyle}>{content}</NextLink>;
			}
			const type = props.type === "submit" || props.type === "reset" ? props.type : "button";
			return (
				<button key={compiled.id} {...debug} id={id} type={type} disabled={props.disabled === true} className={className} style={buttonStyle}>
					{content}
				</button>
			);
		}

		case "link":
		case "EngineLink": {
			const cprop = props.cprop && typeof props.cprop === "object"
				? props.cprop as Record<string, any>
				: undefined;
			const href = String(cprop?.link?.href ?? props.href ?? "#");
			const content = props.content !== undefined ? String(props.content) : children;
			const external = props.target === "_blank" || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
			if (external) {
				const target = typeof props.target === "string" ? props.target : "_blank";
				const rel = typeof props.rel === "string"
					? props.rel
					: target === "_blank"
						? "noopener noreferrer"
						: undefined;
				return <a key={compiled.id} {...debug} id={id} href={href} target={target} rel={rel} className={className} style={style}>{content}</a>;
			}
			return <NextLink key={compiled.id} {...debug} id={id} href={href} className={className} style={style}>{content}</NextLink>;
		}

		case "spacer": {
			const horizontal = props.axis === "x";
			const spacerStyle = compileEngineStyles(
				horizontal ? { width: props.size ?? "2rem" } : { height: props.size ?? "2rem" },
				collector,
				{ display: horizontal ? "inline-block" : "block" },
			);
			return <span key={compiled.id} {...debug} aria-hidden="true" style={spacerStyle} />;
		}

		case "divider": {
			const horizontal = props.orientation !== "vertical";
			const dividerStyle = compileEngineStyles(
				horizontal ? { my: props.my ?? "1rem" } : { mx: props.my ?? "1rem" },
				collector,
				horizontal
					? {
						border: "none",
						borderTop: `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-divider, rgba(0,0,0,.1))")}`,
						width: "100%",
					}
					: {
						border: "none",
						borderLeft: `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-divider, rgba(0,0,0,.1))")}`,
						height: "auto",
						alignSelf: "stretch",
					},
			);
			return <hr key={compiled.id} {...debug} style={dividerStyle} />;
		}

		case "option":
			return (
				<option
					key={compiled.id}
					{...debug}
					id={id}
					value={String(props.value ?? "")}
					label={typeof props.label === "string" ? props.label : undefined}
					disabled={props.disabled === true}
					selected={props.selected === true ? true : undefined}
					className={className}
					style={style}
				>
					{children}
				</option>
			);

		case "optgroup":
			return (
				<optgroup
					key={compiled.id}
					{...debug}
					id={id}
					label={String(props.label ?? "")}
					disabled={props.disabled === true}
					className={className}
					style={style}
				>
					{children}
				</optgroup>
			);

		case "label":
			return (
				<label
					key={compiled.id}
					{...debug}
					id={id}
					className={className}
					style={style}
					htmlFor={String(props.htmlFor ?? props.forInput ?? "") || undefined}
				>
					{children}
				</label>
			);

		case "image":
			return renderServerImage(compiled, props, collector);

		case "markdown": {
			collector.add(ENGINE_MARKDOWN_CSS);
			return (
				<EngineMarkdownRenderer
					key={compiled.id}
					{...(props as MarkdownProps)}
					content={typeof props.content === "string" ? props.content : ""}
					articleStyle={style}
					articleClassName={className}
					articleId={id}
				/>
			);
		}

		default: {
			return (
				<EngineClientIsland
					key={compiled.id}
					node={{ ...node, children: undefined }}
					config={config}
					slots={slots}
					debug={debug}
				>
					{children}
				</EngineClientIsland>
			);
		}
	}
}

export function EngineServerRenderer({ plan, config, slots }: EngineServerRendererProps) {
	const collector = new StyleCollector();
	const content = renderServerNode(plan.root, collector, config, slots);
	const css = collector.collect();
	return (
		<>
			{content}
			{css ? (
				<style
					data-engine-generated="true"
					suppressHydrationWarning
					dangerouslySetInnerHTML={{ __html: css }}
				/>
			) : null}
		</>
	);
}
