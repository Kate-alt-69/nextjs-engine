// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server-first renderer
// ─────────────────────────────────────────────────────────────────────────────

import React, { type CSSProperties, type ElementType, type ReactNode } from "react";
import NextImage from "next/image";
import NextLink from "next/link";
import {
	BREAKPOINTS,
	BREAKPOINT_ORDER,
	type Breakpoint,
	type EngineConfig,
	type PageSchema,
	type SchemaNode,
	type TextVariant,
} from "../schema/types";
import { StyleCollector } from "../core/StyleCollector";
import type { EngineCompiledNode, EngineCompiledPage } from "./types";
import {
	compileCpropClass,
	compileEngineStyles,
	compileStyleAtRuleClass,
} from "./EngineStyleCompiler";
import { EngineClientIsland } from "./EngineClientIsland";

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
	h5: { fontSize: "1.125rem", fontWeight: 600 }, h6: { fontSize: "1rem", fontWeight: 600 },
	body: { fontSize: "1rem", lineHeight: 1.6 }, "body-sm": { fontSize: "0.875rem", lineHeight: 1.6 },
	lead: { fontSize: "1.25rem", lineHeight: 1.7, fontWeight: 400 },
	caption: { fontSize: "0.75rem", lineHeight: 1.5, color: "var(--e-caption-color, #64748b)" },
	label: { fontSize: "0.875rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" },
	mono: { fontFamily: "var(--e-font-mono, monospace)", fontSize: "0.9em", background: "var(--e-code-bg, rgba(0,0,0,.06))", padding: "0.1em 0.3em", borderRadius: "4px" },
	overline: { fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" },
};

const BUTTON_BASE: CSSProperties = {
	display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
	border: "none", fontFamily: "inherit", fontWeight: 500, cursor: "pointer", textDecoration: "none",
	transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s", userSelect: "none",
};
const BUTTON_SIZES: Record<string, CSSProperties> = {
	xs: { fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: "6px" },
	sm: { fontSize: "0.875rem", padding: "0.5rem 1rem", borderRadius: "6px" },
	md: { fontSize: "1rem", padding: "0.625rem 1.5rem", borderRadius: "8px" },
	lg: { fontSize: "1.125rem", padding: "0.75rem 2rem", borderRadius: "10px" },
	xl: { fontSize: "1.25rem", padding: "1rem 2.5rem", borderRadius: "12px" },
};

const SERVER_RENDERED_TYPES = new Set([
	"box", "stack", "grid", "text", "heading", "section", "hero", "card", "button",
	"link", "EngineLink", "spacer", "divider", "option", "optgroup", "label", "slot", "image",
]);

function shortHash(value: string): string {
	let hash = 5381;
	for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
	return Math.abs(hash).toString(36).slice(0, 7);
}

function visibilityClass(props: Record<string, unknown>, collector: StyleCollector): string | undefined {
	const hideOn = Array.isArray(props.hideOn) ? props.hideOn as Breakpoint[] : [];
	const showOnly = Array.isArray(props.showOnly) ? props.showOnly as Breakpoint[] : [];
	if (hideOn.length === 0 && showOnly.length === 0) return undefined;
	const hidden = BREAKPOINT_ORDER.filter((breakpoint) => (showOnly.length > 0 && !showOnly.includes(breakpoint)) || hideOn.includes(breakpoint));
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

function mergeClassName(node: SchemaNode, collector: StyleCollector): string | undefined {
	const props = node.props ?? {};
	return [
		typeof props.className === "string" ? props.className : undefined,
		compileCpropClass(props.cprop as any, collector),
		compileStyleAtRuleClass(props.style as any, collector),
		visibilityClass(props, collector),
	].filter(Boolean).join(" ") || undefined;
}

function wrapHref(href: unknown, child: ReactNode): ReactNode {
	if (typeof href !== "string" || href.length === 0) return child;
	const external = /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
	return external
		? <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "contents", color: "inherit", textDecoration: "none" }}>{child}</a>
		: <NextLink href={href} style={{ display: "contents", color: "inherit", textDecoration: "none" }}>{child}</NextLink>;
}

