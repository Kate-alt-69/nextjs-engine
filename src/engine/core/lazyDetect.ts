// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Auto Lazy Detection
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode } from "../schema/types";

export interface LazyDecision {
	lazy: boolean;
	contentVisibility: boolean;
	rootMargin: string;
	placeholderHeight: string;
}

function numericDimension(props: Record<string, unknown>, key: "width" | "height"): number {
	return typeof props[key] === "number" ? props[key] as number : 0;
}

function placeholderHeight(props: Record<string, unknown>, fallback: string): string {
	const value = props.height ?? props.minH ?? props.minHeight;
	if (typeof value === "number") return `${value}px`;
	if (typeof value === "string") return value;
	return fallback;
}

function eagerDecision(): LazyDecision {
	return {
		lazy: false,
		contentVisibility: false,
		rootMargin: "0px",
		placeholderHeight: "auto",
	};
}

export function decideLazy(node: SchemaNode, depth: number): LazyDecision {
	const props = (node.props ?? {}) as Record<string, unknown>;

	if (props.lazy === false || props.priority === true || props.eager === true) {
		return eagerDecision();
	}

	if (props.lazy === true) {
		return {
			lazy: true,
			contentVisibility: true,
			rootMargin: "600px 0px",
			placeholderHeight: placeholderHeight(props, "400px"),
		};
	}

	// Media has expensive network/decode work and normally carries enough
	// geometry to reserve stable space while its split module is deferred.
	if (node.type === "video") {
		return {
			lazy: true,
			contentVisibility: true,
			rootMargin: "800px 0px",
			placeholderHeight: placeholderHeight(props, "auto"),
		};
	}

	if (node.type === "image") {
		const width = numericDimension(props, "width");
		const height = numericDimension(props, "height");
		const area = width * height;
		if (area > 640 * 480 || width > 1280 || height > 800) {
			return {
				lazy: true,
				contentVisibility: false,
				rootMargin: area >= 1920 * 1080 ? "800px 0px" : "400px 0px",
				placeholderHeight: height > 0 ? `${height}px` : "auto",
			};
		}
		return eagerDecision();
	}

	// Canvas/Manim nodes are expensive enough to justify code-split lazy mount
	// when nested. Callers can still force eager mounting with priority/eager.
	if (
		node.type === "canvas"
		|| node.type === "manim"
		|| node.type === "EngineManim"
		|| node.type === "manim3d"
		|| node.type === "EngineManim3D"
	) {
		if (depth > 0) {
			return {
				lazy: true,
				contentVisibility: true,
				rootMargin: "600px 0px",
				placeholderHeight: placeholderHeight(props, "400px"),
			};
		}
		return eagerDecision();
	}

	// Structural/content nodes stay mounted by default. Schema depth is not a
	// viewport position, and substituting guessed 200–500px placeholders for a
	// section/card/grid/markdown tree can change document height during a fast
	// mobile fling. That produces visible flicker and can make the browser appear
	// to teleport backwards. Use `lazy: true` explicitly when stable geometry is
	// known and the deferral is worth the layout trade-off.
	return eagerDecision();
}
