// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server-safe style compiler
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { BaseNodeProps, CpropValue, EngineStyleObject, ResponsiveValue } from "../schema/types";
import { StyleCollector } from "../core/StyleCollector";
import {
	isResponsive,
	normalizeSpacingValue,
	resolveColumns,
	resolveGeneric,
	resolveSpacing,
} from "../core/resolver";

function stableHash(value: string): string {
	let hash = 5381;
	for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
	return Math.abs(hash).toString(36).slice(0, 8);
}

function camelToKebab(value: string): string {
	return value.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function declarations(style: Record<string, unknown>): string {
	return Object.entries(style)
		.filter(([key, value]) => value != null && !key.startsWith("@") && (typeof value !== "object" || Array.isArray(value)))
		.map(([key, value]) => `${camelToKebab(key)}:${String(value)}`)
		.join(";");
}

function compileAtRules(
	style: EngineStyleObject | undefined,
	selector: string,
	collector: StyleCollector,
): void {
	if (!style) return;
	for (const [key, value] of Object.entries(style)) {
		if (!key.startsWith("@") || value == null) continue;
		if (typeof value === "string" || typeof value === "number") {
			collector.add(`${key}{${String(value)}}`);
			continue;
		}
		if (typeof value !== "object" || Array.isArray(value)) continue;
		const block = declarations(value as Record<string, unknown>);
		if (block) collector.add(`${key}{${selector}{${block}}}`);
	}
}

function applySpacing(
	style: CSSProperties,
	collector: StyleCollector,
	property: keyof CSSProperties,
	alias: string,
	value: unknown,
): void {
	if (value == null) return;
	if (isResponsive(value as ResponsiveValue<string | number>)) {
		const resolved = resolveSpacing(alias, value as ResponsiveValue<string | number>);
		(style as Record<string, unknown>)[property] = resolved.ref;
		collector.add(resolved.cssBlock);
		return;
	}
	(style as Record<string, unknown>)[property] = normalizeSpacingValue(value as string | number);
}

function applyGeneric(
	style: CSSProperties,
	collector: StyleCollector,
	property: keyof CSSProperties,
	alias: string,
	value: unknown,
): void {
	if (value == null) return;
	if (isResponsive(value as ResponsiveValue<string>)) {
		const resolved = resolveGeneric(alias, value as ResponsiveValue<string>);
		(style as Record<string, unknown>)[property] = resolved.ref;
		collector.add(resolved.cssBlock);
		return;
	}
	(style as Record<string, unknown>)[property] = value;
}

const SIMPLE_PROPS: Array<[string, keyof CSSProperties]> = [
	["alignSelf", "alignSelf"], ["justifySelf", "justifySelf"], ["flex", "flex"],
	["border", "border"], ["borderTop", "borderTop"], ["borderBottom", "borderBottom"],
	["borderLeft", "borderLeft"], ["borderRight", "borderRight"], ["shadow", "boxShadow"],
	["boxShadow", "boxShadow"], ["transition", "transition"], ["backdrop", "backdropFilter"],
	["backdropFilter", "backdropFilter"], ["overflow", "overflow"], ["overflowX", "overflowX"],
	["overflowY", "overflowY"], ["cursor", "cursor"], ["position", "position"],
	["zIndex", "zIndex"], ["lineHeight", "lineHeight"], ["letterSpacing", "letterSpacing"],
	["transform", "transform"], ["transformOrigin", "transformOrigin"], ["filter", "filter"],
	["clipPath", "clipPath"], ["objectFit", "objectFit"], ["objectPosition", "objectPosition"],
	["aspectRatio", "aspectRatio"], ["fontStyle", "fontStyle"], ["textTransform", "textTransform"],
	["textDecoration", "textDecoration"], ["textShadow", "textShadow"], ["whiteSpace", "whiteSpace"],
	["wordBreak", "wordBreak"], ["pointerEvents", "pointerEvents"], ["userSelect", "userSelect"],
	["contentVisibility", "contentVisibility"], ["contain", "contain"], ["containIntrinsicSize", "containIntrinsicSize"],
];

export function compileCpropClass(cprop: CpropValue | undefined, collector: StyleCollector): string | undefined {
	if (!cprop) return undefined;
	const classes: string[] = [];
	const add = (style: EngineStyleObject | undefined, pseudo: string, prefix: string) => {
		if (!style) return;
		const body = declarations(style as Record<string, unknown>);
		if (!body && !Object.keys(style).some((key) => key.startsWith("@"))) return;
		const className = `${prefix}${stableHash(`${pseudo}:${JSON.stringify(style)}`)}`;
		if (body) collector.add(`.${className}${pseudo}{${body}}`);
		compileAtRules(style, `.${className}${pseudo}`, collector);
		classes.push(className);
	};
	add(cprop.onHover, ":hover", "e-h-");
	add(cprop.onFocus, ":focus-visible", "e-f-");
	add(cprop.onActive, ":active", "e-a-");
	add(cprop.onChecked, ":checked", "e-c-");
	add(cprop.onDisabled, ":disabled", "e-d-");
	add(cprop.onPlaceholder, ":placeholder-shown", "e-p-");
	return classes.length > 0 ? classes.join(" ") : undefined;
}

export function compileEngineStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	collector: StyleCollector,
	extraStyle?: CSSProperties | EngineStyleObject,
): CSSProperties {
	const style: CSSProperties = {};

	applySpacing(style, collector, "margin", "ma", props.m);
	applySpacing(style, collector, "marginTop", "mt", props.mt);
	applySpacing(style, collector, "marginRight", "mr", props.mr);
	applySpacing(style, collector, "marginBottom", "mb", props.mb);
	applySpacing(style, collector, "marginLeft", "ml", props.ml);
	applySpacing(style, collector, "padding", "pa", props.p);
	applySpacing(style, collector, "paddingTop", "pt", props.pt);
	applySpacing(style, collector, "paddingRight", "pr", props.pr);
	applySpacing(style, collector, "paddingBottom", "pb", props.pb);
	applySpacing(style, collector, "paddingLeft", "pl", props.pl);

	const axis = (key: "mx" | "my" | "px" | "py", first: keyof CSSProperties, second: keyof CSSProperties) => {
		const value = props[key];
		if (value == null) return;
		if (isResponsive(value as ResponsiveValue<string | number>)) {
			const resolved = resolveSpacing(key, value as ResponsiveValue<string | number>);
			(style as Record<string, unknown>)[first] = resolved.ref;
			(style as Record<string, unknown>)[second] = resolved.ref;
			collector.add(resolved.cssBlock);
			return;
		}
		const normalized = normalizeSpacingValue(value as string | number);
		(style as Record<string, unknown>)[first] = normalized;
		(style as Record<string, unknown>)[second] = normalized;
	};
	axis("mx", "marginLeft", "marginRight");
	axis("my", "marginTop", "marginBottom");
	axis("px", "paddingLeft", "paddingRight");
	axis("py", "paddingTop", "paddingBottom");

	applySpacing(style, collector, "width", "wi", props.w ?? props.width);
	applySpacing(style, collector, "height", "he", props.h ?? props.height);
	applySpacing(style, collector, "minWidth", "mn", props.minW ?? props.minWidth);
	applySpacing(style, collector, "minHeight", "mh", props.minH ?? props.minHeight);
	applySpacing(style, collector, "maxWidth", "mw", props.maxW ?? props.maxWidth);
	applySpacing(style, collector, "maxHeight", "xh", props.maxH ?? props.maxHeight);
	applySpacing(style, collector, "gap", "ga", props.gap);
	applySpacing(style, collector, "columnGap", "cg", props.colGap);
	applySpacing(style, collector, "rowGap", "rg", props.rowGap);
	applySpacing(style, collector, "borderRadius", "br", props.borderRadius);

	applyGeneric(style, collector, "display", "di", props.display);
	applyGeneric(style, collector, "flexDirection", "fd", props.flexDir);
	applyGeneric(style, collector, "alignItems", "ai", props.align ?? props.alignItems);
	applyGeneric(style, collector, "justifyContent", "jc", props.justify ?? props.justifyContent);
	applyGeneric(style, collector, "flexWrap", "wr", props.wrap);
	applyGeneric(style, collector, "order", "or", props.order);
	applyGeneric(style, collector, "fontSize", "fs", props.size ?? props.fontSize);
	applyGeneric(style, collector, "fontWeight", "ftw", props.weight ?? props.fontWeight);
	applyGeneric(style, collector, "textAlign", "ta", props.textAlign ?? props.align);
	applyGeneric(style, collector, "background", "bg", props.bg ?? props.background);
	applyGeneric(style, collector, "backgroundColor", "bc", props.backgroundColor);
	applyGeneric(style, collector, "backgroundImage", "bgi", props.backgroundImage);
	applyGeneric(style, collector, "backgroundSize", "bgs", props.backgroundSize);
	applyGeneric(style, collector, "backgroundRepeat", "bgr", props.backgroundRepeat);
	applyGeneric(style, collector, "backgroundPosition", "bgp", props.backgroundPosition);
	applyGeneric(style, collector, "color", "cl", props.color);
	applyGeneric(style, collector, "opacity", "op", props.opacity);
	applyGeneric(style, collector, "fontFamily", "ff", props.fontFamily);

	if (props.columns != null) {
		if (isResponsive(props.columns as ResponsiveValue<string | number>)) {
			const resolved = resolveColumns(props.columns as ResponsiveValue<string | number>);
			style.gridTemplateColumns = resolved.ref;
			collector.add(resolved.cssBlock);
		} else {
			style.gridTemplateColumns = typeof props.columns === "number" ? `repeat(${props.columns}, 1fr)` : String(props.columns);
		}
	}
	if (props.rows != null) applyGeneric(style, collector, "gridTemplateRows", "gr", props.rows);

	for (const [source, property] of SIMPLE_PROPS) {
		const value = props[source];
		if (value != null && (style as Record<string, unknown>)[property] == null) {
			(style as Record<string, unknown>)[property] = value;
		}
	}
	for (const edge of ["top", "right", "bottom", "left"] as const) {
		const value = props[edge];
		if (value != null) style[edge] = typeof value === "number" ? `${value}px` : value as any;
	}
	if (props.vars && typeof props.vars === "object") {
		for (const [key, value] of Object.entries(props.vars as Record<string, string>)) {
			(style as Record<string, unknown>)[key.startsWith("--") ? key : `--${key}`] = value;
		}
	}

	const inlineExtra: CSSProperties = {};
	if (extraStyle) {
		for (const [key, value] of Object.entries(extraStyle)) {
			if (key.startsWith("@")) continue;
			(inlineExtra as Record<string, unknown>)[key] = value;
		}
		const className = `.e-style-${stableHash(JSON.stringify(extraStyle))}`;
		compileAtRules(extraStyle as EngineStyleObject, className, collector);
	}
	return { ...style, ...inlineExtra };
}
