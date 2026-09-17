// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — shared deterministic style compiler
//
// This module is intentionally React-hook free so the same style contract is
// used by both server-first rendering and the legacy/client primitive hooks.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type {
	BaseNodeProps,
	CpropValue,
	EngineStyleObject,
	ResponsiveValue,
} from "../schema/types";
import type { StyleCollector } from "../core/StyleCollector";
import {
	isResponsive,
	normalizeSpacingValue,
	resolveColumns,
	resolveGeneric,
	resolveSpacing,
} from "../core/resolver";

export interface EnginePrimitiveStyleLayers {
	/** Lowest-priority built-in styles supplied by the component. */
	defaults?: CSSProperties;
	/** Semantic component props such as variant/layout flags. */
	derived?: CSSProperties;
	/** Explicit caller style; intentionally wins over schema props. */
	style?: CSSProperties | EngineStyleObject;
	/** Required live/runtime state such as disabled positioning. */
	runtime?: CSSProperties;
}

function styleHash(source: string): string {
	let hash = 0;
	for (let index = 0; index < source.length; index += 1) {
		hash = (Math.imul(31, hash) + source.charCodeAt(index)) | 0;
	}
	return Math.abs(hash).toString(36).slice(0, 7);
}

function camelToKebab(value: string): string {
	return value.replace(/([A-Z])/g, "-$1").toLowerCase();
}

function isPlainStyleObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function cssToDeclBlock(
	style: CSSProperties | EngineStyleObject | Record<string, unknown>,
): string {
	return Object.entries(style)
		.filter(([key, value]) => value != null && !key.startsWith("@") && !isPlainStyleObject(value))
		.map(([key, value]) => `${camelToKebab(key)}:${String(value)}`)
		.join(";");
}

function getStyleAtRules(
	style: CSSProperties | EngineStyleObject | undefined,
): Array<[string, unknown]> {
	if (!style) return [];
	return Object.entries(style).filter(([key]) => key.startsWith("@"));
}

function hasStyleAtRules(style: CSSProperties | EngineStyleObject | undefined): boolean {
	return getStyleAtRules(style).length > 0;
}

function isSelectorScopedAtRule(key: string): boolean {
	return /^@(media|supports|container|layer|scope|starting-style)\b/i.test(key);
}

function isKeyframesAtRule(key: string): boolean {
	return /^@(?:-webkit-)?keyframes\b/i.test(key);
}

function serializeKeyframesAtRule(
	key: string,
	value: Record<string, unknown>,
): string {
	const blocks: string[] = [];
	for (const [selector, frameValue] of Object.entries(value)) {
		if (isPlainStyleObject(frameValue)) {
			const declarations = cssToDeclBlock(frameValue);
			if (declarations) blocks.push(`${selector}{${declarations}}`);
			continue;
		}
		if (typeof frameValue === "string") blocks.push(`${selector}{${frameValue}}`);
	}
	return blocks.length > 0 ? `${key}{${blocks.join("")}}` : "";
}

function normalizeAtRuleBlock(
	key: string,
	value: unknown,
	selector: string,
): string {
	if (!isPlainStyleObject(value)) {
		return typeof value === "string" ? `${key}{${value}}` : "";
	}
	if (isKeyframesAtRule(key)) return serializeKeyframesAtRule(key, value);

	const selectorScoped = isSelectorScopedAtRule(key);
	const declarations = cssToDeclBlock(value);
	const body: string[] = [];
	if (declarations) {
		body.push(selectorScoped ? `${selector}{${declarations}}` : declarations);
	}
	for (const [childKey, childValue] of Object.entries(value)) {
		if (!childKey.startsWith("@")) continue;
		const child = normalizeAtRuleBlock(childKey, childValue, selector);
		if (child) body.push(child);
	}
	return body.length > 0 ? `${key}{${body.join("")}}` : "";
}

function compileNestedStyleClass(
	style: CSSProperties | EngineStyleObject,
	prefix: string,
	collector: StyleCollector,
): string {
	const declarations = cssToDeclBlock(style);
	const atRules = getStyleAtRules(style);
	if (!declarations && atRules.length === 0) return "";

	const className = `${prefix}${styleHash(JSON.stringify(style))}`;
	const selector = `.${className}`;
	const blocks: string[] = [];
	if (declarations) blocks.push(`${selector}{${declarations}}`);
	for (const [key, value] of atRules) {
		const compiled = normalizeAtRuleBlock(key, value, selector);
		if (compiled) blocks.push(compiled);
	}
	collector.add(blocks.join("\n"));
	return className;
}

