import React, { createElement, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type {
	EngineThemeTemplateDefinition,
	EngineThemeTemplateNodeType,
} from "../schema/types";

export interface EngineThemeTemplateContext {
	themeId?: string;
	componentId?: string;
	block?: string;
	className?: string;
	wrapperStyle?: CSSProperties;
	language?: string;
	label?: string;
	index?: number;
	alignment?: string;
	tone?: string;
	title?: string;
	[key: string]: unknown;
	slots?: Readonly<Record<string, ReactNode>>;
}

export type EngineThemeTemplateAdapter = ComponentType<EngineThemeTemplateContext>;

const TEMPLATE_ADAPTER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_TEMPLATE_DEPTH = 16;
const MAX_TEMPLATE_NODES = 200;
const MAX_TEMPLATE_TEXT = 16 * 1024;
const MAX_CSS_TEXT = 256;

const ALLOWED_NODE_TYPES = new Set<EngineThemeTemplateNodeType>([
	"box", "stack", "grid", "text", "heading", "divider", "spacer", "slot",
]);
const ALLOWED_HTML_TAGS = new Set([
	"div", "span", "section", "aside", "header", "footer", "figure", "figcaption",
	"pre", "code", "p", "small", "strong", "em", "b", "i", "h1", "h2", "h3",
	"h4", "h5", "h6", "label",
]);
const ALLOWED_STYLE_KEYS = new Set([
	"display", "flexDirection", "flexWrap", "flex", "alignItems", "justifyContent",
	"alignSelf", "justifySelf", "gap", "rowGap", "columnGap",
	"padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
	"margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
	"width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "flexShrink",
	"color", "background", "backgroundColor", "border", "borderColor",
	"borderTop", "borderRight", "borderBottom", "borderLeft", "borderRadius",
	"boxShadow", "fontFamily", "fontSize", "fontWeight", "fontStyle",
	"lineHeight", "letterSpacing", "textAlign", "textDecoration",
	"whiteSpace", "overflow", "overflowX", "overflowY", "gridTemplateColumns",
	"gridTemplateRows", "gridColumn", "gridRow", "opacity",
]);

const SAFE_SLOTS = new Set([
	"content", "children", "label", "language", "languageLabel", "title", "icon",
	"footer", "leading", "trailing", "existing", "incoming", "body", "pre",
]);

interface CompiledTemplateNode {
	type: EngineThemeTemplateNodeType;
	props: Record<string, unknown>;
	children: Array<CompiledTemplateNode | string>;
}

interface CompiledTemplate {
	node?: CompiledTemplateNode;
	error?: string;
}

const templateAdapters = new Map<string, EngineThemeTemplateAdapter>();
const compiledTemplateCache = new WeakMap<object, CompiledTemplate>();

function isRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function safeCssText(value: unknown, context?: EngineThemeTemplateContext): string | undefined {
	if (typeof value !== "string" || value.length > MAX_CSS_TEXT) return undefined;
	const raw = value.trim();
	const text = context ? interpolate(raw, context) : raw;
	if (!text || /url\s*\(|expression\s*\(|javascript\s*:|@import|<\/?style|<\/?script/i.test(text)) return undefined;
	return text;
}

function safeStyle(value: unknown, context?: EngineThemeTemplateContext): CSSProperties {
	if (!isRecord(value)) return {};
	const style: Record<string, string | number> = {};
	for (const [key, item] of Object.entries(value)) {
		if (!ALLOWED_STYLE_KEYS.has(key)) continue;
		if (typeof item === "number" && Number.isFinite(item)) {
			style[key] = item;
		} else if (typeof item === "string") {
			const normalized = safeCssText(item, context);
			if (normalized !== undefined) style[key] = normalized;
		}
	}
	return style as CSSProperties;
}

function compileTemplateNode(
	input: unknown,
	state: { nodes: number },
	depth: number,
): CompiledTemplateNode {
	state.nodes += 1;
	if (state.nodes > MAX_TEMPLATE_NODES) throw new TypeError("EngineTheme template exceeds the node limit.");
	if (depth > MAX_TEMPLATE_DEPTH) throw new TypeError("EngineTheme template exceeds the nesting limit.");
	if (!isRecord(input) || typeof input.type !== "string" || !ALLOWED_NODE_TYPES.has(input.type as EngineThemeTemplateNodeType)) {
		throw new TypeError("EngineTheme template contains an unsupported node type.");
	}
	if (input.props !== undefined && !isRecord(input.props)) {
		throw new TypeError("EngineTheme template props must be a plain JSON object.");
	}
	if (input.children !== undefined && !Array.isArray(input.children)) {
		throw new TypeError("EngineTheme template children must be an array.");
	}
	const props = (input.props ?? {}) as Record<string, unknown>;
	for (const key of Object.keys(props)) {
		if (["onClick", "onLoad", "dangerouslySetInnerHTML", "ref", "key", "children", "innerHTML"].includes(key)) {
			throw new TypeError("EngineTheme templates cannot define event callbacks, refs, or raw HTML.");
		}
	}
	const children: Array<CompiledTemplateNode | string> = [];
	for (const child of (input.children ?? []) as unknown[]) {
		if (typeof child === "string") {
			if (child.length > MAX_TEMPLATE_TEXT) throw new TypeError("EngineTheme template text exceeds the length limit.");
			children.push(child);
		} else {
			children.push(compileTemplateNode(child, state, depth + 1));
		}
	}
	if (input.type === "slot") {
		const name = props.name;
		if (typeof name !== "string" || !SAFE_SLOTS.has(name)) {
			throw new TypeError("EngineTheme template slots must use a supported slot name.");
		}
	}
	return {
		type: input.type as EngineThemeTemplateNodeType,
		props: { ...props },
		children,
	};
}

function compileTemplate(definition: EngineThemeTemplateDefinition): CompiledTemplate {
	if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
		return { error: "Template definition must be an object." };
	}
	if (typeof definition.adapterId === "string") {
		if (!TEMPLATE_ADAPTER_ID.test(definition.adapterId) || RESERVED_IDS.has(definition.adapterId)) {
			return { error: "Template adapter ID is invalid." };
		}
		if (!templateAdapters.has(definition.adapterId)) {
			return { error: "Template adapter '" + definition.adapterId + "' is not registered locally." };
		}
		return {};
	}
	if (!definition.schema) return { error: "Template needs a schema or a local adapter ID." };
	try {
		return { node: compileTemplateNode(definition.schema, { nodes: 0 }, 0) };
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error) };
	}
}

