// ─────────────────────────────────────────────────────────────────────────────
//  Engine — usePropStyles + cpropClass
//
//  usePropStyles   — converts engine props → CSSProperties (unchanged)
//  cpropClass      — converts cprop pseudo-states → injected CSS class names
//
//  cpropClass is a separate utility so components can call it alongside
//  usePropStyles without changing usePropStyles's return type.
//
//  CpropValue pseudo-states (onHover / onFocus / onActive) are compiled to
//  CSS rules and injected into StyleCollector. A hash-based class name is
//  returned and merged into the component's className, giving pure CSS
//  pseudo-class behaviour with zero JS event handlers.
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { BaseNodeProps, CpropValue } from "../schema/types";
import {
	resolveSpacing,
	resolveGeneric,
	resolveColumns,
	isResponsive,
	normalizeSpacingValue,
} from "../core/resolver";
import { globalStyleCollector } from "../core/StyleCollector";

// ── Short hash (same algo as StyleCollector) ──────────────────────────────────

function _hash(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return Math.abs(h).toString(36).slice(0, 7);
}

// ── camelCase → kebab-case ────────────────────────────────────────────────────

function camelToKebab(key: string): string {
	return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

// ── Object of CSS declarations → CSS block string ────────────────────────────

function recordToCss(record: Record<string, string | number>): string {
	return Object.entries(record)
		.map(([k, v]) => `${camelToKebab(k)}:${v}`)
		.join(";");
}

// ── cpropClass ────────────────────────────────────────────────────────────────

/**
 * Compiles a CpropValue's pseudo-class states (onHover / onFocus / onActive)
 * into CSS rules, registers them with globalStyleCollector, and returns a
 * space-separated string of generated class names to attach to the element.
 *
 * Returns undefined when cprop is falsy or has no pseudo-state entries.
 *
 * @example
 * const hoverClass = cpropClass(props.cprop);
 * // hoverClass → "e-h-1a2b3c4" or undefined
 */
export function cpropClass(cprop: CpropValue | undefined): string | undefined {
	if (!cprop) return undefined;

	const classes: string[] = [];

	if (cprop.onHover && Object.keys(cprop.onHover).length > 0) {
		const declarations = recordToCss(cprop.onHover);
		const hash   = _hash(`hover:${declarations}`);
		const cls    = `e-h-${hash}`;
		globalStyleCollector.add(`.${cls}:hover{${declarations}}`);
		classes.push(cls);
	}

	if (cprop.onFocus && Object.keys(cprop.onFocus).length > 0) {
		const declarations = recordToCss(cprop.onFocus);
		const hash   = _hash(`focus:${declarations}`);
		const cls    = `e-f-${hash}`;
		globalStyleCollector.add(`.${cls}:focus,.${cls}:focus-visible{${declarations}}`);
		classes.push(cls);
	}

	if (cprop.onActive && Object.keys(cprop.onActive).length > 0) {
		const declarations = recordToCss(cprop.onActive);
		const hash   = _hash(`active:${declarations}`);
		const cls    = `e-a-${hash}`;
		globalStyleCollector.add(`.${cls}:active{${declarations}}`);
		classes.push(cls);
	}

	return classes.length > 0 ? classes.join(" ") : undefined;
}

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
 * Also applies cprop.css direct overrides to the inline style.
 *
 * For cprop pseudo-class states (onHover / onFocus / onActive) call
 * cpropClass(props.cprop) separately and merge the result into className.
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
		(style as Record<string, string>)["marginLeft"]  = v;
		(style as Record<string, string>)["marginRight"] = v;
	}
	if (props.my !== undefined) {
		const r = isResponsive(props.my)
			? resolveSpacing("my", props.my)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.my as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["marginTop"]    = v;
		(style as Record<string, string>)["marginBottom"] = v;
	}
	if (props.px !== undefined) {
		const r = isResponsive(props.px)
			? resolveSpacing("px", props.px)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.px as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["paddingLeft"]  = v;
		(style as Record<string, string>)["paddingRight"] = v;
	}
	if (props.py !== undefined) {
		const r = isResponsive(props.py)
			? resolveSpacing("py", props.py)
			: null;
		const v = r ? r.ref : normalizeSpacingValue(props.py as string | number);
		if (r) css.push(r.cssBlock);
		(style as Record<string, string>)["paddingTop"]    = v;
		(style as Record<string, string>)["paddingBottom"] = v;
	}

	// ── Sizing ─────────────────────────────────────────────────────────────────
	applySpacing("width",     "wi", props.w ?? props.width,       style, css);
	applySpacing("height",    "he", props.h ?? props.height,      style, css);
	applySpacing("minWidth",  "mn", props.minW ?? props.minWidth, style, css);
	applySpacing("minHeight", "mh", props.minH ?? props.minHeight, style, css);
	applySpacing("maxWidth",  "mw", props.maxW ?? props.maxWidth, style, css);
	applySpacing("maxHeight", "xh", props.maxH ?? props.maxHeight, style, css);

	// ── Flex / Grid ────────────────────────────────────────────────────────────
	applySpacing("gap",       "ga", props.gap,    style, css);
	applySpacing("columnGap", "cg", props.colGap, style, css);
	applySpacing("rowGap",    "rg", props.rowGap, style, css);

	applyGeneric("display",         "di", props.display,  style, css);
	applyGeneric("flexDirection",   "fd", props.flexDir,  style, css);
	applyGeneric("alignItems",      "ai", props.align ?? (props as any).alignItems, style, css);
	applyGeneric("justifyContent",  "jc", props.justify ?? (props as any).justifyContent, style, css);
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
	if ((props as any).columns === undefined && (props as any).gridTemplateColumns !== undefined) {
		applyGeneric("gridTemplateColumns", "gt", (props as any).gridTemplateColumns, style, css);
	}
	if ((props as any).rows !== undefined) {
		applyGeneric("gridTemplateRows", "gr", (props as any).rows, style, css);
	}
	if ((props as any).rows === undefined && (props as any).gridTemplateRows !== undefined) {
		applyGeneric("gridTemplateRows", "gr", (props as any).gridTemplateRows, style, css);
	}

	// ── Text ───────────────────────────────────────────────────────────────────
	applyGeneric("fontSize",       "fs", (props as any).size ?? (props as any).fontSize, style, css);
	applyGeneric("fontWeight",     "fw", (props as any).weight ?? (props as any).fontWeight, style, css);
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
	if (props.bg !== undefined) style.background = props.bg as string;
	if (props.color !== undefined) style.color = props.color as string;
	if (props.opacity !== undefined) style.opacity = props.opacity as number;
	if (props.shadow !== undefined) style.boxShadow = props.shadow as string;
	if (props.boxShadow !== undefined) style.boxShadow = props.boxShadow as string;
	if (props.overflow !== undefined) style.overflow = props.overflow as CSSProperties["overflow"];
	if (props.cursor !== undefined) style.cursor = props.cursor as CSSProperties["cursor"];
	if (props.transition !== undefined) style.transition = props.transition as string;
	if (props.backgroundImage !== undefined) style.backgroundImage = props.backgroundImage as string;
	if (props.backgroundSize !== undefined) style.backgroundSize = props.backgroundSize as string;
	if (props.backgroundRepeat !== undefined) style.backgroundRepeat = props.backgroundRepeat as string;
	if (props.backgroundPosition !== undefined) style.backgroundPosition = props.backgroundPosition as string;
	if (props.backdrop !== undefined) style.backdropFilter = props.backdrop as string;
	if (props.backdropFilter !== undefined) style.backdropFilter = props.backdropFilter as string;

	// ── Position ───────────────────────────────────────────────────────────────
	if (props.position !== undefined) style.position = props.position as CSSProperties["position"];
	if (props.top !== undefined) style.top = typeof props.top === "number" ? `${props.top}px` : props.top as string;
	if (props.right !== undefined) style.right = typeof props.right === "number" ? `${props.right}px` : props.right as string;
	if (props.bottom !== undefined) style.bottom = typeof props.bottom === "number" ? `${props.bottom}px` : props.bottom as string;
	if (props.left !== undefined) style.left = typeof props.left === "number" ? `${props.left}px` : props.left as string;
	if (props.zIndex !== undefined) style.zIndex = props.zIndex as number;

	// ── Register all CSS blocks ────────────────────────────────────────────────
	globalStyleCollector.addMany(css);

	// ── vars — CSS custom properties ──────────────────────────────────────────
	if (props.vars !== undefined && typeof props.vars === "object") {
		for (const [key, value] of Object.entries(props.vars as Record<string, string>)) {
			const cssKey = key.startsWith("--") ? key : `--${key}`;
			(style as Record<string, string>)[cssKey] = value;
		}
	}

	// ── sides — per-side distance (1=top 2=left 3=right 4=bottom) ─────────────
	if (
		Array.isArray(props.sides) &&
		props.sides.length > 0 &&
		props.sideDistance !== undefined
	) {
		const dist = normalizeSpacingValue(props.sideDistance as string | number);
		const isMargin = (props.sideType as string) !== "padding";
		const SIDE_MAP: Record<number, string> = {
			1: isMargin ? "marginTop"    : "paddingTop",
			2: isMargin ? "marginLeft"   : "paddingLeft",
			3: isMargin ? "marginRight"  : "paddingRight",
			4: isMargin ? "marginBottom" : "paddingBottom",
		};
		for (const side of props.sides as number[]) {
			const cssProp = SIDE_MAP[side];
			if (cssProp) (style as Record<string, string>)[cssProp] = dist;
		}
	}

	// ── cprop.css — direct CSS property additions ──────────────────────────────
	// cprop pseudo-states (onHover/onFocus/onActive) are handled by cpropClass()
	// and injected as CSS rules, not inline style.
	if (props.cprop !== undefined) {
		const cp = props.cprop as CpropValue;
		if (cp.css) Object.assign(style, cp.css);
	}

	// ── Merge explicit style overrides ─────────────────────────────────────────
	return extraStyle ? { ...style, ...extraStyle } : style;
}