function compileAtRuleStyleVars(
	style: CSSProperties | EngineStyleObject | undefined,
	collector: StyleCollector,
): CSSProperties | undefined {
	if (!style) return undefined;
	const atRules = getStyleAtRules(style);
	if (atRules.length === 0) return style as CSSProperties;

	const hash = styleHash(JSON.stringify(style));
	const resolved: CSSProperties = {};
	const rootDeclarations: string[] = [];
	const atRuleBlocks: string[] = [];
	const variableFor = (key: string) => (
		`--e-at-${hash}-${camelToKebab(key).replace(/[^a-z0-9-]/gi, "-")}`
	);

	for (const [key, value] of Object.entries(style)) {
		if (key.startsWith("@") || value == null || isPlainStyleObject(value)) continue;
		const variable = variableFor(key);
		(resolved as Record<string, string>)[key] = `var(${variable}, ${String(value)})`;
		rootDeclarations.push(`${variable}:${String(value)}`);
	}

	for (const [key, value] of atRules) {
		if (!isSelectorScopedAtRule(key)) {
			const rawRule = normalizeAtRuleBlock(key, value, ":root");
			if (rawRule) atRuleBlocks.push(rawRule);
			continue;
		}
		if (!isPlainStyleObject(value)) {
			if (typeof value === "string") atRuleBlocks.push(`${key}{${value}}`);
			continue;
		}

		const declarations: string[] = [];
		for (const [nestedKey, nestedValue] of Object.entries(value)) {
			if (nestedKey.startsWith("@") || nestedValue == null || isPlainStyleObject(nestedValue)) continue;
			const variable = variableFor(nestedKey);
			if ((resolved as Record<string, string>)[nestedKey] === undefined) {
				(resolved as Record<string, string>)[nestedKey] = `var(${variable})`;
			}
			declarations.push(`${variable}:${String(nestedValue)}`);
		}
		if (declarations.length > 0) {
			atRuleBlocks.push(`${key}{:root{${declarations.join(";")}}}`);
		}
		for (const [childKey, childValue] of Object.entries(value)) {
			if (!childKey.startsWith("@")) continue;
			const child = normalizeAtRuleBlock(childKey, childValue, ":root");
			if (child) atRuleBlocks.push(`${key}{${child}}`);
		}
	}

	if (rootDeclarations.length > 0) {
		collector.add(`:root{${rootDeclarations.join(";")}}`);
	}
	collector.addMany(atRuleBlocks);
	return resolved;
}

export function compileStaticStyleClass(
	style: CSSProperties | EngineStyleObject,
	collector: StyleCollector,
): string {
	return compileNestedStyleClass(style, "e-s-", collector);
}

export function compileStyleAtRuleClass(
	style: CSSProperties | EngineStyleObject | undefined,
	collector: StyleCollector,
): string | undefined {
	if (!style || !hasStyleAtRules(style)) return undefined;
	const className = compileNestedStyleClass(style, "e-style-", collector);
	return className || undefined;
}

export function compileMediaClass(
	base: CSSProperties,
	breakpoints: Array<[string, CSSProperties]>,
	collector: StyleCollector,
): string {
	const baseDeclarations = cssToDeclBlock(base);
	const fingerprint = baseDeclarations
		+ breakpoints.map(([breakpoint, style]) => (
			`@media(min-width:${breakpoint}){.e-m-HASH{${cssToDeclBlock(style)}}}`
		)).join("");
	const className = `e-m-${styleHash(fingerprint)}`;
	let css = `.${className}{${baseDeclarations}}`;
	for (const [breakpoint, style] of breakpoints) {
		css += `@media(min-width:${breakpoint}){.${className}{${cssToDeclBlock(style)}}}`;
	}
	collector.add(css);
	return className;
}