function interpolate(text: string, context: EngineThemeTemplateContext): string {
	return text.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_match, key: string) => {
		const value = context[key];
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
		return "";
	});
}

function normalizeTag(type: EngineThemeTemplateNodeType, props: Record<string, unknown>): string {
	if (type === "slot") return "";
	if (type === "divider") return "hr";
	if (type === "spacer") return "div";
	if (type === "stack" || type === "grid" || type === "box") {
		const tag = props.as;
		return typeof tag === "string" && ALLOWED_HTML_TAGS.has(tag.toLowerCase()) ? tag.toLowerCase() : "div";
	}
	if (type === "heading") {
		const level = typeof props.level === "number" && props.level >= 1 && props.level <= 6
			? Math.floor(props.level) : 2;
		return "h" + level;
	}
	const requested = props.as;
	return typeof requested === "string" && ALLOWED_HTML_TAGS.has(requested.toLowerCase())
		? requested.toLowerCase()
		: "span";
}

function scalarStyleProp(value: unknown, context?: EngineThemeTemplateContext): string | number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") return safeCssText(value, context);
	return undefined;
}

function compileStyleFromProps(type: EngineThemeTemplateNodeType, props: Record<string, unknown>, context: EngineThemeTemplateContext): CSSProperties {
	const styles: Record<string, string | number> = { ...safeStyle(props.style, context) } as Record<string, string | number>;
	for (const [key, cssKey] of [
		["gap", "gap"], ["padding", "padding"], ["margin", "margin"], ["width", "width"],
		["height", "height"], ["minWidth", "minWidth"], ["maxWidth", "maxWidth"],
		["color", "color"], ["background", "background"], ["border", "border"], ["radius", "borderRadius"],
		["fontSize", "fontSize"], ["fontWeight", "fontWeight"], ["fontFamily", "fontFamily"],
		["lineHeight", "lineHeight"], ["textAlign", "textAlign"], ["overflow", "overflow"],
	] as const) {
		const value = scalarStyleProp(props[key], context);
		if (value !== undefined) styles[cssKey] = value;
	}
	if (type === "stack") {
		styles.display = "flex";
		const direction = props.direction;
		styles.flexDirection = direction === "row" || direction === "row-reverse" || direction === "column-reverse"
			? direction : "column";
	} else if (type === "grid") {
		styles.display = "grid";
		const columns = props.columns;
		if (typeof columns === "number" && Number.isInteger(columns) && columns >= 1 && columns <= 12) {
			styles.gridTemplateColumns = "repeat(" + columns + ", minmax(0, 1fr))";
		} else if (typeof columns === "string" && /^[A-Za-z0-9 ().,%/_-]{1,64}$/.test(columns)) {
			styles.gridTemplateColumns = columns;
		}
	} else if (type === "box" && typeof props.direction === "string") {
		styles.display = "flex";
		styles.flexDirection = props.direction === "row" ? "row" : "column";
	}
	const align = props.align;
	if (typeof align === "string" && ["start", "center", "end", "stretch", "baseline"].includes(align)) {
		styles.alignItems = align === "start" ? "flex-start" : align === "end" ? "flex-end" : align;
	}
	const justify = props.justify;
	if (typeof justify === "string" && ["start", "center", "end", "between", "around", "evenly"].includes(justify)) {
		const map: Record<string, string> = {
			start: "flex-start", center: "center", end: "flex-end", between: "space-between",
			around: "space-around", evenly: "space-evenly",
		};
		styles.justifyContent = map[justify];
	}
	if (type === "spacer") {
		styles.flexShrink = 0;
		styles.minWidth = scalarStyleProp(props.width) ?? styles.minWidth ?? "1rem";
	}
	return styles as CSSProperties;
}

