// ─────────────────────────────────────────────────────────────────────────────
//  Engine — usePropStyles
//
//  The central prop→style bridge used by every engine component.
//
//  It:
//    1. Accepts raw engine props (padding, gap, columns, display …)
//    2. Resolves every ResponsiveValue to a CSS custom property
//    3. Registers the resulting CSS blocks with globalStyleCollector
//    4. Returns a plain inline style object that references the CSS vars
//
//  Because the CSS is injected once by StyleCollector and all responsive
//  switching happens via @media in that <style> tag, the component itself
//  never needs to read window dimensions or re-render on resize.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { BaseNodeProps } from "../schema/types";
import {
	resolveSpacing,
	resolveGeneric,
	resolveColumns,
	isResponsive,
	normalizeSpacingValue,
} from "../core/resolver";
import { globalStyleCollector } from "../core/StyleCollector";

type StyleResult = {
	style: CSSProperties;
	extraCss: string[];
};

// ── Spacing helper ────────────────────────────────────────────────────────────

function applySpacing(
	cssProp: string,
	shortKey: string,
	value: unknown,
	style: CSSProperties,
	css: string[],
): void {
	if (value === undefined || value === null) return;

	if (isResponsive(value as any)) {
		const r = resolveSpacing(shortKey, value as any);
		(style as Record<string, string>)[cssProp] = r.ref;
		css.push(r.cssBlock);
	} else {
		(style as Record<string, string>)[cssProp] = normalizeSpacingValue(
			value as string | number,
		);
	}
}

// ── Generic (non-spacing) helper ──────────────────────────────────────────────

function applyGeneric(
	cssProp: string,
	shortKey: string,
	value: unknown,
	style: CSSProperties,
	css: string[],
): void {
	if (value === undefined || value === null) return;

	if (isResponsive(value as any)) {
		const r = resolveGeneric(shortKey, value as any);
		(style as Record<string, string>)[cssProp] = r.ref;
		css.push(r.cssBlock);
	} else {
		(style as Record<string, string>)[cssProp] = String(value);
	}
}

// ── Main hook ─────────────────────────────────────────────────────────────────

/**
 * Converts engine component props to a CSSProperties object.
 * Registers responsive CSS blocks with the global style collector.
 *
 * Returns a merged style object ready for `style={...}` on a DOM element.
 */
