// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — deterministic used-feature manifest
// ─────────────────────────────────────────────────────────────────────────────

import type {
	EngineCapability,
	EngineCompiledNode,
	EngineUsedFeature,
	EngineUsedFeatureManifest,
	EngineUsedFeatureSource,
} from "./types";

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sourceFor(node: EngineCompiledNode): EngineUsedFeatureSource {
	return Object.freeze({
		nodeId: node.id,
		path: node.path,
		nodeType: node.type,
		runtime: node.runtime,
	});
}

export function compileEngineUsedFeatureManifest(
	pageId: string,
	root: EngineCompiledNode,
): EngineUsedFeatureManifest {
	const featureSources = new Map<EngineCapability, EngineUsedFeatureSource[]>();
	const visit = (node: EngineCompiledNode): void => {
		for (const feature of node.capabilities) {
			const sources = featureSources.get(feature) ?? [];
			sources.push(sourceFor(node));
			featureSources.set(feature, sources);
		}
		for (const child of node.children) visit(child);
	};
	visit(root);

	const uses: EngineUsedFeature[] = [...featureSources.entries()]
		.sort(([left], [right]) => compareText(left, right))
		.map(([feature, sources]) => Object.freeze({
			feature,
			requiredBy: Object.freeze([...sources].sort((left, right) => (
				compareText(left.path, right.path) || compareText(left.nodeId, right.nodeId)
			))),
		}));

	return Object.freeze({
		version: 1,
		pageId,
		uses: Object.freeze(uses),
	});
}
