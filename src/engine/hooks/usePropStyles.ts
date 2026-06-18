// ─────────────────────────────────────────────────────────────────────────────
// 	Engine — usePropStyles + cpropClass
//
// 	usePropStyles   — converts engine props + direct CSS props → CSSProperties
// 	cpropClass      — compiles cprop pseudo-states → injected CSS class names
// ─────────────────────────────────────────────────────────────────────────────

import type { CSSProperties } from "react";
import type { BaseNodeProps, CpropValue, EngineStyleObject } from "../schema/types";
import {
	resolveSpacing,
	resolveGeneric,
	resolveColumns,
	isResponsive,
	normalizeSpacingValue,
} from "../core/resolver";
import { globalStyleCollector } from "../core/StyleCollector";

// ── Short hash ────────────────────────────────────────────────────────────────

function _hash(sourceStyleString: string): string {
	let hashingBuffer = 0;
	for (let characterIndex = 0; characterIndex < sourceStyleString.length; characterIndex++) {
		hashingBuffer = (Math.imul(31, hashingBuffer) + sourceStyleString.charCodeAt(characterIndex)) | 0;
	}
	return Math.abs(hashingBuffer).toString(36).slice(0, 7);
}

// ── camelCase → kebab-case ────────────────────────────────────────────────────

function camelToKebab(camelCaseKey: string): string {
	return camelCaseKey.replace(/([A-Z])/g, "-$1").toLowerCase();
}

// ── CSSProperties → CSS declaration string ────────────────────────────────────

function isPlainStyleObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function cssToDeclBlock(cssPropertiesMap: CSSProperties | EngineStyleObject): string {
	return Object.entries(cssPropertiesMap)
		.filter(([propertyKey, propertyValue]) => propertyValue != null && !propertyKey.startsWith("@") && !isPlainStyleObject(propertyValue))
		.map(([propertyKey, propertyValue]) => `${camelToKebab(propertyKey)}:${propertyValue}`)
		.join(";");
}

function getStyleAtRules(cssPropertiesMap: CSSProperties | EngineStyleObject | undefined): [string, unknown][] {
	if (!cssPropertiesMap) return [];
	return Object.entries(cssPropertiesMap).filter(([propertyKey]) => propertyKey.startsWith("@"));
}

function hasStyleAtRules(cssPropertiesMap: CSSProperties | EngineStyleObject | undefined): boolean {
	return getStyleAtRules(cssPropertiesMap).length > 0;
}

function normalizeAtRuleBlock(atRuleKey: string, nestedValue: unknown, selector: string): string {
	if (!isPlainStyleObject(nestedValue)) {
		return typeof nestedValue === "string" ? `${atRuleKey}{${nestedValue}}` : "";
	}

	const nestedDeclarations = cssToDeclBlock(nestedValue as EngineStyleObject);
	const nestedRules: string[] = [];
	const selectorScopedAtRule = /^@(media|supports|container|layer|scope|starting-style)\b/i.test(atRuleKey);

	if (nestedDeclarations) {
		nestedRules.push(selectorScopedAtRule
			? `${atRuleKey}{${selector}{${nestedDeclarations}}}`
			: `${atRuleKey}{${nestedDeclarations}}`);
	}

	for (const [nestedKey, childValue] of Object.entries(nestedValue)) {
		if (!nestedKey.startsWith("@")) continue;
		const childRule = normalizeAtRuleBlock(nestedKey, childValue, selector);
		if (!childRule) continue;
		nestedRules.push(selectorScopedAtRule ? `${atRuleKey}{${childRule}}` : childRule);
	}

	return nestedRules.join("\n");
}

function compileNestedStyleClass(cssPropertiesMap: CSSProperties | EngineStyleObject, classPrefixString: string): string {
	const baseDeclarations = cssToDeclBlock(cssPropertiesMap);
	const atRules = getStyleAtRules(cssPropertiesMap);
	if (!baseDeclarations && atRules.length === 0) return "";

	const styleContentHash = _hash(JSON.stringify(cssPropertiesMap));
	const targetClassIdentifier = `${classPrefixString}${styleContentHash}`;
	const selector = `.${targetClassIdentifier}`;
	const compiledBlocks: string[] = [];

	if (baseDeclarations) compiledBlocks.push(`${selector}{${baseDeclarations}}`);
	for (const [atRuleKey, nestedValue] of atRules) {
		const compiledAtRule = normalizeAtRuleBlock(atRuleKey, nestedValue, selector);
		if (compiledAtRule) compiledBlocks.push(compiledAtRule);
	}

	globalStyleCollector.add(compiledBlocks.join("\n"));
	return targetClassIdentifier;
}