export function compileCpropClass(
	cprop: CpropValue | undefined,
	collector: StyleCollector,
): string | undefined {
	if (!cprop) return undefined;
	const classes: string[] = [];
	const add = (
		style: EngineStyleObject | undefined,
		pseudo: string,
		prefix: string,
	): void => {
		if (!style) return;
		const declarations = cssToDeclBlock(style);
		if (!declarations && !hasStyleAtRules(style)) return;

		const className = `${prefix}${styleHash(`${pseudo}:${JSON.stringify(style)}`)}`;
		const selector = pseudo.includes(",")
			? pseudo.split(",").map((part) => `.${className}${part.trim()}`).join(",")
			: `.${className}${pseudo}`;
		if (declarations) collector.add(`${selector}{${declarations}}`);
		for (const [key, value] of getStyleAtRules(style)) {
			const compiled = normalizeAtRuleBlock(key, value, selector);
			if (compiled) collector.add(compiled);
		}
		classes.push(className);
	};

	add(cprop.onHover, ":hover", "e-h-");
	add(cprop.onFocus, ":focus,:focus-visible", "e-f-");
	add(cprop.onActive, ":active", "e-a-");
	add(cprop.onChecked, ":checked", "e-c-");
	add(cprop.onDisabled, ":disabled", "e-d-");
	add(cprop.onPlaceholder, ":placeholder-shown", "e-p-");
	return classes.length > 0 ? classes.join(" ") : undefined;
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
	(style as Record<string, unknown>)[property] = String(value);
}

const CSS_PASSTHROUGH: readonly string[] = [
	"transform", "transformOrigin", "transformStyle",
	"perspective", "perspectiveOrigin", "backfaceVisibility",
	"filter", "backdropFilter", "clipPath", "objectFit", "objectPosition",
	"aspectRatio", "float", "clear", "verticalAlign",
	"tableLayout", "borderCollapse", "borderSpacing",
	"columnCount", "columnWidth", "mixBlendMode", "isolation",
	"willChange", "contentVisibility", "contain", "containIntrinsicSize",
	"appearance", "resize", "visibility", "pointerEvents", "userSelect",
	"overflowX", "overflowY", "fontFamily", "fontStyle", "fontVariant", "fontStretch",
	"fontFeatureSettings", "fontVariationSettings", "textTransform",
	"textDecoration", "textDecorationColor", "textDecorationStyle", "textUnderlineOffset",
	"textShadow", "textIndent", "textRendering", "textWrap",
	"wordBreak", "wordSpacing", "whiteSpace", "hyphens", "writingMode", "direction",
	"caretColor", "accentColor", "lineBreak", "tabSize",
	"gridColumn", "gridRow", "gridArea", "gridColumnStart", "gridColumnEnd",
	"gridRowStart", "gridRowEnd", "gridAutoFlow", "gridAutoColumns", "gridAutoRows",
	"placeSelf", "placeItems", "placeContent", "animation",
	"animationName", "animationDuration", "animationDelay",
	"animationTimingFunction", "animationIterationCount",
	"animationFillMode", "animationPlayState", "animationDirection",
	"scrollSnapAlign", "scrollSnapStop",
	"scrollMarginTop", "scrollMarginBottom", "scrollMarginLeft", "scrollMarginRight",
	"scrollPaddingTop", "scrollPaddingBottom",
	"overscrollBehavior", "overscrollBehaviorX", "overscrollBehaviorY",
	"outline", "outlineColor", "outlineOffset", "outlineWidth", "outlineStyle",
	"listStyle", "listStyleType", "listStylePosition", "content",
	"fill", "stroke", "strokeWidth", "strokeDasharray", "strokeDashoffset",
	"strokeLinecap", "strokeLinejoin",
	"backgroundAttachment", "backgroundClip", "backgroundOrigin", "backgroundBlendMode",
];

