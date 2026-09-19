// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — Compiler IR types
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeType, PageSchema, SchemaNode } from "../schema/types";

export type EngineRuntimeKind = "static" | "server" | "client" | "auto";
export type EngineWorkClass = "critical" | "visible" | "near" | "deferred" | "idle" | "sleeping";
export type EngineDeviceTarget = "desktop" | "tablet" | "phone";

export type EngineCapability =
	| "dom"
	| "canvas"
	| "webgl"
	| "webgl2"
	| "request-animation-frame"
	| "intersection-observer"
	| "visual-viewport"
	| "view-transitions"
	| "web-animations"
	| "container-queries"
	| "media-queries"
	| "css-grid"
	| "clipboard"
	| "media"
	| "speech"
	| "network"
	| (string & {});

export type EngineAssetKind = "image" | "video" | "font" | "module" | "shader" | "geometry" | "other";

export interface EngineCompilerDiagnostic {
	level: "info" | "warning" | "error";
	code: string;
	message: string;
	nodeId?: string;
	path?: string;
}

export interface EngineRuntimeProfile {
	runtime: EngineRuntimeKind;
	reason: string;
	capabilities?: readonly EngineCapability[];
	defaultWorkClass?: EngineWorkClass;
	heavy?: boolean;
}

export interface EngineCompiledAsset {
	id: string;
	kind: EngineAssetKind;
	source: string;
	ownerNodeId: string;
	workClass: EngineWorkClass;
	priority: boolean;
}

export interface EngineCompiledNode {
	id: string;
	path: string;
	type: NodeType;
	name?: string;
	depth: number;
	runtime: Exclude<EngineRuntimeKind, "auto">;
	runtimeReason: string;
	workClass: EngineWorkClass;
	workReason: string;
	capabilities: EngineCapability[];
	heavy: boolean;
	interactive: boolean;
	children: EngineCompiledNode[];
	assets: EngineCompiledAsset[];
	source: SchemaNode;
}

export interface EngineUsedFeatureSource {
	nodeId: string;
	path: string;
	nodeType: NodeType;
	runtime: Exclude<EngineRuntimeKind, "auto">;
}

export interface EngineUsedFeature {
	feature: EngineCapability;
	requiredBy: readonly EngineUsedFeatureSource[];
}

export interface EngineUsedFeatureManifest {
	version: 1;
	pageId: string;
	uses: readonly EngineUsedFeature[];
}

export type EngineFallbackKind = "native" | "runtime" | "rendering";
export type EngineFallbackFidelity = "full" | "close" | "structural";
export type EngineCompatibilityImportance = "required" | "optional";
export type EngineResolvedFallbackStatus = "native" | "fallback" | "unavailable";
export type EngineLegacyContent = "html" | "css" | "text" | "images" | "links" | "basic-form-structure";

export interface EngineFallbackStrategy {
	id: string;
	kind: EngineFallbackKind;
	requires: readonly EngineCapability[];
	fidelity: EngineFallbackFidelity;
}

export interface EngineFeatureFallbackPolicy {
	feature: EngineCapability;
	fallbacks: readonly EngineFallbackStrategy[];
}

export interface EngineCompiledFeatureFallback {
	feature: EngineCapability;
	importance: EngineCompatibilityImportance;
	requiredBy: readonly EngineUsedFeatureSource[];
	strategies: readonly EngineFallbackStrategy[];
}

export interface EngineLegacyRenderPlan {
	mode: "best-effort";
	preserves: readonly EngineLegacyContent[];
	clientEnhancements: readonly EngineUsedFeatureSource[];
}

export interface EngineFallbackPlan {
	version: 1;
	pageId: string;
	features: readonly EngineCompiledFeatureFallback[];
	legacy: EngineLegacyRenderPlan;
}

export interface EngineResolvedFeatureFallback {
	feature: EngineCapability;
	importance: EngineCompatibilityImportance;
	status: EngineResolvedFallbackStatus;
	strategy: EngineFallbackStrategy | null;
	requiredBy: readonly EngineUsedFeatureSource[];
}

export interface EngineResolvedFallbackPlan {
	pageId: string;
	features: readonly EngineResolvedFeatureFallback[];
	legacy: EngineLegacyRenderPlan;
}

export type EngineFeatureSupportResolver = (feature: EngineCapability) => boolean;

export interface EngineCompilerSummary {
	totalNodes: number;
	staticNodes: number;
	serverNodes: number;
	clientNodes: number;
	clientIslands: number;
	heavyNodes: number;
	assetCount: number;
}

export interface EngineCompiledPage {
	generation: 3;
	id: string;
	schema: PageSchema;
	root: EngineCompiledNode;
	summary: EngineCompilerSummary;
	featureManifest: EngineUsedFeatureManifest;
	fallbackPlan: EngineFallbackPlan;
	/** Compatibility alias for the feature names in featureManifest. */
	capabilities: EngineCapability[];
	assets: EngineCompiledAsset[];
	diagnostics: EngineCompilerDiagnostic[];
}

export interface EngineCompileOptions {
	pageId?: string;
	device?: EngineDeviceTarget;
	strict?: boolean;
	/** Serious security diagnostics fail compilation by default. */
	security?: "enforce" | "report" | "off";
}
