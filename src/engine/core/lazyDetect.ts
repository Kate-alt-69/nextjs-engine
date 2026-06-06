// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Auto Lazy Detection
//
//  Analyses a SchemaNode and decides:
//    · Should it be lazy-mounted?          → LazyMount wrapper
//    · Should it use content-visibility?   → CSS hint applied
//    · What rootMargin should be used?     → based on estimated weight
//    · What placeholder height to reserve? → prevents CLS
//
//  Rules (applied in order, first match wins):
//    1. Node has explicit props.lazy = false  → always eager
//    2. Node has explicit props.lazy = true   → always lazy
//    3. Node has props.priority = true        → always eager
//    4. video type                            → always lazy, rootMargin 800px
//    5. image type + large size              → lazy, rootMargin based on size
//    6. section / hero with deep children    → lazy (content-visibility)
//    7. grid with many items                 → lazy
//    8. Everything else above fold (depth 0) → eager
//    9. Default                              → eager (safe fallback)
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode } from "../schema/types";

export interface LazyDecision {
	/** Should this node be wrapped in LazyMount? */
	lazy: boolean;
	/** Use content-visibility: auto on this node's wrapper */
	contentVisibility: boolean;
	/** IntersectionObserver rootMargin */
	rootMargin: string;
	/** Reserved height for placeholder. Prevents CLS. */
	placeholderHeight: string;
}

// ── Weight estimation ─────────────────────────────────────────────────────────

/**
 * Counts the total number of descendant nodes in a schema tree.
 * Used as a proxy for "rendering weight".
 */
function countDescendants(node: SchemaNode): number {
	if (!node.children || typeof node.children === "string") return 0;
	return node.children.reduce(
		(acc, child) => acc + 1 + countDescendants(child),
		0,
	);
}

/**
 * Estimates the pixel width of an image node from its props.
 * Returns 0 if unknown.
 */
function imageWidth(props: Record<string, unknown>): number {
	return typeof props.width === "number" ? props.width : 0;
}

function imageHeight(props: Record<string, unknown>): number {
	return typeof props.height === "number" ? props.height : 0;
}

// ── Main analyser ─────────────────────────────────────────────────────────────

/**
 * Analyses a schema node and returns a LazyDecision.
 *
 * @param node  The schema node to analyse.
 * @param depth Nesting depth in the schema tree. 0 = direct child of root.
 */
export function decideLazy(node: SchemaNode, depth: number): LazyDecision {
	const props = (node.props ?? {}) as Record<string, unknown>;

	// ── Explicit overrides ─────────────────────────────────────────────────────
	if (props.lazy === false || props.priority === true) {
		return { lazy: false, contentVisibility: false, rootMargin: "0px", placeholderHeight: "auto" };
	}
	if (props.lazy === true) {
		return {
			lazy: true,
			contentVisibility: true,
			rootMargin: "600px 0px",
			placeholderHeight: (props.height as string) ?? "400px",
		};
	}

	// ── Video — always lazy ────────────────────────────────────────────────────
	if (node.type === "video") {
		return {
			lazy: true,
			contentVisibility: true,
			rootMargin: "800px 0px",
			placeholderHeight: "auto", // aspect-ratio preserves space
		};
	}

	// ── Image — lazy if large ──────────────────────────────────────────────────
	if (node.type === "image") {
		const w = imageWidth(props);
		const h = imageHeight(props);
		const area = w * h;

		// Large images (> 640×480 equivalent area): lazy
		if (area > 640 * 480 || (w > 1280) || (h > 800)) {
			return {
				lazy: true,
				contentVisibility: false, // next/image handles its own loading
				rootMargin: area >= 1920 * 1080 ? "800px 0px" : "400px 0px",
				placeholderHeight: h > 0 ? `${h}px` : "400px",
			};
		}
		// Small images: native lazy is enough, no LazyMount overhead
		return { lazy: false, contentVisibility: false, rootMargin: "0px", placeholderHeight: "auto" };
	}

	// ── Section / Hero — use content-visibility, lazy if has deep children ─────
	if (node.type === "section" || node.type === "hero") {
		const descendants = countDescendants(node);
		// Below fold + heavy → full lazy mount
		if (depth > 0 && descendants > 10) {
			return {
				lazy: true,
				contentVisibility: true,
				rootMargin: "600px 0px",
				placeholderHeight: (props.minH as string) ?? "500px",
			};
		}
		// Below fold + light → content-visibility only (CSS hint, no JS gate)
		if (depth > 0) {
			return {
				lazy: false,
				contentVisibility: true,
				rootMargin: "0px",
				placeholderHeight: (props.minH as string) ?? "400px",
			};
		}
		// Above fold (depth 0) → always eager
		return { lazy: false, contentVisibility: false, rootMargin: "0px", placeholderHeight: "auto" };
	}

	// ── Grid / Stack with many items ───────────────────────────────────────────
	if (node.type === "grid" || node.type === "stack") {
		const itemCount = Array.isArray(node.children) ? node.children.length : 0;
		if (depth > 1 && itemCount > 6) {
			return {
				lazy: true,
				contentVisibility: true,
				rootMargin: "400px 0px",
				placeholderHeight: "300px",
			};
		}
	}

	// ── Card — lazy if deeply nested ──────────────────────────────────────────
	if (node.type === "card" && depth > 2) {
		return {
			lazy: true,
			contentVisibility: false,
			rootMargin: "300px 0px",
			placeholderHeight: "200px",
		};
	}

	// ── Default: render eagerly ────────────────────────────────────────────────
	return { lazy: false, contentVisibility: false, rootMargin: "0px", placeholderHeight: "auto" };
}
