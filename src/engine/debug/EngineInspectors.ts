// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — development inspector contracts (D.11–D.15)
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAdaptiveChange } from "../compiler/EngineAdaptiveCompiler";
import type {
	EngineCapability,
	EngineCompiledNode,
	EngineCompiledPage,
	EngineFeatureSupportResolver,
	EngineResolvedFallbackPlan,
	EngineResolvedFallbackStatus,
	EngineUsedFeatureSource,
} from "../compiler/types";
import { resolveEngineFallbackPlan } from "../compiler/EngineFallbackCompiler";
import type { EngineCookieIndex } from "../core/enginecookies/EngineCookies";
import type { EngineCookieBindingMode, EngineCookieIndexEntry } from "../core/enginecookies/types";
import type { NENCServerManifest } from "../core/nenc/NENCManifest";

const KNOWN_CAPABILITIES: readonly EngineCapability[] = Object.freeze([
	"dom",
	"canvas",
	"webgl",
	"webgl2",
	"request-animation-frame",
	"intersection-observer",
	"visual-viewport",
	"view-transitions",
	"web-animations",
	"container-queries",
	"media-queries",
	"css-grid",
	"clipboard",
	"media",
	"speech",
	"network",
]);

function assertDevelopment(name: string): void {
	if (process.env.NODE_ENV === "production") {
		throw new Error(`[Next.js Engine] ${name} is development-only.`);
	}
}

export interface EngineNENCInspection {
	logicalName: string;
	runtime: "client" | "server" | "auto";
	server: boolean;
	compiledCommand: string;
	authentication: string;
	permissions: readonly string[];
	usesEngineAPIResolver: boolean;
	privateEndpointExposed: false;
	publicEndpoint: "/_static/command";
}

export function inspectEngineNENC(manifest: NENCServerManifest): readonly EngineNENCInspection[] {
	assertDevelopment("NENC inspection");
	return Object.freeze(Object.values(manifest.commandsById)
		.sort((left, right) => left.name.localeCompare(right.name))
		.map((command) => Object.freeze({
			logicalName: command.name,
			runtime: command.run,
			server: command.run !== "client",
			compiledCommand: command.id,
			authentication: command.auth,
			permissions: Object.freeze([...command.permissions]),
			usesEngineAPIResolver: command.run !== "client",
			privateEndpointExposed: false as const,
			publicEndpoint: manifest.endpoint,
		})));
}

export interface EngineCookieInspection {
	alias: string;
	owner: string;
	creator: string;
	purpose?: string;
	deviceBinding: EngineCookieBindingMode;
	deviceKeyId?: string;
	authorizedCommands: readonly string[];
	createdAt: number;
	expiresAt?: number;
	expired: boolean;
}

function inspectCookieEntry(entry: EngineCookieIndexEntry, now: number): EngineCookieInspection {
	return Object.freeze({
		alias: entry.alias,
		owner: entry.owner,
		creator: entry.creator,
		purpose: entry.purpose,
		deviceBinding: entry.binding,
		deviceKeyId: entry.device?.keyId,
		authorizedCommands: Object.freeze([...entry.commands]),
		createdAt: entry.createdAt,
		expiresAt: entry.expiresAt,
		expired: entry.expiresAt !== undefined && entry.expiresAt <= now,
	});
}

export function inspectEngineCookies(
	index: EngineCookieIndex | readonly EngineCookieIndexEntry[],
	now = Date.now(),
): readonly EngineCookieInspection[] {
	assertDevelopment("EngineCookie inspection");
	const entries = "list" in index ? index.list() : index;
	return Object.freeze([...entries]
		.sort((left, right) => left.alias.localeCompare(right.alias))
		.map((entry) => inspectCookieEntry(entry, now)));
}

export interface EngineCapabilityInspection {
	feature: EngineCapability;
	usage: "USED" | "UNUSED";
	nativeSupported: boolean;
	status: EngineResolvedFallbackStatus | "unused";
	fallback?: string;
	requiredBy: readonly EngineUsedFeatureSource[];
}

export function inspectEngineCapabilities(
	plan: EngineCompiledPage,
	isSupported: EngineFeatureSupportResolver,
): readonly EngineCapabilityInspection[] {
	assertDevelopment("capability inspection");
	const resolved = resolveEngineFallbackPlan(plan.fallbackPlan, isSupported);
	const resolvedByFeature = new Map(resolved.features.map((entry) => [entry.feature, entry]));
	const features = new Set<EngineCapability>([
		...KNOWN_CAPABILITIES,
		...plan.featureManifest.uses.map((entry) => entry.feature),
	]);
	return Object.freeze([...features]
		.sort((left, right) => left.localeCompare(right))
		.map((feature) => {
			const resolution = resolvedByFeature.get(feature);
			return Object.freeze({
				feature,
				usage: resolution ? "USED" as const : "UNUSED" as const,
				nativeSupported: isSupported(feature),
				status: resolution?.status ?? "unused",
				fallback: resolution?.status === "fallback" ? resolution.strategy?.id : undefined,
				requiredBy: resolution?.requiredBy ?? Object.freeze([]),
			});
		}));
}

export type EngineDecisionKind = "runtime" | "scheduling" | "responsive" | "fallback";

export interface EngineDecisionExplanation {
	kind: EngineDecisionKind;
	pageId: string;
	nodeId?: string;
	path?: string;
	decision: string;
	why: string;
}

function visitNodes(root: EngineCompiledNode, visitor: (node: EngineCompiledNode) => void): void {
	visitor(root);
	for (const child of root.children) visitNodes(child, visitor);
}

export function explainEngineDecisions(
	plan: EngineCompiledPage,
	options: {
		adaptiveChanges?: readonly EngineAdaptiveChange[];
		resolvedFallbacks?: EngineResolvedFallbackPlan;
	} = {},
): readonly EngineDecisionExplanation[] {
	assertDevelopment("compiler decision explanation");
	const explanations: EngineDecisionExplanation[] = [];
	visitNodes(plan.root, (node) => {
		explanations.push(Object.freeze({
			kind: "runtime",
			pageId: plan.id,
			nodeId: node.id,
			path: node.path,
			decision: node.runtime,
			why: node.runtimeReason,
		}));
		explanations.push(Object.freeze({
			kind: "scheduling",
			pageId: plan.id,
			nodeId: node.id,
			path: node.path,
			decision: node.workClass,
			why: node.workReason,
		}));
	});
	for (const change of options.adaptiveChanges ?? []) {
		explanations.push(Object.freeze({
			kind: "responsive",
			pageId: plan.id,
			path: change.path,
			decision: Object.keys(change.changes).sort().join(", ") || "preserved",
			why: change.reason,
		}));
	}
	for (const fallback of options.resolvedFallbacks?.features ?? []) {
		explanations.push(Object.freeze({
			kind: "fallback",
			pageId: plan.id,
			decision: `${fallback.feature}: ${fallback.strategy?.id ?? "unavailable"}`,
			why: fallback.status === "native"
				? "The browser provides the used feature natively."
				: fallback.status === "fallback"
					? `The native feature is unavailable, so the first supported compiled strategy is ${fallback.strategy?.id}.`
					: "Neither the native feature nor an honest compiled fallback is available.",
		}));
	}
	return Object.freeze(explanations);
}

export const ENGINE_DEBUG_KNOWN_CAPABILITIES = KNOWN_CAPABILITIES;
