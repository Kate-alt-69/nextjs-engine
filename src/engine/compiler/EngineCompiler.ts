// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — page compiler
// ─────────────────────────────────────────────────────────────────────────────

import type { PageSchema, SchemaNode } from "../schema/types";
import { getEngineRuntimeProfile, resolveNodeRuntime } from "./runtimeRegistry";
import type {
	EngineCapability,
	EngineCompileOptions,
	EngineCompiledAsset,
	EngineCompiledNode,
	EngineCompiledPage,
	EngineCompilerDiagnostic,
	EngineCompilerSummary,
	EngineWorkClass,
} from "./types";

function stableHash(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function resolvePageId(schema: PageSchema, requestedId?: string): string {
	if (requestedId?.trim()) return requestedId.trim();
	const title = schema.meta?.title ?? "page";
	return `engine-${stableHash(title)}`;
}

function resolveWorkClass(node: SchemaNode, depth: number): EngineWorkClass {
	const props = node.props ?? {};
	if (props.priority === true || props.eager === true) return "critical";
	if (props.lazy === true) return "deferred";
	if (node.type === "hero" || (depth === 0 && node.type !== "video")) return "critical";
	const profile = getEngineRuntimeProfile(node.type);
	if (profile.defaultWorkClass) return profile.defaultWorkClass;
	if (depth <= 1) return "visible";
	if (depth <= 3) return "near";
	return "deferred";
}

function addAsset(
	assets: EngineCompiledAsset[],
	ownerNodeId: string,
	workClass: EngineWorkClass,
	kind: EngineCompiledAsset["kind"],
	source: unknown,
	priority: boolean,
): void {
	if (typeof source !== "string" || source.trim().length === 0) return;
	const normalizedSource = source.trim();
	assets.push({
		id: `asset-${stableHash(`${kind}:${normalizedSource}`)}`,
		kind,
		source: normalizedSource,
		ownerNodeId,
		workClass,
		priority,
	});
}

function collectNodeAssets(node: SchemaNode, nodeId: string, workClass: EngineWorkClass): EngineCompiledAsset[] {
	const props = node.props ?? {};
	const assets: EngineCompiledAsset[] = [];
	const priority = props.priority === true || props.eager === true;

	if (node.type === "image") addAsset(assets, nodeId, workClass, "image", props.src, priority);
	if (node.type === "video") {
		addAsset(assets, nodeId, workClass, "video", props.src, priority);
		addAsset(assets, nodeId, workClass, "image", props.poster, priority);
	}
	if (node.type === "canvas" || node.type === "manim" || node.type === "EngineManim" || node.type === "manim3d" || node.type === "EngineManim3D") {
		addAsset(assets, nodeId, workClass, "module", `engine:${node.type}`, priority);
	}
	if (typeof props.shader === "string") addAsset(assets, nodeId, workClass, "shader", props.shader, priority);
	if (typeof props.src === "string" && node.type === "markdown") addAsset(assets, nodeId, workClass, "other", props.src, priority);
	return assets;
}

interface CompileState {
	pageId: string;
	diagnostics: EngineCompilerDiagnostic[];
	capabilities: Set<EngineCapability>;
	assets: Map<string, EngineCompiledAsset>;
	summary: EngineCompilerSummary;
}

function compileNode(
	node: SchemaNode,
	path: string,
	depth: number,
	parentRuntime: EngineCompiledNode["runtime"] | null,
	state: CompileState,
): EngineCompiledNode {
	const nodeId = `${state.pageId}-${stableHash(`${path}:${node.type}:${node.name ?? ""}`)}`;
	const runtimeResolution = resolveNodeRuntime(node);
	const workClass = resolveWorkClass(node, depth);
	const capabilities = [...new Set(runtimeResolution.profile.capabilities ?? [])];
	const assets = collectNodeAssets(node, nodeId, workClass);
	const heavy = runtimeResolution.profile.heavy === true;
	const interactive = runtimeResolution.runtime === "client";

	for (const capability of capabilities) state.capabilities.add(capability);
	for (const asset of assets) state.assets.set(asset.id, asset);

	state.summary.totalNodes += 1;
	if (runtimeResolution.runtime === "static") state.summary.staticNodes += 1;
	if (runtimeResolution.runtime === "server") state.summary.serverNodes += 1;
	if (runtimeResolution.runtime === "client") state.summary.clientNodes += 1;
	if (heavy) state.summary.heavyNodes += 1;
	if (interactive && parentRuntime !== "client") {
		state.summary.clientIslands += 1;
		state.diagnostics.push({
			level: "info",
			code: "G3-I001",
			message: `${node.type} becomes a client island: ${runtimeResolution.reason}`,
			nodeId,
			path,
		});
	}

	const children = Array.isArray(node.children)
		? node.children.map((child, index) => compileNode(
			child,
			`${path}.${index}`,
			depth + 1,
			runtimeResolution.runtime,
			state,
		))
		: [];

	return {
		id: nodeId,
		path,
		type: node.type,
		name: node.name,
		depth,
		runtime: runtimeResolution.runtime,
		runtimeReason: runtimeResolution.reason,
		workClass,
		capabilities,
		heavy,
		interactive,
		children,
		assets,
		source: node,
	};
}

export function compilePage(schema: PageSchema, options: EngineCompileOptions = {}): EngineCompiledPage {
	const pageId = resolvePageId(schema, options.pageId);
	const state: CompileState = {
		pageId,
		diagnostics: [],
		capabilities: new Set(),
		assets: new Map(),
		summary: {
			totalNodes: 0,
			staticNodes: 0,
			serverNodes: 0,
			clientNodes: 0,
			clientIslands: 0,
			heavyNodes: 0,
			assetCount: 0,
		},
	};

	const root = compileNode(schema.root, "root", 0, null, state);
	state.summary.assetCount = state.assets.size;

	if (options.strict && state.summary.clientNodes === state.summary.totalNodes && state.summary.totalNodes > 1) {
		state.diagnostics.push({
			level: "warning",
			code: "G3-W001",
			message: "Every compiled node requires client execution. Check whether handlers or interactive props are attached too high in the schema tree.",
		});
	}

	return {
		generation: 3,
		id: pageId,
		schema,
		root,
		summary: state.summary,
		capabilities: [...state.capabilities].sort(),
		assets: [...state.assets.values()],
		diagnostics: state.diagnostics,
	};
}

export function findCompiledNode(plan: EngineCompiledPage, idOrName: string): EngineCompiledNode | undefined {
	const visit = (node: EngineCompiledNode): EngineCompiledNode | undefined => {
		if (node.id === idOrName || node.name === idOrName) return node;
		for (const child of node.children) {
			const match = visit(child);
			if (match) return match;
		}
		return undefined;
	};
	return visit(plan.root);
}

export function explainCompiledNode(plan: EngineCompiledPage, idOrName: string): string | undefined {
	const node = findCompiledNode(plan, idOrName);
	if (!node) return undefined;
	return `${node.type} renders as ${node.runtime}: ${node.runtimeReason}`;
}