function compileAtRuleStyleVars(cssPropertiesMap: CSSProperties | EngineStyleObject | undefined): CSSProperties | undefined {
	if (!cssPropertiesMap) return undefined;
	const atRules = getStyleAtRules(cssPropertiesMap);
	if (atRules.length === 0) return cssPropertiesMap as CSSProperties;

	const styleContentHash = _hash(JSON.stringify(cssPropertiesMap));
	const resolvedStyle: CSSProperties = {};
	const rootDeclarations: string[] = [];
	const atRuleBlocks: string[] = [];
	const variableForProperty = (propertyKey: string) => `--e-at-${styleContentHash}-${camelToKebab(propertyKey).replace(/[^a-z0-9-]/gi, "-")}`;

	for (const [propertyKey, propertyValue] of Object.entries(cssPropertiesMap)) {
		if (propertyKey.startsWith("@") || propertyValue == null || isPlainStyleObject(propertyValue)) continue;
		const variableName = variableForProperty(propertyKey);
		(resolvedStyle as Record<string, string>)[propertyKey] = `var(${variableName})`;
		rootDeclarations.push(`${variableName}:${propertyValue}`);
	}

	for (const [atRuleKey, nestedValue] of atRules) {
		if (!isPlainStyleObject(nestedValue)) {
			if (typeof nestedValue === "string") atRuleBlocks.push(`${atRuleKey}{${nestedValue}}`);
			continue;
		}

		const nestedVariableDeclarations: string[] = [];
		for (const [nestedPropertyKey, nestedPropertyValue] of Object.entries(nestedValue)) {
			if (nestedPropertyKey.startsWith("@") || nestedPropertyValue == null || isPlainStyleObject(nestedPropertyValue)) continue;
			const variableName = variableForProperty(nestedPropertyKey);
			(resolvedStyle as Record<string, string>)[nestedPropertyKey] = `var(${variableName})`;
			nestedVariableDeclarations.push(`${variableName}:${nestedPropertyValue}`);
		}

		if (nestedVariableDeclarations.length > 0) {
			atRuleBlocks.push(`${atRuleKey}{:root{${nestedVariableDeclarations.join(";")}}}`);
		}

		for (const [nestedAtRuleKey, childValue] of Object.entries(nestedValue)) {
			if (!nestedAtRuleKey.startsWith("@")) continue;
			const childStyle = compileAtRuleStyleVars({ [nestedAtRuleKey]: childValue } as EngineStyleObject);
			void childStyle;
		}
	}

	if (rootDeclarations.length > 0) {
		globalStyleCollector.add(`:root{${rootDeclarations.join(";")}}`);
	}
	globalStyleCollector.addMany(atRuleBlocks);

	return resolvedStyle;
}

// ── cpropClass ────────────────────────────────────────────────────────────────

export function cpropClass(cpropContainerInstance: CpropValue | undefined): string | undefined {
	if (!cpropContainerInstance) return undefined;
	const processedClassNamesList: string[] = [];

	const injectSubBlockRule = (styleDeclarationsMap: EngineStyleObject, pseudoSelectorString: string, classPrefixString: string): void => {
		const structuralDeclarationBlock = cssToDeclBlock(styleDeclarationsMap);
		if (!structuralDeclarationBlock && !hasStyleAtRules(styleDeclarationsMap)) return;
		const styleContentHash = _hash(`${pseudoSelectorString}:${JSON.stringify(styleDeclarationsMap)}`);
		const TargetClassIdentifier = `${classPrefixString}${styleContentHash}`;
		const structuredCssRule = pseudoSelectorString.includes(",")
			? pseudoSelectorString.split(",").map((splitSelector) => `.${TargetClassIdentifier}${splitSelector.trim()}`).join(",") + `{${structuralDeclarationBlock}}`
			: `.${TargetClassIdentifier}${pseudoSelectorString}{${structuralDeclarationBlock}}`;
		globalStyleCollector.add(structuredCssRule);
		for (const [atRuleKey, nestedValue] of getStyleAtRules(styleDeclarationsMap)) {
			const pseudoSelector = pseudoSelectorString.includes(",")
				? pseudoSelectorString.split(",").map((splitSelector) => `.${TargetClassIdentifier}${splitSelector.trim()}`).join(",")
				: `.${TargetClassIdentifier}${pseudoSelectorString}`;
			const compiledAtRule = normalizeAtRuleBlock(atRuleKey, nestedValue, pseudoSelector);
			if (compiledAtRule) globalStyleCollector.add(compiledAtRule);
		}
		processedClassNamesList.push(TargetClassIdentifier);
	};

	if (cpropContainerInstance.onHover)       injectSubBlockRule(cpropContainerInstance.onHover,       ":hover",                  "e-h-");
	if (cpropContainerInstance.onFocus)       injectSubBlockRule(cpropContainerInstance.onFocus,       ":focus,:focus-visible",   "e-f-");
	if (cpropContainerInstance.onActive)      injectSubBlockRule(cpropContainerInstance.onActive,      ":active",                 "e-a-");
	if (cpropContainerInstance.onChecked)     injectSubBlockRule(cpropContainerInstance.onChecked,     ":checked",                "e-c-");
	if (cpropContainerInstance.onDisabled)    injectSubBlockRule(cpropContainerInstance.onDisabled,    ":disabled",               "e-d-");
	if (cpropContainerInstance.onPlaceholder) injectSubBlockRule(cpropContainerInstance.onPlaceholder, ":placeholder-shown",      "e-p-");

	return processedClassNamesList.length > 0 ? processedClassNamesList.join(" ") : undefined;
}