export function usePropStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	extraStyle?: CSSProperties,
): CSSProperties {
	const style: CSSProperties = {};
	const css: string[] = [];

	// ── Spacing ────────────────────────────────────────────────────────────────
	applySpacing("margin",        "ma", props.m,  style, css);
	applySpacing("marginTop",     "mt", props.mt, style, css);
	applySpacing("marginRight",   "mr", props.mr, style, css);
	applySpacing("marginBottom",  "mb", props.mb, style, css);
	applySpacing("marginLeft",    "ml", props.ml, style, css);
	applySpacing("padding",       "pa", props.p,  style, css);
	applySpacing("paddingTop",    "pt", props.pt, style, css);
	applySpacing("paddingRight",  "pr", props.pr, style, css);
	applySpacing("paddingBottom", "pb", props.pb, style, css);
	applySpacing("paddingLeft",   "pl", props.pl, style, css);

	// Shorthand axes
	if (props.mx !== undefined) {
		const r = isResponsive(props.mx)
			? resolveSpacing("mx", props.mx)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.mx as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["marginLeft"] = v;
		(style as Record<string, string>)["marginRight"] = v;
	}
	if (props.my !== undefined) {
		const r = isResponsive(props.my)
			? resolveSpacing("my", props.my)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.my as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["marginTop"] = v;
		(style as Record<string, string>)["marginBottom"] = v;
	}
	if (props.px !== undefined) {
		const r = isResponsive(props.px)
			? resolveSpacing("px", props.px)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.px as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["paddingLeft"] = v;
		(style as Record<string, string>)["paddingRight"] = v;
	}
	if (props.py !== undefined) {
		const r = isResponsive(props.py)
			? resolveSpacing("py", props.py)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.py as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["paddingTop"] = v;
		(style as Record<string, string>)["paddingBottom"] = v;
	}

	// ── Sizing ─────────────────────────────────────────────────────────────────
	applySpacing("width",     "wi", props.w,    style, css);
	applySpacing("height",    "he", props.h,    style, css);
	applySpacing("minWidth",  "mn", props.minW, style, css);
	applySpacing("minHeight", "mh", props.minH, style, css);
	applySpacing("maxWidth",  "mw", props.maxW, style, css);
	applySpacing("maxHeight", "xh", props.maxH, style, css);

	// ── Flex / Grid ────────────────────────────────────────────────────────────
	applySpacing("gap",       "ga", props.gap,    style, css);
	applySpacing("columnGap", "cg", props.colGap, style, css);
	applySpacing("rowGap",    "rg", props.rowGap, style, css);

	applyGeneric("display",         "di", props.display,  style, css);
	applyGeneric("flexDirection",   "fd", props.flexDir,  style, css);
	applyGeneric("alignItems",      "ai", props.align,    style, css);
	applyGeneric("justifyContent",  "jc", props.justify,  style, css);
	applyGeneric("flexWrap",        "fw", props.wrap,     style, css);
	applyGeneric("order",           "or", props.order,    style, css);
	applyGeneric("alignSelf",       "as", props.alignSelf, style, css);
	applyGeneric("justifySelf",     "js", props.justifySelf, style, css);

	if (props.flex !== undefined) style.flex = props.flex as string;

	// ── Grid template ──────────────────────────────────────────────────────────
	if ((props as any).columns !== undefined) {
		const col = (props as any).columns;
		if (isResponsive(col)) {
			const r = resolveColumns(col);
			(style as Record<string, string>)["gridTemplateColumns"] = r.ref;
			css.push(r.cssBlock);
		} else {
			const colsStr = typeof col === "number" ? `repeat(${col}, 1fr)` : String(col);
			(style as Record<string, string>)["gridTemplateColumns"] = colsStr;
		}
	}
	if ((props as any).rows !== undefined) {
		applyGeneric("gridTemplateRows", "gr", (props as any).rows, style, css);
	}

	// ── Text ───────────────────────────────────────────────────────────────────
	applyGeneric("fontSize",       "fs", (props as any).size,          style, css);
	applyGeneric("fontWeight",     "fw", (props as any).weight,        style, css);
	applyGeneric("textAlign",      "ta", (props as any).textAlign ?? (props as any).align, style, css);
	if ((props as any).lineHeight !== undefined)
		style.lineHeight = (props as any).lineHeight;
	if ((props as any).letterSpacing !== undefined)
		style.letterSpacing = (props as any).letterSpacing;

	// ── Border ─────────────────────────────────────────────────────────────────
	if (props.border !== undefined) style.border = props.border as string;
	if (props.borderTop !== undefined) style.borderTop = props.borderTop as string;
	if (props.borderBottom !== undefined) style.borderBottom = props.borderBottom as string;
	if (props.borderRadius !== undefined) {
		applySpacing("borderRadius", "br", props.borderRadius, style, css);
	}

	// ── Colours & effects ──────────────────────────────────────────────────────
	if (props.bg !== undefined) style.backgroundColor = props.bg as string;
	if (props.color !== undefined) style.color = props.color as string;
	if (props.opacity !== undefined) style.opacity = props.opacity as number;
	if (props.shadow !== undefined) style.boxShadow = props.shadow as string;
	if (props.overflow !== undefined) style.overflow = props.overflow as CSSProperties["overflow"];
	if (props.cursor !== undefined) style.cursor = props.cursor as CSSProperties["cursor"];

	// ── Position ───────────────────────────────────────────────────────────────
	if (props.position !== undefined) style.position = props.position as CSSProperties["position"];
	if (props.top !== undefined) style.top = typeof props.top === "number" ? `${props.top}px` : props.top as string;
	if (props.right !== undefined) style.right = typeof props.right === "number" ? `${props.right}px` : props.right as string;
	if (props.bottom !== undefined) style.bottom = typeof props.bottom === "number" ? `${props.bottom}px` : props.bottom as string;
	if (props.left !== undefined) style.left = typeof props.left === "number" ? `${props.left}px` : props.left as string;
	if (props.zIndex !== undefined) style.zIndex = props.zIndex as number;

	// ── Register all CSS blocks ────────────────────────────────────────────────
	globalStyleCollector.addMany(css);

	// ── Merge explicit style overrides ─────────────────────────────────────────
	return extraStyle ? { ...style, ...extraStyle } : style;
}
