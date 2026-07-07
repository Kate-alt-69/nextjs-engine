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
//    Inline: style={{ padding: "var(--e-pa-x7k2, 1rem)" }}
//                                        ↑ fallback = xs/base value
//
//  PRODUCTION FIX (TASK-002 / Layout collapse on compiled / SSG):
//    Every var() reference now includes the base (xs / scalar) value as a CSS
//    var fallback:  var(--e-pa-x7k2, 1rem)
//
//    Without this, production SSG HTML has the <style id="__engine_styles__">
//    tag at the bottom of <body>. The browser paints content BEFORE reaching
//    that tag, so CSS vars are undefined and layout collapses (zero padding,
//    no columns, stacked rows). The fallback ensures every element has a valid
//    computed value on first paint, regardless of when the style tag loads.
//
//    In dev mode, React's hydration re-render masked this — the styles were
//    applied during client-side hydration before the user noticed. In
//    production SSG there is no re-render, exposing the FOUC permanently.
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

export function normalizeSpacingValue(v: string | number): string {
	if (typeof v === "number") return v === 0 ? "0" : `${v / 16}rem`;
	return v;
}

export function normalizeColumns(v: string | number): string {
	if (typeof v === "number") return `repeat(${v}, 1fr)`;
	return v;
}

// ── Hash ──────────────────────────────────────────────────────────────────────

function shortHash(input: string): string {
	let h = 5381;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) + h + input.charCodeAt(i)) | 0;
	}
	return Math.abs(h).toString(36).slice(0, 5);
}

// ── Resolved type ─────────────────────────────────────────────────────────────

export interface ResolvedVar {
	varName:  string;
	/**
	 * var() reference with fallback for inline styles.
	 * e.g. "var(--e-pa-abc12, 1rem)"
	 * The fallback is the xs/base value — guarantees layout on first paint
	 * even before the <style> tag has been processed by the browser.
	 */
	ref:      string;
	cssBlock: string;
}

// Module-level cache — shared across an SSR render pass.
// Cleared explicitly by createPage before each page render.
const _varCache = new Map<string, ResolvedVar>();

export function clearResolverCache(): void {
	_varCache.clear();
}

// ── Core resolve function ─────────────────────────────────────────────────────

export function resolveVar(
	shortProp: string,
	value: ResponsiveValue<string | number>,
	normalize = true,
): ResolvedVar {
	const cacheKey = `${shortProp}|${JSON.stringify(value)}`;
	const cached   = _varCache.get(cacheKey);
	if (cached) return cached;

	const hash    = shortHash(cacheKey);
	const varName = `--e-${shortProp}-${hash}`;

	let cssBlock  = "";
	let fallback  = "";  // ← base value used as var() fallback

	if (typeof value !== "object" || value === null) {
		// ── Scalar value ──────────────────────────────────────────────────────
		const v   = normalize
			? normalizeSpacingValue(value as string | number)
			: String(value);
		fallback  = v;
		cssBlock  = `:root{${varName}:${v}}`;
	} else {
		// ── Responsive map ────────────────────────────────────────────────────
		let cascade: string | undefined;
		const lines: string[] = [];

		for (const bp of BREAKPOINT_ORDER) {
			const raw = (value as Partial<Record<Breakpoint, string | number>>)[bp];
			const v   = raw !== undefined
				? (normalize ? normalizeSpacingValue(raw) : String(raw))
				: cascade;

			if (v === undefined) continue;
			if (raw !== undefined) cascade = v;

			// Capture the xs/first value as the fallback for var()
			if (!fallback) fallback = v;

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

	// ── var() reference with fallback ─────────────────────────────────────────
	// fallback ensures layout is correct on first paint even before the
	// __engine_styles__ <style> tag has been parsed (critical for SSG/Netlify).
	const ref = fallback
		? `var(${varName}, ${fallback})`
		: `var(${varName})`;

	const result: ResolvedVar = { varName, ref, cssBlock };
	_varCache.set(cacheKey, result);
	return result;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function resolveSpacing(
	shortProp: string,
	value: ResponsiveValue<string | number>,
): ResolvedVar {
	return resolveVar(shortProp, value, true);
}

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

export function resolveGeneric(
	shortProp: string,
	value: ResponsiveValue<string>,
): ResolvedVar {
	return resolveVar(shortProp, value as ResponsiveValue<string | number>, false);
}

// ── Prop-to-CSS-property mapping ──────────────────────────────────────────────

export const CSS_PROP_MAP: Record<string, string> = {
	m:  "margin",       mt: "margin-top",       mr: "margin-right",
	mb: "margin-bottom", ml: "margin-left",
	mx: undefined!,     my: undefined!,
	p:  "padding",      pt: "padding-top",       pr: "padding-right",
	pb: "padding-bottom", pl: "padding-left",
	px: undefined!,     py: undefined!,
	w:    "width",       h:    "height",
	minW: "min-width",   minH: "min-height",
	maxW: "max-width",   maxH: "max-height",
	gap:    "gap",       colGap: "column-gap",    rowGap: "row-gap",
	display:  "display", flexDir:  "flex-direction",
	align:    "align-items", justify: "justify-content", wrap: "flex-wrap",
	columns:  "grid-template-columns", rows: "grid-template-rows",
	borderRadius: "border-radius",
	size:   "font-size", weight: "font-weight",
	lineHeight:    "line-height", letterSpacing: "letter-spacing",
	order: "order",
};

// ── isResponsive utility ──────────────────────────────────────────────────────

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
