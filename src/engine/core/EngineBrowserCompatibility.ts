// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — browser compatibility evaluation
// ─────────────────────────────────────────────────────────────────────────────

import { resolveEngineFallbackPlan } from "../compiler/EngineFallbackCompiler";
import type {
	EngineCapability,
	EngineFallbackPlan,
	EngineFeatureSupportResolver,
	EngineResolvedFallbackPlan,
	EngineUsedFeatureSource,
} from "../compiler/types";

export interface EngineCompatibilityIssue {
	feature: EngineCapability;
	importance: "required";
	reason: "unsupported-without-fallback";
	requiredBy: readonly EngineUsedFeatureSource[];
}

export interface EngineCompatibilityReport {
	pageId: string;
	updateRecommended: boolean;
	issues: readonly EngineCompatibilityIssue[];
	resolved: EngineResolvedFallbackPlan;
}

interface BrowserCapabilityRuntime {
	CSS?: { supports?: (property: string, value: string) => boolean };
	Element?: { prototype?: { animate?: unknown } };
	HTMLMediaElement?: unknown;
	IntersectionObserver?: unknown;
	SpeechRecognition?: unknown;
	webkitSpeechRecognition?: unknown;
	document?: {
		createElement?: (tagName: string) => unknown;
		startViewTransition?: unknown;
	};
	fetch?: unknown;
	matchMedia?: unknown;
	navigator?: { clipboard?: unknown };
	requestAnimationFrame?: unknown;
	speechSynthesis?: unknown;
	visualViewport?: unknown;
}

function hasCanvasContext(runtime: BrowserCapabilityRuntime, context: "2d" | "webgl" | "webgl2"): boolean {
	try {
		const canvas = runtime.document?.createElement?.("canvas") as {
			getContext?: (type: string) => unknown;
		} | undefined;
		return typeof canvas?.getContext === "function" && Boolean(canvas.getContext(context));
	} catch {
		return false;
	}
}

export function detectEngineBrowserFeature(
	feature: EngineCapability,
	runtime: BrowserCapabilityRuntime = globalThis as unknown as BrowserCapabilityRuntime,
): boolean {
	switch (feature) {
		case "dom": return typeof runtime.document?.createElement === "function";
		case "canvas": return hasCanvasContext(runtime, "2d");
		case "webgl": return hasCanvasContext(runtime, "webgl");
		case "webgl2": return hasCanvasContext(runtime, "webgl2");
		case "request-animation-frame": return typeof runtime.requestAnimationFrame === "function";
		case "intersection-observer": return typeof runtime.IntersectionObserver === "function";
		case "visual-viewport": return runtime.visualViewport != null;
		case "view-transitions": return typeof runtime.document?.startViewTransition === "function";
		case "web-animations": return typeof runtime.Element?.prototype?.animate === "function";
		case "container-queries": return runtime.CSS?.supports?.("container-type", "inline-size") === true;
		case "media-queries": return typeof runtime.matchMedia === "function";
		case "css-grid": return runtime.CSS?.supports?.("display", "grid") === true;
		case "clipboard": return runtime.navigator?.clipboard !== undefined;
		case "media": return runtime.HTMLMediaElement !== undefined;
		case "speech": return runtime.speechSynthesis !== undefined
			|| runtime.SpeechRecognition !== undefined
			|| runtime.webkitSpeechRecognition !== undefined;
		case "network": return typeof runtime.fetch === "function";
		default: return false;
	}
}

export function engineFallbackPlanNeedsCompatibilityCheck(plan: EngineFallbackPlan): boolean {
	return plan.features.some((feature) => (
		feature.importance !== "optional"
		&& feature.requiredBy.length > 0
		&& !feature.strategies.some((strategy) => strategy.kind !== "native" && strategy.requires.length === 0)
	));
}

export function evaluateEngineBrowserCompatibility(
	plan: EngineFallbackPlan,
	isSupported: EngineFeatureSupportResolver = detectEngineBrowserFeature,
): EngineCompatibilityReport {
	const support = new Map<EngineCapability, boolean>();
	const resolveSupport = (feature: EngineCapability): boolean => {
		const cached = support.get(feature);
		if (cached !== undefined) return cached;
		let supported = false;
		try {
			supported = Boolean(isSupported(feature));
		} catch {
			supported = false;
		}
		support.set(feature, supported);
		return supported;
	};
	const resolved = resolveEngineFallbackPlan(plan, resolveSupport);
	const issues: EngineCompatibilityIssue[] = resolved.features
		.filter((feature) => (
			feature.importance !== "optional"
			&& feature.status === "unavailable"
			&& feature.requiredBy.length > 0
		))
		.map((feature) => Object.freeze({
			feature: feature.feature,
			importance: "required" as const,
			reason: "unsupported-without-fallback" as const,
			requiredBy: feature.requiredBy,
		}));
	return Object.freeze({
		pageId: plan.pageId,
		updateRecommended: issues.length > 0,
		issues: Object.freeze(issues),
		resolved,
	});
}
