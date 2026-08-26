// ─────────────────────────────────────────────────────────────────────────────
// Engine — Auto Lazy Detection
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode } from "../schema/types";

export interface LazyDecision {
	lazy: boolean;
	contentVisibility: boolean;
	rootMargin: string;
	placeholderHeight: string;
}

const descendantCountCache = new WeakMap<object, number>();

function countDescendants(node: SchemaNode): number {
	const cached = descendantCountCache.get(node as object);
	if (cached !== undefined) return cached;

	const count = !node.children || typeof node.children === "string"
		? 0
		: node.children.reduce(
			(total, child) => total + 1 + countDescendants(child),
			0,
		);
	descendantCountCache.set(node as object, count);
	return count;
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

	// Media has expensive network/decode work. The outer lazy boundary also
	// delays loading the split component module; the media component then owns
	// its own fine-grained network loading once mounted.
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
	// when nested. rootMargin makes an above-fold nested node mount immediately,
	// while genuinely off-screen graphics avoid context/GPU allocation.
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

	// Tree depth describes schema nesting, not physical viewport position.
	// Ordinary sections therefore use content-visibility instead of being
	// removed from the React tree solely because they are nested.
	if (node.type === "section" || node.type === "hero") {
		if (depth > 0) {
			const descendants = countDescendants(node);
			return {
				lazy: false,
				contentVisibility: descendants > 3,
				rootMargin: "0px",
				placeholderHeight: placeholderHeight(props, descendants > 10 ? "500px" : "400px"),
			};
		}
		return eagerDecision();
	}

	if (node.type === "markdown" && depth > 1) {
		return {
			lazy: true,
			contentVisibility: true,
			rootMargin: "400px 0px",
			placeholderHeight: placeholderHeight(props, "200px"),
		};
	}

	if (node.type === "grid" || node.type === "stack") {
		const itemCount = Array.isArray(node.children) ? node.children.length : 0;
		if (depth > 2 && itemCount > 8) {
			return {
				lazy: true,
				contentVisibility: true,
				rootMargin: "400px 0px",
				placeholderHeight: placeholderHeight(props, "300px"),
			};
		}
	}

	if (node.type === "card" && depth > 3) {
		return {
			lazy: true,
			contentVisibility: false,
			rootMargin: "300px 0px",
			placeholderHeight: placeholderHeight(props, "200px"),
		};
	}

	return eagerDecision();
}
