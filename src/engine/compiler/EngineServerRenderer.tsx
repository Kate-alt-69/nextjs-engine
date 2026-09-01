// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server-first renderer
//
// Deterministic primitives render directly on the server. Browser-only nodes are
// isolated behind EngineClientIsland instead of forcing the whole schema tree
// through the legacy client SchemaRenderer.
// ─────────────────────────────────────────────────────────────────────────────

import React, { type CSSProperties, type ElementType, type ReactNode } from "react";
import NextImage from "next/image";
import type { EngineConfig, PageSchema, SchemaNode, TextVariant } from "../schema/types";
import { StyleCollector } from "../core/StyleCollector";
import type { EngineCompiledNode, EngineCompiledPage } from "./types";
import { compileCpropClass, compileEngineStyles } from "./EngineStyleCompiler";
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

const SERVER_RENDERED_TYPES = new Set([
	"box", "stack", "grid", "text", "heading", "section", "card", "button",
	"spacer", "divider", "option", "optgroup", "label", "slot", "image",
]);

function mergeClassName(node: SchemaNode, collector: StyleCollector): string | undefined {
	const props = node.props ?? {};
	const cpropClass = compileCpropClass(props.cprop as any, collector);
	return [props.className, cpropClass].filter(Boolean).join(" ") || undefined;
}

