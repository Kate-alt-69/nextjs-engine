// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — isolated browser compatibility probes
// ─────────────────────────────────────────────────────────────────────────────

import { resolveEngineFallbackPlan } from "../../compiler/EngineFallbackCompiler";
import type {
	EngineCapability,
	EngineFallbackPlan,
	EngineFeatureSupportResolver,
	EngineResolvedFallbackPlan,
} from "../../compiler/types";

export type EngineFeatureSupportOverrides = Readonly<Record<string, boolean>>;

function probe(check: () => boolean): boolean {
	try {
		return check();
	} catch {
		return false;
	}
}

function supportsCSS(property: string, value: string): boolean {
	return probe(() => typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports(property, value));
}

function supportsCanvasContext(context: "2d" | "webgl" | "webgl2"): boolean {
	return probe(() => (
		typeof document !== "undefined"
		&& document.createElement("canvas").getContext(context) !== null
	));
}

/**
 * Resolve a compiler capability against the current browser without importing
 * the larger EngineBrowser interaction/media runtime.
 */
export function supportsEngineBrowserFeature(feature: EngineCapability): boolean {
	switch (feature) {
		case "dom":
			return typeof window !== "undefined" && typeof document !== "undefined";
		case "canvas":
			return supportsCanvasContext("2d");
		case "webgl":
			return supportsCanvasContext("webgl");
		case "webgl2":
			return supportsCanvasContext("webgl2");
		case "request-animation-frame":
			return typeof globalThis.requestAnimationFrame === "function";
		case "intersection-observer":
			return typeof globalThis.IntersectionObserver === "function";
		case "visual-viewport":
			return typeof window !== "undefined" && window.visualViewport != null;
		case "view-transitions":
			return typeof document !== "undefined" && typeof (document as Document & {
				startViewTransition?: unknown;
			}).startViewTransition === "function";
		case "web-animations":
			return typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
		case "container-queries":
			return supportsCSS("container-type", "inline-size");
		case "media-queries":
			return typeof window !== "undefined" && typeof window.matchMedia === "function";
		case "css-grid":
			return supportsCSS("display", "grid");
		case "clipboard":
			return typeof navigator !== "undefined" && navigator.clipboard !== undefined;
		case "media":
			return typeof HTMLMediaElement !== "undefined";
		case "speech":
			return typeof window !== "undefined" && (
				window.speechSynthesis !== undefined
				|| "SpeechRecognition" in window
				|| "webkitSpeechRecognition" in window
			);
		case "network":
			return typeof globalThis.fetch === "function";
		default:
			return false;
	}
}

export function createEngineBrowserSupportResolver(
	overrides: EngineFeatureSupportOverrides = {},
): EngineFeatureSupportResolver {
	return (feature) => Object.prototype.hasOwnProperty.call(overrides, feature)
		? overrides[feature] === true
		: supportsEngineBrowserFeature(feature);
}

export function resolveEngineBrowserCompatibility(
	plan: EngineFallbackPlan,
	overrides: EngineFeatureSupportOverrides = {},
): EngineResolvedFallbackPlan {
	return resolveEngineFallbackPlan(plan, createEngineBrowserSupportResolver(overrides));
}