function renderCompiledNode(
	node: CompiledTemplateNode,
	context: EngineThemeTemplateContext,
	depth: number,
): ReactNode {
	if (depth > MAX_TEMPLATE_DEPTH) return null;
	const props = node.props;
	if (node.type === "slot") {
		const name = String(props.name);
		const value = context.slots?.[name];
		if (value !== undefined && value !== null) return value;
		if (node.children.length > 0) return node.children.map((child, index) =>
			typeof child === "string" ? interpolate(child, context) : renderCompiledNode(child, context, depth + 1));
		return null;
	}
	const children = node.children.length > 0
		? node.children.map((child) => typeof child === "string"
			? interpolate(child, context)
			: renderCompiledNode(child, context, depth + 1))
		: typeof props.content === "string"
			? interpolate(props.content, context)
			: undefined;
	const tag = normalizeTag(node.type, props);
	const elementProps: Record<string, unknown> = {
		style: {
			...(depth === 0 && context.wrapperStyle ? context.wrapperStyle : {}),
			...compileStyleFromProps(node.type, props, context),
		},
	};
	if (depth === 0 && context.block === "codeBlock" && typeof context.language === "string") {
		elementProps["data-language"] = context.language;
	}
	const classNames = [
		typeof context.className === "string" && /^[A-Za-z0-9 _-]{0,128}$/.test(context.className) ? context.className : "",
		typeof props.className === "string" && /^[A-Za-z0-9 _-]{0,128}$/.test(props.className) ? props.className : "",
	].filter(Boolean).join(" ");
	if (classNames) elementProps.className = classNames;
	if (typeof props.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(props.id)) elementProps.id = props.id;
	if (typeof props.title === "string" && props.title.length <= 256) elementProps.title = props.title;
	if (typeof props.role === "string" && /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(props.role)) elementProps.role = props.role;
	if (typeof props["aria-label"] === "string" && props["aria-label"].length <= 256) elementProps["aria-label"] = props["aria-label"];
	if (props.hidden === true) elementProps.hidden = true;
	if (node.type === "divider") {
		elementProps["aria-hidden"] = props["aria-hidden"] === true ? true : undefined;
	}
	return createElement(tag, elementProps, children);
}

/**
 * Register a trusted local React component adapter. Remote theme data can only
 * reference its ID; the component code must already exist in the consumer app.
 */
export function registerEngineThemeTemplateAdapter(id: string, adapter: EngineThemeTemplateAdapter): void {
	if (typeof id !== "string" || !TEMPLATE_ADAPTER_ID.test(id) || RESERVED_IDS.has(id)) {
		throw new TypeError("EngineTheme template adapter ID is invalid.");
	}
	if (typeof adapter !== "function") throw new TypeError("EngineTheme template adapter must be a local React component.");
	const existing = templateAdapters.get(id);
	if (existing && existing !== adapter) throw new Error("EngineTheme template adapter '" + id + "' is already registered.");
	templateAdapters.set(id, adapter);
}

export function unregisterEngineThemeTemplateAdapter(id: string): boolean {
	return templateAdapters.delete(id);
}

export function listEngineThemeTemplateAdapters(): string[] {
	return [...templateAdapters.keys()].sort();
}

/**
 * Render an Engine Schema template safely. Invalid templates return undefined
 * so the Markdown renderer can keep its built-in layout as a fallback.
 */
export function renderEngineThemeTemplate(
	definition: EngineThemeTemplateDefinition | undefined,
	context: EngineThemeTemplateContext,
): ReactNode | undefined {
	if (!definition || typeof definition !== "object") return undefined;
	let compiled: CompiledTemplate | undefined;
	if (definition.schema && typeof definition.schema === "object" && Object.isFrozen(definition.schema)) {
		compiled = compiledTemplateCache.get(definition.schema as object);
		if (!compiled) {
			compiled = compileTemplate(definition);
			compiledTemplateCache.set(definition.schema as object, compiled);
		}
	} else {
		compiled = compileTemplate(definition);
	}
	if (compiled.error) return undefined;
	if (typeof definition.adapterId === "string") {
		const adapter = templateAdapters.get(definition.adapterId);
		return adapter ? createElement(adapter, context) : undefined;
	}
	if (!compiled.node) return undefined;
	return renderCompiledNode(compiled.node, context, 0);
}
