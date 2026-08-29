// ─────────────────────────────────────────────────────────────────────────────
// EngineTransitions — browser compatibility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Small deterministic hash used to keep sanitized shared names collision-safe. */
function stableHash(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36).padStart(7, "0").slice(-7);
}

/**
 * Build a valid, deterministic `view-transition-name` from a DOM id.
 * The original id hash prevents collisions after lower-casing, sanitizing,
 * or truncating long ids.
 */
export function safeSharedTransitionName(id: string): string {
	const normalized = id
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 44);
	return `e-shared-${normalized || "item"}-${stableHash(id)}`;
}

/**
 * Scale a simple CSS number while preserving its unit without CSS typed
 * arithmetic. Engine-generated transition values are intentionally emitted as
 * simple numbers such as `10deg` and `36px`, so older Firefox/Safari builds do
 * not need to understand `calc(-1 * 10deg)`.
 */
export function scaleTransitionCssValue(
	value: string,
	factor: number,
	fallback: string,
): string {
	const match = value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i);
	if (!match) return fallback;
	const numeric = Number(match[1]);
	if (!Number.isFinite(numeric) || !Number.isFinite(factor)) return fallback;
	const scaled = Object.is(numeric * factor, -0) ? 0 : numeric * factor;
	return `${Number(scaled.toFixed(6))}${match[2]}`;
}

/** Compare a requested href with the current browser URL after URL normalization. */
export function isExactTransitionLocation(href: string, currentHref: string): boolean {
	try {
		return new URL(href, currentHref).href === new URL(currentHref).href;
	} catch {
		return false;
	}
}