function renderTextContent(props: Record<string, unknown>, children: ReactNode): ReactNode {
	const parts = Array.isArray(props.parts) ? props.parts as Array<Record<string, unknown>> : [];
	if (parts.length > 0) {
		return parts.map((part, index) => {
			const text = String(part.text ?? "");
			if (typeof part.href === "string") {
				const external = /^https?:\/\//i.test(part.href);
				return <a key={index} href={part.href} target={(part.target as string | undefined) ?? (external ? "_blank" : undefined)} rel={(part.rel as string | undefined) ?? (external ? "noopener noreferrer" : undefined)} style={part.style as CSSProperties | undefined}>{text}</a>;
			}
			return part.style ? <span key={index} style={part.style as CSSProperties}>{text}</span> : text;
		});
	}
	return props.content !== undefined ? String(props.content) : children;
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
		...(props.disabled === true ? { opacity: 0.5, cursor: "not-allowed" } : {}),
	};
}

function renderServerNode(
	compiled: EngineCompiledNode,
	collector: StyleCollector,
	config: EngineConfig | undefined,
	slots: Record<string, ReactNode> | undefined,
): ReactNode {
	const node = compiled.source;
	const props = node.props ?? {};
	const childNodes = compiled.children.map((child) => renderServerNode(child, collector, config, slots));
	const children: ReactNode = typeof node.children === "string" ? node.children : childNodes;

	if (compiled.runtime === "client" || !SERVER_RENDERED_TYPES.has(String(node.type))) {
		return <EngineClientIsland key={compiled.id} node={{ ...node, children: undefined }} config={config} slots={slots}>{children}</EngineClientIsland>;
	}

	const className = mergeClassName(node, collector);
	const id = typeof props.id === "string" ? props.id : typeof props.point === "string" ? props.point : undefined;
	const style = compileEngineStyles(props as any, collector, props.style as any);

	switch (node.type) {
		case "box": {
			const Tag = (typeof props.as === "string" ? props.as : "div") as ElementType;
			return wrapHref(props.href, <Tag key={compiled.id} id={id} className={className} style={style}>{children}</Tag>);
		}
		case "stack": {
			const direction = props.direction === "horizontal" ? "row" : "column";
			const stackStyle = compileEngineStyles({ ...props, display: "flex", flexDir: direction }, collector, props.style as any);
			const items = React.Children.toArray(children);
			return wrapHref(props.href, <div key={compiled.id} id={id} className={className} style={stackStyle}>{props.dividers === true ? items.flatMap((child, index) => index < items.length - 1 ? [child, <hr key={`${compiled.id}-${index}`} style={{ border: 0, borderTop: "1px solid var(--e-divider, rgba(0,0,0,.1))", margin: 0 }} />] : [child]) : children}</div>);
		}
		case "grid": {
			const columns = props.autoFit === true ? `repeat(auto-fit, minmax(${String(props.minColWidth ?? "200px")}, 1fr))` : props.columns ?? 1;
			return wrapHref(props.href, <div key={compiled.id} id={id} className={className} style={compileEngineStyles({ ...props, display: "grid", columns }, collector, props.style as any)}>{children}</div>);
		}
		case "text": {
			const variant = (props.variant ?? "body") as TextVariant;
			const Tag = (typeof props.as === "string" ? props.as : TEXT_TAGS[variant] ?? "p") as ElementType;
			const derived: CSSProperties = {
				...TEXT_STYLES[variant],
				...(props.italic === true ? { fontStyle: "italic" } : {}),
				...(props.underline === true ? { textDecoration: "underline" } : {}),
				...(typeof props.gradient === "string" ? { backgroundImage: props.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" } : {}),
			};
			return wrapHref(props.href, <Tag key={compiled.id} id={id} className={className} style={compileEngineStyles(props as any, collector, { ...derived, ...(props.style as CSSProperties | undefined) })}>{renderTextContent(props, children)}</Tag>);
		}
		case "heading": {
			const level = Math.min(6, Math.max(1, Number(props.level ?? 2))) as 1 | 2 | 3 | 4 | 5 | 6;
			const Tag = `h${level}` as ElementType;
			return <React.Fragment key={compiled.id}><Tag id={id} className={className} style={compileEngineStyles(props as any, collector, { ...TEXT_STYLES[`h${level}` as TextVariant], ...(props.style as CSSProperties | undefined) })}>{renderTextContent(props, children)}</Tag>{typeof props.subheading === "string" ? <p style={{ ...TEXT_STYLES.lead, color: "var(--e-muted, #64748b)", marginTop: "0.5rem" }}>{props.subheading}</p> : null}</React.Fragment>;
		}
		case "section": {
			const outer = compileEngineStyles({ ...props, width: "100%" }, collector, { ...(props.fullViewport === true ? { minHeight: "100svh" } : {}), ...(props.snapAlign ? { scrollSnapAlign: props.snapAlign as CSSProperties["scrollSnapAlign"] } : {}), ...(props.style as CSSProperties | undefined) });
			const inner = compileEngineStyles({ maxW: props.contentMaxWidth ?? "1200px", px: props.px ?? "1.5rem", py: props.py ?? "4rem" }, collector, { width: "100%", ...(props.centered !== false ? { marginLeft: "auto", marginRight: "auto" } : {}) });
			return wrapHref(props.href, <section key={compiled.id} id={id} className={className} style={outer}><div style={inner}>{children}</div></section>);
		}
		case "hero": {
			const variant = String(props.variant ?? "centered");
			const outer = compileEngineStyles({ ...props, width: "100%" }, collector, { position: "relative", overflow: "hidden", ...(props.fullViewport !== false ? { minHeight: "100svh" } : {}), ...(props.backgroundImage ? { backgroundImage: props.backgroundImage as string, backgroundSize: (props.backgroundSize as string | undefined) ?? "cover", backgroundPosition: (props.backgroundPosition as string | undefined) ?? "center", backgroundRepeat: (props.backgroundRepeat as string | undefined) ?? "no-repeat" } : {}), ...(props.style as CSSProperties | undefined) });
			const inner = compileEngineStyles({ px: props.px ?? (variant === "fullbleed" ? "0" : "1.5rem"), py: props.py ?? "6rem", ...(variant !== "fullbleed" ? { maxW: props.contentMaxWidth ?? "1200px" } : {}), ...(variant === "split" ? { columns: { xs: 1, md: 2 }, gap: { xs: "2rem", lg: "4rem" } } : {}) }, collector, { position: "relative", zIndex: 1, width: "100%", ...(props.centered !== false && variant !== "fullbleed" ? { marginLeft: "auto", marginRight: "auto" } : {}), ...(variant === "centered" ? { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" } : {}), ...(variant === "split" ? { display: "grid", alignItems: "center" } : {}) });
			const hero = <section key={compiled.id} id={id} className={className} style={outer}>{typeof props.overlay === "string" ? <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: props.overlay, zIndex: 0, pointerEvents: "none" }} /> : null}<div style={inner}>{children}</div></section>;
			return wrapHref(props.href, hero);
		}
		case "card": {
			const direction = props.direction === "horizontal" ? "row" : "column";
			const variant = String(props.variant ?? "elevated");
			const variantStyle: CSSProperties = variant === "elevated" ? { background: "var(--e-card-bg, #fff)", boxShadow: "0 2px 12px rgba(0,0,0,.08)" } : variant === "outlined" ? { background: "var(--e-card-bg, #fff)", border: "1px solid var(--e-border, rgba(0,0,0,.12))" } : variant === "filled" ? { background: "var(--e-card-filled, #f8fafc)" } : { background: "var(--e-card-bg, #fff)" };
			const cardStyle = compileEngineStyles({ ...props, display: "flex", flexDir: direction }, collector, { borderRadius: "12px", overflow: "hidden", ...variantStyle, ...(props.style as CSSProperties | undefined) });
			return wrapHref(props.href, <div key={compiled.id} id={id} className={className} style={cardStyle}>{typeof props.cover === "string" ? <img src={props.cover} alt={String(props.coverAlt ?? "")} loading="lazy" decoding="async" style={{ width: direction === "row" ? String(props.coverWidth ?? "40%") : "100%", aspectRatio: String(props.coverRatio ?? "16 / 9"), objectFit: (props.coverFit as CSSProperties["objectFit"]) ?? "cover" }} /> : null}<div style={{ padding: String(props.innerPadding ?? "1.25rem"), flex: 1 }}>{children}</div></div>);
		}
		case "button": {
			if (typeof props.href !== "string") return <EngineClientIsland key={compiled.id} node={{ ...node, children: undefined }} config={config} slots={slots}>{children}</EngineClientIsland>;
			const buttonStyle = compileEngineStyles(props as any, collector, { ...buttonDefaults(props), ...(props.style as CSSProperties | undefined) });
			return <NextLink key={compiled.id} id={id} className={className} style={buttonStyle} href={props.disabled === true ? "#" : props.href} aria-disabled={props.disabled === true || undefined} tabIndex={props.disabled === true ? -1 : undefined}>{String(props.label ?? "") || children}</NextLink>;
		}
		case "link":
		case "EngineLink": {
			const cprop = props.cprop && typeof props.cprop === "object" ? props.cprop as Record<string, any> : undefined;
			const href = String(cprop?.link?.href ?? props.href ?? "#");
			const content = props.content !== undefined ? String(props.content) : children;
			const external = props.target === "_blank" || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
			return external ? <a key={compiled.id} id={id} href={href} target={String(props.target ?? "_blank")} rel="noopener noreferrer" className={className} style={style}>{content}</a> : <NextLink key={compiled.id} id={id} href={href} className={className} style={style}>{content}</NextLink>;
		}
		case "spacer": {
			const size = props.size ?? "1rem";
			return <div key={compiled.id} aria-hidden="true" style={(props.axis === "x" ? { width: size, display: "inline-block" } : { height: size, width: "100%" }) as CSSProperties} />;
		}
		case "divider": {
			const vertical = props.orientation === "vertical";
			return <hr key={compiled.id} aria-hidden="true" style={{ border: 0, borderTop: vertical ? undefined : `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-border, #e2e8f0)")}`, borderLeft: vertical ? `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-border, #e2e8f0)")}` : undefined, height: vertical ? "100%" : undefined }} />;
		}
		case "option": return <option key={compiled.id} value={String(props.value ?? "")} disabled={props.disabled === true}>{String(props.label ?? node.children ?? props.value ?? "")}</option>;
		case "optgroup": return <optgroup key={compiled.id} label={String(props.label ?? "")} disabled={props.disabled === true}>{children}</optgroup>;
		case "label": return <label key={compiled.id} id={id} className={className} style={style} htmlFor={String(props.htmlFor ?? props.forInput ?? "") || undefined}>{children}</label>;
		case "slot": {
			const name = typeof props.name === "string" ? props.name : "";
			const fallback = props.fallback as SchemaNode | undefined;
			return <React.Fragment key={compiled.id}>{slots?.[name] ?? (fallback ? fallback.children as ReactNode : children)}</React.Fragment>;
		}
		case "image": {
			if (typeof props.src !== "string" || typeof props.alt !== "string") return null;
			const fill = props.fill === true;
			const image = <NextImage key={compiled.id} src={props.src} alt={props.alt} width={fill ? undefined : Number(props.width ?? 800)} height={fill ? undefined : Number(props.height ?? 600)} fill={fill} priority={props.priority === true} quality={typeof props.quality === "number" ? props.quality : undefined} sizes={typeof props.sizes === "string" ? props.sizes : undefined} style={{ ...style, objectFit: (props.objectFit as CSSProperties["objectFit"]) ?? undefined }} />;
			return typeof props.caption === "string" ? <figure key={compiled.id}>{image}<figcaption>{props.caption}</figcaption></figure> : image;
		}
		default: return <EngineClientIsland key={compiled.id} node={{ ...node, children: undefined }} config={config} slots={slots}>{children}</EngineClientIsland>;
	}
}

export function EngineServerRenderer({ plan, config, slots }: EngineServerRendererProps) {
	const collector = new StyleCollector();
	const content = renderServerNode(plan.root, collector, config, slots);
	const css = collector.collect();
	return <>{content}{css ? <style precedence="engine" dangerouslySetInnerHTML={{ __html: css }} /> : null}</>;
}
