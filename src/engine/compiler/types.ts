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
	capabilities: EngineCapability[];
	heavy: boolean;
	interactive: boolean;
	children: EngineCompiledNode[];
	assets: EngineCompiledAsset[];
	source: SchemaNode;
}

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
	capabilities: EngineCapability[];
	assets: EngineCompiledAsset[];
	diagnostics: EngineCompilerDiagnostic[];
}

export interface EngineCompileOptions {
	pageId?: string;
	device?: EngineDeviceTarget;
	strict?: boolean;
}