// ── Spacing helper ────────────────────────────────────────────────────────────

function applySpacing(
	targetCssPropertyKey: string,
	engineShorthandAlias: string,
	incomingValue: unknown,
	computedStyleOutputMap: CSSProperties,
	aggregatedStyleBlocksList: string[],
) {
	if (incomingValue == null) return;
	if (isResponsive(incomingValue as any)) {
		const spacingResolutionPayload = resolveSpacing(engineShorthandAlias, incomingValue as any);
		(computedStyleOutputMap as Record<string, string>)[targetCssPropertyKey] = spacingResolutionPayload.ref;
		aggregatedStyleBlocksList.push(spacingResolutionPayload.cssBlock);
	} else {
		(computedStyleOutputMap as Record<string, string>)[targetCssPropertyKey] = normalizeSpacingValue(incomingValue as string | number);
	}
}

// ── Generic (non-spacing) helper ──────────────────────────────────────────────

function applyGeneric(
	targetCssPropertyKey: string,
	engineShorthandAlias: string,
	incomingValue: unknown,
	computedStyleOutputMap: CSSProperties,
	aggregatedStyleBlocksList: string[],
) {
	if (incomingValue == null) return;
	if (isResponsive(incomingValue as any)) {
		const genericResolutionPayload = resolveGeneric(engineShorthandAlias, incomingValue as any);
		(computedStyleOutputMap as Record<string, string>)[targetCssPropertyKey] = genericResolutionPayload.ref;
		aggregatedStyleBlocksList.push(genericResolutionPayload.cssBlock);
	} else {
		(computedStyleOutputMap as Record<string, string>)[targetCssPropertyKey] = String(incomingValue);
	}
}

// ── CSS passthrough list ──────────────────────────────────────────────────────

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
];

const ALREADY_HANDLED = new Set([
	"cursor", "overflow", "transition",
	"backgroundImage", "backgroundSize", "backgroundRepeat", "backgroundPosition",
	"border", "borderTop", "borderBottom", "borderLeft", "borderRight",
	"zIndex", "position", "top", "right", "bottom", "left",
	"opacity", "boxShadow", "color", "alignSelf", "justifySelf", "flex",
]);

// ── Static class generator ────────────────────────────────────────────────────
//
//  Converts a plain CSSProperties object into a deduplicated CSS class.
//  Identical property sets share the same class name across the whole page,
//  eliminating repeated inline style declarations on inner-wrapper divs.
//
//  Usage:
//    const cls = staticClass({ width: "100%", maxWidth: "1200px", margin: "0 auto" });
//    // → "e-s-abc123"  (injected once into globalStyleCollector)