function wrapHref(href: unknown, child: ReactNode): ReactNode {
	if (typeof href !== "string" || href.length === 0) return child;
	const external = /^https?:\/\//i.test(href);
	return (
		<a
			href={href}
			target={external ? "_blank" : undefined}
			rel={external ? "noopener noreferrer" : undefined}
			style={{ display: "contents", color: "inherit", textDecoration: "none" }}
		>
			{child}
		</a>
	);
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

function renderServerNode(
	compiled: EngineCompiledNode,
	collector: StyleCollector,
	config: EngineConfig | undefined,
	slots: Record<string, ReactNode> | undefined,
): ReactNode {
	const node = compiled.source;
	const props = node.props ?? {};
	if (compiled.runtime === "client" || !SERVER_RENDERED_TYPES.has(String(node.type))) {
		return <EngineClientIsland key={compiled.id} node={node} config={config} slots={slots} />;
	}

	const children = compiled.children.map((child) => renderServerNode(child, collector, config, slots));
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
			const output = props.dividers === true
				? children.flatMap((child, index) => index < children.length - 1
					? [child, <hr key={`${compiled.id}-divider-${index}`} style={{ border: 0, borderTop: "1px solid var(--e-divider, rgba(0,0,0,.1))", margin: 0 }} />]
					: [child])
				: children;
			return wrapHref(props.href, <div key={compiled.id} id={id} className={className} style={stackStyle}>{output}</div>);
		}
		case "grid": {
			const columns = props.autoFit === true
				? `repeat(auto-fit, minmax(${String(props.minColWidth ?? "200px")}, 1fr))`
				: props.columns ?? 1;
			const gridStyle = compileEngineStyles({ ...props, display: "grid", columns }, collector, props.style as any);
			return wrapHref(props.href, <div key={compiled.id} id={id} className={className} style={gridStyle}>{children}</div>);
		}
		case "text": {
			const variant = (props.variant ?? "body") as TextVariant;
			const Tag = (typeof props.as === "string" ? props.as : TEXT_TAGS[variant] ?? "p") as ElementType;
			const derived: CSSProperties = {
				...TEXT_STYLES[variant],
				...(props.italic === true ? { fontStyle: "italic" } : {}),
				...(props.underline === true ? { textDecoration: "underline" } : {}),
				...(typeof props.gradient === "string" ? {
					backgroundImage: props.gradient,
					WebkitBackgroundClip: "text",
					WebkitTextFillColor: "transparent",
					backgroundClip: "text",
				} : {}),
			};
			const textStyle = compileEngineStyles(props as any, collector, { ...derived, ...(props.style as CSSProperties | undefined) });
			return wrapHref(props.href, <Tag key={compiled.id} id={id} className={className} style={textStyle}>{renderTextContent(props, children)}</Tag>);
		}
		case "heading": {
			const level = Math.min(6, Math.max(1, Number(props.level ?? 2))) as 1 | 2 | 3 | 4 | 5 | 6;
			const variant = `h${level}` as TextVariant;
			const Tag = `h${level}` as ElementType;
			const headingStyle = compileEngineStyles(props as any, collector, { ...TEXT_STYLES[variant], ...(props.style as CSSProperties | undefined) });
			return (
				<React.Fragment key={compiled.id}>
					<Tag id={id} className={className} style={headingStyle}>{renderTextContent(props, children)}</Tag>
					{typeof props.subheading === "string" ? <p style={{ ...TEXT_STYLES.lead, color: "var(--e-muted, #64748b)", marginTop: "0.5rem" }}>{props.subheading}</p> : null}
				</React.Fragment>
			);
		}
		case "section": {
			const outer = compileEngineStyles({ ...props, width: "100%" }, collector, {
				...(props.fullViewport === true ? { minHeight: "100svh" } : {}),
				...(props.snapAlign ? { scrollSnapAlign: props.snapAlign as CSSProperties["scrollSnapAlign"] } : {}),
				...(props.style as CSSProperties | undefined),
			});
			const inner = compileEngineStyles({
				maxW: props.contentMaxWidth ?? "1200px",
				px: props.px ?? "1.5rem",
				py: props.py ?? "4rem",
			}, collector, {
				width: "100%",
				...(props.centered !== false ? { marginLeft: "auto", marginRight: "auto" } : {}),
			});
			return wrapHref(props.href, <section key={compiled.id} id={id} className={className} style={outer}><div style={inner}>{children}</div></section>);
		}
		case "card": {
			const direction = props.direction === "horizontal" ? "row" : "column";
			const cardStyle = compileEngineStyles({ ...props, display: "flex", flexDir: direction }, collector, {
				borderRadius: "0.75rem",
				overflow: "hidden",
				...(props.variant === "outlined" ? { border: "1px solid var(--e-border, #e2e8f0)" } : {}),
				...(props.variant === "elevated" || props.variant === undefined ? { boxShadow: "0 4px 18px rgba(0,0,0,.08)" } : {}),
				...(props.style as CSSProperties | undefined),
			});
			return wrapHref(props.href, (
				<div key={compiled.id} id={id} className={className} style={cardStyle}>
					{typeof props.cover === "string" ? <img src={props.cover} alt={String(props.coverAlt ?? "")} style={{ width: direction === "row" ? String(props.coverWidth ?? "40%") : "100%", aspectRatio: String(props.coverRatio ?? "16 / 9"), objectFit: (props.coverFit as CSSProperties["objectFit"]) ?? "cover" }} /> : null}
					<div style={{ padding: String(props.innerPadding ?? "1.25rem"), flex: 1 }}>{children}</div>
				</div>
			));
		}
		case "button": {
			if (typeof props.href !== "string") return <EngineClientIsland key={compiled.id} node={node} config={config} slots={slots} />;
			return <a key={compiled.id} id={id} className={className} style={style} href={props.href}>{String(props.label ?? "") || children}</a>;
		}
		case "spacer": {
			const size = props.size ?? "1rem";
			const spacerStyle = props.axis === "x" ? { width: size, display: "inline-block" } : { height: size, width: "100%" };
			return <div key={compiled.id} aria-hidden="true" style={spacerStyle as CSSProperties} />;
		}
		case "divider": {
			const vertical = props.orientation === "vertical";
			return <hr key={compiled.id} aria-hidden="true" style={{ border: 0, borderTop: vertical ? undefined : `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-border, #e2e8f0)")}`, borderLeft: vertical ? `${String(props.thickness ?? "1px")} ${String(props.style ?? "solid")} ${String(props.color ?? "var(--e-border, #e2e8f0)")}` : undefined, height: vertical ? "100%" : undefined }} />;
		}
		case "option":
			return <option key={compiled.id} value={String(props.value ?? "")} disabled={props.disabled === true}>{String(props.label ?? node.children ?? props.value ?? "")}</option>;
		case "optgroup":
			return <optgroup key={compiled.id} label={String(props.label ?? "")} disabled={props.disabled === true}>{children}</optgroup>;
		case "label":
			return <label key={compiled.id} id={id} className={className} style={style} htmlFor={String(props.htmlFor ?? props.forInput ?? "") || undefined}>{children}</label>;
		case "slot": {
			const name = typeof props.name === "string" ? props.name : "";
			return <React.Fragment key={compiled.id}>{slots?.[name] ?? children}</React.Fragment>;
		}
		case "image": {
			if (typeof props.src !== "string" || typeof props.alt !== "string") return null;
			const fill = props.fill === true;
			const image = <NextImage key={compiled.id} src={props.src} alt={props.alt} width={fill ? undefined : Number(props.width ?? 800)} height={fill ? undefined : Number(props.height ?? 600)} fill={fill} priority={props.priority === true} quality={typeof props.quality === "number" ? props.quality : undefined} sizes={typeof props.sizes === "string" ? props.sizes : undefined} style={{ ...style, objectFit: (props.objectFit as CSSProperties["objectFit"]) ?? undefined }} />;
			return typeof props.caption === "string" ? <figure key={compiled.id}>{image}<figcaption>{props.caption}</figcaption></figure> : image;
		}
		default:
			return <EngineClientIsland key={compiled.id} node={node} config={config} slots={slots} />;
	}
}

export function EngineServerRenderer({ schema, plan, config, slots }: EngineServerRendererProps) {
	const collector = new StyleCollector();
	const content = renderServerNode(plan.root, collector, config, slots);
	const css = collector.collect();
	return (
		<>
			{content}
			{css ? <style precedence="engine" dangerouslySetInnerHTML={{ __html: css }} /> : null}
		</>
	);
}
