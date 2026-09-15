// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — development-only DOM explanation metadata
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCompiledNode } from "./types";

export type EngineDebugBoundary = "STATIC" | "SERVER" | "CLIENT" | "DEFERRED";

export interface EngineDebugDomAttributes {
	"data-engine-debug-id": string;
	"data-engine-debug-path": string;
	"data-engine-debug-type": string;
	"data-engine-debug-name": string;
	"data-engine-debug-boundary": EngineDebugBoundary;
	"data-engine-debug-rendered": string;
	"data-engine-debug-reason": string;
	"data-engine-debug-hydration": string;
	"data-engine-debug-client-js": string;
	"data-engine-debug-work-class": string;
	"data-engine-debug-capabilities": string;
}

function boundaryFor(node: EngineCompiledNode): EngineDebugBoundary {
	if (node.workClass === "deferred" || node.workClass === "idle" || node.workClass === "sleeping") {
		return "DEFERRED";
	}
	if (node.runtime === "client") return "CLIENT";
	if (node.runtime === "server") return "SERVER";
	return "STATIC";
}

export function compileEngineDebugAttributes(
	node: EngineCompiledNode,
): EngineDebugDomAttributes | undefined {
	if (process.env.NODE_ENV === "production") return undefined;
	const boundary = boundaryFor(node);
	const client = node.runtime === "client";
	return {
		"data-engine-debug-id": node.id,
		"data-engine-debug-path": node.path,
		"data-engine-debug-type": String(node.type),
		"data-engine-debug-name": node.name ?? String(node.type),
		"data-engine-debug-boundary": boundary,
		"data-engine-debug-rendered": boundary === "DEFERRED" && client ? "Deferred Client Island" : client ? "Client Island" : node.runtime === "server" ? "Server" : "Static",
		"data-engine-debug-reason": node.runtimeReason,
		"data-engine-debug-hydration": client ? "Required" : "None",
		"data-engine-debug-client-js": client ? "Lazy runtime chunk" : "0 bytes",
		"data-engine-debug-work-class": node.workClass,
		"data-engine-debug-capabilities": node.capabilities.join(","),
	};
}