export function staticClass(cssProperties: CSSProperties | EngineStyleObject): string {
	return compileNestedStyleClass(cssProperties, "e-s-");
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function usePropStyles(
	props: Partial<BaseNodeProps> & Record<string, unknown>,
	extraStyle?: CSSProperties | EngineStyleObject,
): CSSProperties {
	const style: CSSProperties = {};
	const css:   string[]      = [];

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

	const resolveAxis = (
		axisPropKey: string,
		cssTargetPropertyA: string,
		cssTargetPropertyB: string,
	): void => {
		const axisInputValue = props[axisPropKey as keyof typeof props];
		if (axisInputValue == null) return;
		const axisResolutionPayload = isResponsive(axisInputValue as any) ? resolveSpacing(axisPropKey, axisInputValue as any) : null;
		const finalCalculatedValue = axisResolutionPayload ? axisResolutionPayload.ref : normalizeSpacingValue(axisInputValue as string | number);
		if (axisResolutionPayload) css.push(axisResolutionPayload.cssBlock);
		(style as Record<string, string>)[cssTargetPropertyA] = finalCalculatedValue;
		(style as Record<string, string>)[cssTargetPropertyB] = finalCalculatedValue;
	};

	resolveAxis("mx", "marginLeft",  "marginRight");
	resolveAxis("my", "marginTop",   "marginBottom");
	resolveAxis("px", "paddingLeft", "paddingRight");
	resolveAxis("py", "paddingTop",  "paddingBottom");

	// ── Sizing ─────────────────────────────────────────────────────────────────
	applySpacing("width",     "wi", props.w ?? props.width,       style, css);
	applySpacing("height",    "he", props.h ?? props.height,      style, css);
	applySpacing("minWidth",  "mn", props.minW ?? props.minWidth, style, css);
	applySpacing("minHeight", "mh", props.minH ?? props.minHeight, style, css);
	applySpacing("maxWidth",  "mw", props.maxW ?? props.maxWidth, style, css);
	applySpacing("maxHeight", "xh", props.maxH ?? props.maxHeight, style, css);

	// ── Flex / Grid layout ────────────────────────────────────────────────────
	applySpacing("gap",       "ga", props.gap,    style, css);
	applySpacing("columnGap", "cg", props.colGap, style, css);
	applySpacing("rowGap",    "rg", props.rowGap, style, css);

	applyGeneric("display",        "di", props.display,                                 style, css);
	applyGeneric("flexDirection",  "fd", props.flexDir,                                 style, css);
	applyGeneric("alignItems",     "ai", props.align ?? (props as any).alignItems,      style, css);
	applyGeneric("justifyContent", "jc", props.justify ?? (props as any).justifyContent, style, css);
	applyGeneric("flexWrap",       "fw", props.wrap,                                    style, css);
	applyGeneric("order",          "or", props.order,                                   style, css);

	if (props.alignSelf   != null) style.alignSelf   = props.alignSelf   as CSSProperties["alignSelf"];
	if (props.justifySelf != null) style.justifySelf = props.justifySelf as CSSProperties["justifySelf"];
	if (props.flex        != null) style.flex        = props.flex as string;

	// ── Grid template ─────────────────────────────────────────────────────────
	if ((props as any).columns != null) {
		const currentGridColumnsValue = (props as any).columns;
		if (isResponsive(currentGridColumnsValue)) {
			const structuralColumnsPayload = resolveColumns(currentGridColumnsValue);
			(style as Record<string, string>)["gridTemplateColumns"] = structuralColumnsPayload.ref;
			css.push(structuralColumnsPayload.cssBlock);
		} else {
			const explicitlyBuiltColumnsString = typeof currentGridColumnsValue === "number" ? `repeat(${currentGridColumnsValue}, 1fr)` : String(currentGridColumnsValue);
			(style as Record<string, string>)["gridTemplateColumns"] = explicitlyBuiltColumnsString;
		}
	}
	if ((props as any).rows != null) {
		applyGeneric("gridTemplateRows", "gr", (props as any).rows, style, css);
	}

	// ── Text ──────────────────────────────────────────────────────────────────
	applyGeneric("fontSize",   "fs", (props as any).size ?? (props as any).fontSize,     style, css);
	applyGeneric("fontWeight", "fw", (props as any).weight ?? (props as any).fontWeight, style, css);
	applyGeneric("textAlign",  "ta", (props as any).textAlign ?? (props as any).align,   style, css);
	if ((props as any).lineHeight   != null) style.lineHeight   = (props as any).lineHeight;
	if ((props as any).letterSpacing != null) style.letterSpacing = (props as any).letterSpacing;

	// ── Border ────────────────────────────────────────────────────────────────
	if (props.border       != null) style.border       = props.border as string;
	if (props.borderTop    != null) style.borderTop    = props.borderTop as string;
	if (props.borderBottom != null) style.borderBottom = props.borderBottom as string;
	if (props.borderLeft   != null) style.borderLeft   = props.borderLeft as string;
	if (props.borderRight  != null) style.borderRight  = props.borderRight as string;
	if (props.borderRadius != null) applySpacing("borderRadius", "br", props.borderRadius, style, css);

	// ── Colours & effects ─────────────────────────────────────────────────────
	if (props.bg            != null) style.background      = props.bg as string;
	if (props.color         != null) style.color           = props.color as string;
	if (props.opacity       != null) style.opacity         = props.opacity as number;
	if (props.shadow        != null) style.boxShadow       = props.shadow as string;
	if (props.boxShadow     != null) style.boxShadow       = props.boxShadow as string;
	if (props.transition    != null) style.transition      = props.transition as string;
	if (props.backgroundImage != null) style.backgroundImage = props.backgroundImage as string;
	if (props.backgroundSize  != null) style.backgroundSize  = props.backgroundSize as string;
	if (props.backgroundRepeat!= null) style.backgroundRepeat= props.backgroundRepeat as string;
	if (props.backgroundPosition != null) style.backgroundPosition = props.backgroundPosition as string;
	if (props.backdrop        != null) style.backdropFilter  = props.backdrop as string;
	if (props.backdropFilter  != null) style.backdropFilter  = props.backdropFilter as string;
	if (props.overflow        != null) style.overflow        = props.overflow as CSSProperties["overflow"];
	if (props.cursor          != null) style.cursor          = props.cursor as CSSProperties["cursor"];

	// ── Position ──────────────────────────────────────────────────────────────
	if (props.position != null) style.position = props.position as CSSProperties["position"];
	if (props.top      != null) style.top      = typeof props.top    === "number" ? `${props.top}px`    : props.top as string;
	if (props.right    != null) style.right    = typeof props.right  === "number" ? `${props.right}px`  : props.right as string;
	if (props.bottom   != null) style.bottom   = typeof props.bottom === "number" ? `${props.bottom}px` : props.bottom as string;
	if (props.left     != null) style.left     = typeof props.left   === "number" ? `${props.left}px`   : props.left as string;
	if (props.zIndex   != null) style.zIndex   = props.zIndex as number;

	// ── Register responsive CSS blocks ────────────────────────────────────────
	globalStyleCollector.addMany(css);
	css.length = 0;

	// ── CSS custom properties (vars) ──────────────────────────────────────────
	if (props.vars != null && typeof props.vars === "object") {
		for (const [variableKey, variableValue] of Object.entries(props.vars as Record<string, string>)) {
			(style as Record<string, string>)[variableKey.startsWith("--") ? variableKey : `--${variableKey}`] = variableValue;
		}
	}

	// ── Sides system ──────────────────────────────────────────────────────────
	if (Array.isArray(props.sides) && props.sides.length > 0 && props.sideDistance != null) {
		const targetSideDistanceValue = normalizeSpacingValue(props.sideDistance as string | number);
		const evaluateAsMarginFlag = (props.sideType as string) !== "padding";
		const SIDE_MAP: Record<number, string> = {
			1: evaluateAsMarginFlag ? "marginTop"    : "paddingTop",
			2: evaluateAsMarginFlag ? "marginLeft"   : "paddingLeft",
			3: evaluateAsMarginFlag ? "marginRight"  : "paddingRight",
			4: evaluateAsMarginFlag ? "marginBottom" : "paddingBottom",
		};
		for (const individualSideEntry of props.sides as number[]) {
			const targetMappedProperty = SIDE_MAP[individualSideEntry];
			if (targetMappedProperty) (style as Record<string, string>)[targetMappedProperty] = targetSideDistanceValue;
		}
	}

	// ── CSS PASSTHROUGH ───────────────────────────────────────────────────────
	for (const explicitPassthroughKey of CSS_PASSTHROUGH) {
		if (ALREADY_HANDLED.has(explicitPassthroughKey)) continue;
		const incomingPassthroughValue = props[explicitPassthroughKey];
		if (incomingPassthroughValue == null) continue;

		if ((style as Record<string, unknown>)[explicitPassthroughKey] != null) continue;

		if (isResponsive(incomingPassthroughValue as any)) {
			const dynamicPassthroughPayload = resolveGeneric(explicitPassthroughKey, incomingPassthroughValue as any);
			(style as Record<string, string>)[explicitPassthroughKey] = dynamicPassthroughPayload.ref;
			globalStyleCollector.add(dynamicPassthroughPayload.cssBlock);
		} else {
			(style as Record<string, unknown>)[explicitPassthroughKey] = incomingPassthroughValue;
		}
	}

	// ── Merge explicit style overrides ────────────────────────────────────────
	const compiledExtraStyle = compileAtRuleStyleVars(extraStyle);
	return compiledExtraStyle ? { ...style, ...compiledExtraStyle } : style;
}
