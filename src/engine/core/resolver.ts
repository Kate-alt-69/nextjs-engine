// ─────────────────────────────────────────────────────────────────────────────
//  Engine — CSS Resolver
//
//  Converts ResponsiveValue<T> props into CSS custom property declarations +
//  @media query blocks. The browser handles ALL responsive behaviour — no JS
//  breakpoint detection at runtime, no layout shifts, no re-renders.
//
//  Strategy:
//    Input:  padding = { xs: "1rem", md: "2rem", xl: "3rem" }
//    Output: --e-pa-x7k2: 1rem;
//            @media (min-width: 768px)  { :root { --e-pa-x7k2: 2rem } }
//            @media (min-width: 1280px) { :root { --e-pa-x7k2: 3rem } }
//    Inline: style={{ padding: "var(--e-pa-x7k2)" }}
//
//  CSS vars are deterministically hashed so duplicate values share one var.
// ─────────────────────────────────────────────────────────────────────────────

import {
	type Breakpoint,
	type ResponsiveValue,
	BREAKPOINTS,
	BREAKPOINT_ORDER,
} from "../schema/types";

// ── Value normalisation ───────────────────────────────────────────────────────

/**
 * Normalises a raw prop value:
 *   number  → rem  (n / 16 rem, 0 stays "0")
 *   string  → passed through unchanged
 */
export function normalizeSpacingValue(v: string | number): string {
	if (typeof v === "number") return v === 0 ? "0" : `${v / 16}rem`;
	return v;
}

/**
 * Normalise a grid column count or template string.
 *   number  → repeat(n, 1fr)
 *   string  → passed through
 */
export function normalizeColumns(v: string | number): string {
	if (typeof v === "number") return `repeat(${v}, 1fr)`;
	return v;
}

// ── Hash ──────────────────────────────────────────────────────────────────────

/** djb2-inspired hash → short base-36 string */
function shortHash(input: string): string {
	let h = 5381;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) + h + input.charCodeAt(i)) | 0;
	}
	return Math.abs(h).toString(36).slice(0, 5);
}

// ── Resolved type ─────────────────────────────────────────────────────────────

export interface ResolvedVar {
	/** Full CSS custom property name, e.g. "--e-pa-abc12" */
	varName: string;
	/** var() reference for inline styles, e.g. "var(--e-pa-abc12)" */
	ref: string;
	/** Complete CSS text block to inject into <style> */
	cssBlock: string;
}

// Module-level cache — shared across an SSR render pass.
// Cleared explicitly by StyleCollector before each page render.
const _varCache = new Map<string, ResolvedVar>();

export function clearResolverCache(): void {
	_varCache.clear();
}

// ── Core resolve function ─────────────────────────────────────────────────────

/**
 * Resolves a responsive value to a CSS custom property.
 *
 * @param shortProp   Two-letter abbreviation used in the var name (e.g. "pa", "mt").
 * @param value       The responsive value — plain scalar or breakpoint map.
 * @param normalize   Pass true to run values through normalizeSpacingValue.
 */
export function resolveVar(
	shortProp: string,
	value: ResponsiveValue<string | number>,
	normalize = true,
): ResolvedVar {
	const cacheKey = `${shortProp}|${JSON.stringify(value)}`;
	const cached = _varCache.get(cacheKey);
	if (cached) return cached;

	const hash = shortHash(cacheKey);
	const varName = `--e-${shortProp}-${hash}`;
	const ref = `var(${varName})`;

	let cssBlock = "";

	if (typeof value !== "object" || value === null) {
		const v = normalize
			? normalizeSpacingValue(value as string | number)
			: String(value);
		cssBlock = `:root{${varName}:${v}}`;
	} else {
		// Cascade: propagate the last-defined value to missing breakpoints
		let cascade: string | undefined;
		const lines: string[] = [];

		for (const bp of BREAKPOINT_ORDER) {
			const raw = (value as Partial<Record<Breakpoint, string | number>>)[bp];
			const v = raw !== undefined
				? (normalize ? normalizeSpacingValue(raw) : String(raw))
				: cascade;

			if (v === undefined) continue;
			if (raw !== undefined) cascade = v;

			if (bp === "xs") {
				lines.push(`:root{${varName}:${v}}`);
			} else {
				lines.push(
					`@media(min-width:${BREAKPOINTS[bp]}px){:root{${varName}:${v}}}`,
				);
			}
		}

		cssBlock = lines.join("\n");
	}

	const result: ResolvedVar = { varName, ref, cssBlock };
	_varCache.set(cacheKey, result);
	return result;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Resolves a spacing prop (margin/padding family). */
export function resolveSpacing(
	shortProp: string,
	value: ResponsiveValue<string | number>,
): ResolvedVar {
	return resolveVar(shortProp, value, true);
}

/** Resolves a column count prop — normalises numbers to repeat(n, 1fr). */
export function resolveColumns(
	value: ResponsiveValue<string | number>,
): ResolvedVar {
	if (typeof value === "object" && value !== null) {
		const mapped = Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, normalizeColumns(v as string | number)]),
		) as Partial<Record<Breakpoint, string>>;
		return resolveVar("co", mapped as ResponsiveValue<string | number>, false);
	}
	return resolveVar("co", normalizeColumns(value as string | number), false);
}

/** Resolves a generic non-spacing CSS value (display, flex-direction, etc). */
export function resolveGeneric(
	shortProp: string,
	value: ResponsiveValue<string>,
): ResolvedVar {
	return resolveVar(shortProp, value as ResponsiveValue<string | number>, false);
}

// ── Prop-to-CSS-property mapping ──────────────────────────────────────────────

/** Maps engine prop names to their CSS property equivalents. */
export const CSS_PROP_MAP: Record<string, string> = {
	// Spacing
	m:  "margin",
	mt: "margin-top",
	mr: "margin-right",
	mb: "margin-bottom",
	ml: "margin-left",
	mx: undefined!, // handled specially → margin-left + margin-right
	my: undefined!, // handled specially → margin-top + margin-bottom
	p:  "padding",
	pt: "padding-top",
	pr: "padding-right",
	pb: "padding-bottom",
	pl: "padding-left",
	px: undefined!, // handled specially → padding-left + padding-right
	py: undefined!, // handled specially → padding-top + padding-bottom
	// Sizing
	w:    "width",
	h:    "height",
	minW: "min-width",
	minH: "min-height",
	maxW: "max-width",
	maxH: "max-height",
	// Flex/Grid
	gap:    "gap",
	colGap: "column-gap",
	rowGap: "row-gap",
	// Display & flex
	display:  "display",
	flexDir:  "flex-direction",
	align:    "align-items",
	justify:  "justify-content",
	wrap:     "flex-wrap",
	// Grid
	columns: "grid-template-columns",
	rows:    "grid-template-rows",
	// Border
	borderRadius: "border-radius",
	// Text
	size:          "font-size",
	weight:        "font-weight",
	lineHeight:    "line-height",
	letterSpacing: "letter-spacing",
	// Misc
	order: "order",
};

// ── isResponsive utility ──────────────────────────────────────────────────────

/** Returns true if value is a breakpoint map (not a plain scalar). */
export function isResponsive<T>(
	value: ResponsiveValue<T>,
): value is Partial<Record<Breakpoint, T>> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		BREAKPOINT_ORDER.some((bp) => bp in (value as object))
	);
}
