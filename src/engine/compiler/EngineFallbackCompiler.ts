// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — feature fallback and legacy rendering compiler
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCompiledNode } from "./types";
import type {
	EngineCapability,
	EngineCompiledFeatureFallback,
	EngineFallbackPlan,
	EngineFallbackStrategy,
	EngineFeatureFallbackPolicy,
	EngineFeatureSupportResolver,
	EngineLegacyContent,
	EngineLegacyRenderPlan,
	EngineResolvedFallbackPlan,
	EngineResolvedFeatureFallback,
	EngineUsedFeatureManifest,
	EngineUsedFeatureSource,
} from "./types";

const TEXT_TYPES = new Set(["text", "heading", "markdown", "label", "button", "option", "optgroup"]);
const IMAGE_TYPES = new Set(["image"]);
const LINK_TYPES = new Set(["link", "EngineLink", "nav", "EngineNav"]);
const FORM_TYPES = new Set(["form", "input", "textarea", "checkbox", "custom-select", "option", "optgroup", "label"]);
const LEGACY_CONTENT_ORDER: readonly EngineLegacyContent[] = Object.freeze([
	"html",
	"css",
	"text",
	"images",
	"links",
	"basic-form-structure",
]);

function strategy(
	id: string,
	kind: EngineFallbackStrategy["kind"],
	requires: readonly EngineCapability[],
	fidelity: EngineFallbackStrategy["fidelity"],
): EngineFallbackStrategy {
	return Object.freeze({ id, kind, requires: Object.freeze([...requires]), fidelity });
}

const DEFAULT_POLICIES: readonly EngineFeatureFallbackPolicy[] = Object.freeze([
	Object.freeze({
		feature: "view-transitions",
		fallbacks: Object.freeze([
			strategy("web-animations", "runtime", ["web-animations"], "close"),
			strategy("instant-navigation", "rendering", [], "close"),
		]),
	}),
	Object.freeze({
		feature: "intersection-observer",
		fallbacks: Object.freeze([
			strategy("eager-render", "rendering", [], "full"),
		]),
	}),
	Object.freeze({
		feature: "container-queries",
		fallbacks: Object.freeze([
			strategy("media-query-layout", "rendering", ["media-queries"], "close"),
			strategy("normal-flow", "rendering", [], "structural"),
		]),
	}),
	Object.freeze({
		feature: "visual-viewport",
		fallbacks: Object.freeze([
			strategy("layout-viewport", "runtime", ["dom"], "close"),
		]),
	}),
	Object.freeze({
		feature: "css-grid",
		fallbacks: Object.freeze([
			strategy("normal-flow", "rendering", [], "structural"),
		]),
	}),
]);

function sourceFor(node: EngineCompiledNode): EngineUsedFeatureSource {
	return Object.freeze({
		nodeId: node.id,
		path: node.path,
		nodeType: node.type,
		runtime: node.runtime,
	});
}

function compileLegacyRenderPlan(root: EngineCompiledNode): EngineLegacyRenderPlan {
	const content = new Set<EngineLegacyContent>(["html", "css"]);
	const clientEnhancements: EngineUsedFeatureSource[] = [];
	const visit = (node: EngineCompiledNode): void => {
		const props = node.source.props ?? {};
		if (TEXT_TYPES.has(String(node.type)) || typeof node.source.children === "string" || props.content !== undefined) {
			content.add("text");
		}
		if (IMAGE_TYPES.has(String(node.type)) || typeof props.cover === "string" || typeof props.backgroundImage === "string") {
			content.add("images");
		}
		if (LINK_TYPES.has(String(node.type)) || typeof props.href === "string") content.add("links");
		if (FORM_TYPES.has(String(node.type))) content.add("basic-form-structure");
		if (node.runtime === "client") clientEnhancements.push(sourceFor(node));
		for (const child of node.children) visit(child);
	};
	visit(root);
	return Object.freeze({
		mode: "best-effort",
		preserves: Object.freeze(LEGACY_CONTENT_ORDER.filter((entry) => content.has(entry))),
		clientEnhancements: Object.freeze([...clientEnhancements].sort((left, right) => (
			left.path < right.path ? -1 : left.path > right.path ? 1 : 0
		))),
	});
}

function policyMap(overrides: readonly EngineFeatureFallbackPolicy[]): Map<EngineCapability, readonly EngineFallbackStrategy[]> {
	const policies = new Map<EngineCapability, readonly EngineFallbackStrategy[]>();
	for (const policy of [...DEFAULT_POLICIES, ...overrides]) {
		policies.set(policy.feature, Object.freeze(policy.fallbacks.map((fallback) => strategy(
			fallback.id,
			fallback.kind,
			fallback.requires,
			fallback.fidelity,
		))));
	}
	return policies;
}

export function compileEngineFallbackPlan(
	manifest: EngineUsedFeatureManifest,
	root: EngineCompiledNode,
	policies: readonly EngineFeatureFallbackPolicy[] = [],
): EngineFallbackPlan {
	const fallbacks = policyMap(policies);
	const features: EngineCompiledFeatureFallback[] = manifest.uses.map((usage) => Object.freeze({
		feature: usage.feature,
		requiredBy: usage.requiredBy,
		strategies: Object.freeze([
			strategy("native", "native", [usage.feature], "full"),
			...(fallbacks.get(usage.feature) ?? []),
		]),
	}));
	return Object.freeze({
		version: 1,
		pageId: manifest.pageId,
		features: Object.freeze(features),
		legacy: compileLegacyRenderPlan(root),
	});
}

export function resolveEngineFallbackPlan(
	plan: EngineFallbackPlan,
	isSupported: EngineFeatureSupportResolver,
): EngineResolvedFallbackPlan {
	const features: EngineResolvedFeatureFallback[] = plan.features.map((feature) => {
		const selected = feature.strategies.find((candidate) => (
			candidate.requires.every((requirement) => isSupported(requirement))
		)) ?? null;
		return Object.freeze({
			feature: feature.feature,
			status: selected?.kind === "native" ? "native" : selected ? "fallback" : "unavailable",
			strategy: selected,
			requiredBy: feature.requiredBy,
		});
	});
	return Object.freeze({
		pageId: plan.pageId,
		features: Object.freeze(features),
		legacy: plan.legacy,
	});
}

export const ENGINE_DEFAULT_FALLBACK_POLICIES = DEFAULT_POLICIES;