const ALREADY_HANDLED = new Set([
	"cursor", "overflow", "transition",
	"background", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundRepeat", "backgroundPosition",
	"border", "borderTop", "borderBottom", "borderLeft", "borderRight",
	"zIndex", "position", "top", "right", "bottom", "left",
	"opacity", "boxShadow", "color", "alignSelf", "justifySelf", "flex",
]);

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

	const axis = (
		key: "mx" | "my" | "px" | "py",
		first: keyof CSSProperties,
		second: keyof CSSProperties,
	): void => {
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

	if (props.alignSelf != null) style.alignSelf = props.alignSelf as CSSProperties["alignSelf"];
	if (props.justifySelf != null) style.justifySelf = props.justifySelf as CSSProperties["justifySelf"];
	if (props.flex != null) style.flex = String(props.flex);

	if (props.columns != null) {
		if (isResponsive(props.columns as ResponsiveValue<string | number>)) {
			const resolved = resolveColumns(props.columns as ResponsiveValue<string | number>);
			style.gridTemplateColumns = resolved.ref;
			collector.add(resolved.cssBlock);
		} else {
			style.gridTemplateColumns = typeof props.columns === "number"
				? `repeat(${props.columns}, 1fr)`
				: String(props.columns);
		}
	}
	if (props.rows != null) applyGeneric(style, collector, "gridTemplateRows", "gr", props.rows);

	if (props.lineHeight != null) style.lineHeight = props.lineHeight as CSSProperties["lineHeight"];
	if (props.letterSpacing != null) style.letterSpacing = props.letterSpacing as CSSProperties["letterSpacing"];
	if (props.border != null) style.border = String(props.border);
	if (props.borderTop != null) style.borderTop = String(props.borderTop);
	if (props.borderBottom != null) style.borderBottom = String(props.borderBottom);
	if (props.borderLeft != null) style.borderLeft = String(props.borderLeft);
	if (props.borderRight != null) style.borderRight = String(props.borderRight);
	if (props.shadow != null) style.boxShadow = String(props.shadow);
	if (props.boxShadow != null) style.boxShadow = String(props.boxShadow);
	if (props.transition != null) style.transition = String(props.transition);
	if (props.backdrop != null) style.backdropFilter = String(props.backdrop);
	if (props.backdropFilter != null) style.backdropFilter = props.backdropFilter as CSSProperties["backdropFilter"];
	if (props.overflow != null) style.overflow = props.overflow as CSSProperties["overflow"];
	if (props.cursor != null) style.cursor = props.cursor as CSSProperties["cursor"];
	if (props.position != null) style.position = props.position as CSSProperties["position"];
	if (props.zIndex != null) style.zIndex = props.zIndex as CSSProperties["zIndex"];

	for (const edge of ["top", "right", "bottom", "left"] as const) {
		const value = props[edge];
		if (value != null) {
			style[edge] = typeof value === "number" ? `${value}px` : value as any;
		}
	}

	if (props.vars != null && typeof props.vars === "object") {
		for (const [key, value] of Object.entries(props.vars as Record<string, string>)) {
			(style as Record<string, unknown>)[key.startsWith("--") ? key : `--${key}`] = value;
		}
	}

	if (Array.isArray(props.sides) && props.sides.length > 0 && props.sideDistance != null) {
		const value = normalizeSpacingValue(props.sideDistance as string | number);
		const margin = props.sideType !== "padding";
		const sides: Record<number, keyof CSSProperties> = {
			1: margin ? "marginTop" : "paddingTop",
			2: margin ? "marginLeft" : "paddingLeft",
			3: margin ? "marginRight" : "paddingRight",
			4: margin ? "marginBottom" : "paddingBottom",
		};
		for (const side of props.sides) {
			const property = sides[side];
			if (property) (style as Record<string, unknown>)[property] = value;
		}
	}

	for (const key of CSS_PASSTHROUGH) {
		if (ALREADY_HANDLED.has(key)) continue;
		const value = props[key];
		if (value == null || (style as Record<string, unknown>)[key] != null) continue;
		if (isResponsive(value as ResponsiveValue<string>)) {
			const resolved = resolveGeneric(key, value as ResponsiveValue<string>);
			(style as Record<string, unknown>)[key] = resolved.ref;
			collector.add(resolved.cssBlock);
		} else {
			(style as Record<string, unknown>)[key] = value;
		}
	}

	const compiledExtra = compileAtRuleStyleVars(extraStyle, collector);
	return compiledExtra ? { ...style, ...compiledExtra } : style;
}

export function compilePrimitiveStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	collector: StyleCollector,
	layers: EnginePrimitiveStyleLayers = {},
): CSSProperties {
	const resolvedUserStyle = compileEngineStyles(props, collector, layers.style);
	return {
		...(layers.defaults ?? {}),
		...(layers.derived ?? {}),
		...resolvedUserStyle,
		...(layers.runtime ?? {}),
	};
}
