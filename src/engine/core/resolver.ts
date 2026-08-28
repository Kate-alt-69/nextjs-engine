// ─────────────────────────────────────────────────────────────────────────────
//  Engine — CSS Resolver
//
//  Converts ResponsiveValue<T> props into CSS custom property declarations +
//  @media query blocks. Responsive maps emit rules only for explicitly supplied
//  breakpoints; CSS cascade carries each value forward until the next override.
// ─────────────────────────────────────────────────────────────────────────────

import {
	type Breakpoint,
	type ResponsiveValue,
	BREAKPOINTS,
	BREAKPOINT_ORDER,
} from "../schema/types";

// ── Value normalisation ───────────────────────────────────────────────────────

export function normalizeSpacingValue(value: string | number): string {
	if (typeof value === "number") return value === 0 ? "0" : `${value / 16}rem`;
	return value;
}

export function normalizeColumns(value: string | number): string {
	if (typeof value === "number") return `repeat(${value}, 1fr)`;
	return value;
}

// ── Stable serialization + hash ───────────────────────────────────────────────

function serializeResponsiveValue(value: ResponsiveValue<string | number>): string {
	if (typeof value !== "object" || value === null) return JSON.stringify(value);

	const parts: string[] = [];
	for (const breakpoint of BREAKPOINT_ORDER) {
		const breakpointValue = (value as Partial<Record<Breakpoint, string | number>>)[breakpoint];
		if (breakpointValue === undefined) continue;
		parts.push(`${breakpoint}:${JSON.stringify(breakpointValue)}`);
	}
	return parts.join("|");
}

function shortHash(input: string): string {
	let primary = 5381;
	let secondary = 2166136261;

	for (let index = 0; index < input.length; index++) {
		const code = input.charCodeAt(index);
		primary = ((primary << 5) + primary + code) | 0;
		secondary ^= code;
		secondary = Math.imul(secondary, 16777619);
	}

	return `${(primary >>> 0).toString(36)}${(secondary >>> 0).toString(36)}`;
}

// ── Resolved type ─────────────────────────────────────────────────────────────

export interface ResolvedVar {
	varName: string;
	/** var() reference with an xs/scalar first-paint fallback when available. */
	ref: string;
	cssBlock: string;
}

// Resolver output is a pure function of its cache key and the engine breakpoint
// constants, so it is safe to reuse across page/component renders. Keep the
// process/browser cache bounded instead of clearing shared state from render code.
export const RESOLVER_CACHE_LIMIT = 2048;
const _varCache = new Map<string, ResolvedVar>();

function readCachedVar(cacheKey: string): ResolvedVar | undefined {
	const cached = _varCache.get(cacheKey);
	if (cached === undefined) return undefined;

	// Promote hits so frequently reused responsive values survive churn.
	_varCache.delete(cacheKey);
	_varCache.set(cacheKey, cached);
	return cached;
}

function cacheResolvedVar(cacheKey: string, resolved: ResolvedVar): void {
	if (_varCache.has(cacheKey)) _varCache.delete(cacheKey);

	if (_varCache.size >= RESOLVER_CACHE_LIMIT) {
		const oldestKey = _varCache.keys().next().value as string | undefined;
		if (oldestKey !== undefined) _varCache.delete(oldestKey);
	}

	_varCache.set(cacheKey, resolved);
}

/** Explicit test/tool reset. Normal page rendering does not clear this cache. */
export function clearResolverCache(): void {
	_varCache.clear();
}

/** Exposed for regression tests and diagnostics; not part of the public barrel. */
export function resolverCacheSize(): number {
	return _varCache.size;
}

// ── Core resolve function ─────────────────────────────────────────────────────

export function resolveVar(
	shortProp: string,
	value: ResponsiveValue<string | number>,
	normalize = true,
): ResolvedVar {
	const cacheKey = `${shortProp}|${normalize ? "normalized" : "raw"}|${serializeResponsiveValue(value)}`;
	const cached = readCachedVar(cacheKey);
	if (cached) return cached;

	const hash = shortHash(cacheKey);
	const varName = `--e-${shortProp}-${hash}`;
	let cssBlock = "";
	let fallback = "";

	if (typeof value !== "object" || value === null) {
		const resolvedValue = normalize
			? normalizeSpacingValue(value as string | number)
			: String(value);
		fallback = resolvedValue;
		cssBlock = `:root{${varName}:${resolvedValue}}`;
	} else {
		const lines: string[] = [];

		for (const breakpoint of BREAKPOINT_ORDER) {
			const rawValue = (value as Partial<Record<Breakpoint, string | number>>)[breakpoint];
			if (rawValue === undefined) continue;

			const resolvedValue = normalize
				? normalizeSpacingValue(rawValue)
				: String(rawValue);

			// Only an explicit xs value is valid below the first media query. Using
			// md/lg as a fallback would incorrectly apply that value on mobile.
			if (breakpoint === "xs") fallback = resolvedValue;

			if (breakpoint === "xs") {
				lines.push(`:root{${varName}:${resolvedValue}}`);
			} else {
				lines.push(
					`@media(min-width:${BREAKPOINTS[breakpoint]}px){:root{${varName}:${resolvedValue}}}`,
				);
			}
		}

		cssBlock = lines.join("\n");
	}

	const ref = fallback
		? `var(${varName}, ${fallback})`
		: `var(${varName})`;

	const result: ResolvedVar = { varName, ref, cssBlock };
	cacheResolvedVar(cacheKey, result);
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
		const mapped: Partial<Record<Breakpoint, string>> = {};
		for (const breakpoint of BREAKPOINT_ORDER) {
			const breakpointValue = value[breakpoint];
			if (breakpointValue === undefined) continue;
			mapped[breakpoint] = normalizeColumns(breakpointValue);
		}
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
	m: "margin", mt: "margin-top", mr: "margin-right",
	mb: "margin-bottom", ml: "margin-left",
	mx: undefined!, my: undefined!,
	p: "padding", pt: "padding-top", pr: "padding-right",
	pb: "padding-bottom", pl: "padding-left",
	px: undefined!, py: undefined!,
	w: "width", h: "height",
	minW: "min-width", minH: "min-height",
	maxW: "max-width", maxH: "max-height",
	gap: "gap", colGap: "column-gap", rowGap: "row-gap",
	display: "display", flexDir: "flex-direction",
	align: "align-items", justify: "justify-content", wrap: "flex-wrap",
	columns: "grid-template-columns", rows: "grid-template-rows",
	borderRadius: "border-radius",
	size: "font-size", weight: "font-weight",
	lineHeight: "line-height", letterSpacing: "letter-spacing",
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
		BREAKPOINT_ORDER.some((breakpoint) => breakpoint in (value as object))
	);
}
