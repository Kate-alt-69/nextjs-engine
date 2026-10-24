"use strict";

export type EngineDebugSeverity = "error" | "warning";
export type EngineDebugSource = "runtime" | "unhandled-rejection" | "console" | "next-overlay";

export interface EngineDebugDiagnostic {
	id: string;
	at: number;
	firstAt?: number;
	occurrences?: number;
	routes?: string[];
	severity: EngineDebugSeverity;
	category: "Hydration" | "SSR" | "Runtime" | "Console";
	source: EngineDebugSource;
	ownerHint: "Likely NE source" | "Likely application code" | "Likely React / Next.js" | "Unknown";
	message: string;
	detail: string;
	location?: string;
	route?: string;
	repeatCount?: number;
}

const MAX_MESSAGE_LENGTH = 8_000;
const SECRET_PATTERNS: Array<[RegExp, string]> = [
	[/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]"],
	[/\b(access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|authorization)\s*[:=]\s*([^\s,;]+)/gi, "$1=[redacted]"],
	[/\b(cookie|set-cookie)\s*:\s*[^\r\n]+/gi, "$1: [redacted]"],
];
const SOURCE_REFERENCE = /(?:^|[(/])((?:app|pages|src|components|lib|docs)\/[A-Za-z0-9_./@()[\]-]+\.(?:tsx?|jsx?|mjs|cjs|json|css|md)):(\d+)(?::(\d+))?/m;

export function redactEngineDebugText(value: unknown, maxLength = MAX_MESSAGE_LENGTH): string {
	let text: string;
	const errorLike = value && typeof value === "object"
		? value as { name?: unknown; message?: unknown; stack?: unknown }
		: undefined;
	if (value instanceof Error || (errorLike && typeof errorLike.message === "string" && typeof errorLike.stack === "string")) {
		const name = typeof errorLike?.name === "string" && errorLike.name ? errorLike.name : "Error";
		const message = typeof errorLike?.message === "string" ? errorLike.message : String(value);
		text = [name + ": " + message, typeof errorLike?.stack === "string" ? errorLike.stack : ""].filter(Boolean).join("\n");
	} else if (typeof value === "string") {
		text = value;
	} else {
		try {
			text = JSON.stringify(value, (_key, entry) => {
				if (typeof entry === "string" && entry.length > 2_000) return entry.slice(0, 2_000) + "…";
				if (typeof entry === "function") return "[Function]";
				return entry;
			}, 2) ?? String(value);
		} catch {
			text = String(value);
		}
	}
	for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
	return text.length > maxLength ? text.slice(0, maxLength) + "\n…[truncated]" : text;
}

function usefulErrorMessage(source: EngineDebugSource, message: string, detail: string): string {
	const generic = /^(?:Unhandled promise rejection|Next\.js development error overlay|console\.error)$/i.test(message.trim());
	if (!generic && !(source === "next-overlay" && /^(?:Build Error|Runtime Error|Server Error)$/i.test(message.trim()))) return message;
	const lines = (detail || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
	const useful = lines.find(line =>
		/^(?:TypeError|ReferenceError|SyntaxError|RangeError|AggregateError|Error|Module not found|Failed to compile|Cannot find module|Cannot resolve|Unknown file extension|Invalid .*|Expected .*|Unexpected token)\b/i.test(line)
		&& !/^Next\.js development error overlay$/i.test(line));
	if (useful) return useful.slice(0, 1_600);
	if (source === "unhandled-rejection" && lines[0]) return lines[0].slice(0, 1_600);
	if (source === "next-overlay") {
		const first = lines.find(line => !/^(?:Next\.js|Build Error|Runtime Error|Server Error|Call Stack|Import trace for requested module)$/i.test(line));
		if (first) return first.slice(0, 1_600);
	}
	if (source === "console" && lines[0]) return lines[0].slice(0, 1_600);
	return message;
}

export function extractEngineDebugSourceReference(value: unknown): string | null {
	const text = typeof value === "string" ? value : redactEngineDebugText(value, 8_000);
	SOURCE_REFERENCE.lastIndex = 0;
	const match = SOURCE_REFERENCE.exec(text);
	return match?.[1] && match[2] ? match[1].replace(/\\/g, "/") + ":" + match[2] : null;
}

export function classifyEngineDebugDiagnostic(source: EngineDebugSource, message: string, detail = ""):
	Pick<EngineDebugDiagnostic, "severity" | "category" | "ownerHint"> {
	const combined = (message + "\n" + detail).toLowerCase();
	const hydration = /hydration|hydrating|server html|did not match|text content does not match|hydration failed/.test(combined);
	const ssr = /server.?side render|server render|server component|error occurred prerender|failed to render on the server|ssr error/.test(combined);
	const explicitFailure = /uncaught|unhandled|fatal|error:|mismatch|hydration|did not match|failed|exception|server error/.test(combined);
	const isWarning = /\bwarn(?:ing)?\b|deprecated|will be removed/.test(combined);
	const severity: EngineDebugSeverity = source === "console" && isWarning && !explicitFailure ? "warning" : "error";
	const category: EngineDebugDiagnostic["category"] = hydration ? "Hydration" : ssr ? "SSR" : source === "console" ? "Console" : "Runtime";
	let ownerHint: EngineDebugDiagnostic["ownerHint"] = "Unknown";
	if (/src\/engine\/|\/engine\/debug\/|\[engine(?:canvas|shader|manim|provider|style|scroll|transitions)?\]|nextjs-engine\/(?:src\/)?engine/i.test(combined)) {
		ownerHint = "Likely NE source";
	} else if (/(^|[\s("'\\])(?:src\/)?(?:app|pages|components|lib)\/|\bat\s+(?:async\s+)?(?:Home|Page|Layout|RootLayout)\b/.test(combined)) {
		ownerHint = "Likely application code";
	} else if (/react-dom|react\.production|next\/dist|next\.js|nextjs\.org\/docs\/messages|react\.dev\/errors/.test(combined)) {
		ownerHint = "Likely React / Next.js";
	}
	return { severity, category, ownerHint };
}

function routeFromLocation(location: string | undefined): string | null {
	if (!location) return null;
	const value = location.trim();
	if (!/^\/(?!\/)[^:\s]*(?:\?[^:\s]*)?$/.test(value)) return null;
	return value.split("?")[0] || "/";
}

export function engineDebugDiagnosticFingerprint(diagnostic: Pick<EngineDebugDiagnostic, "severity" | "category" | "message" | "detail" | "location">): string {
	const sourceReference = extractEngineDebugSourceReference([
		diagnostic.location ?? "",
		diagnostic.message,
		diagnostic.detail,
	].join("\n"));
	const stableMessage = diagnostic.message.trim().replace(/\s+/g, " ").toLowerCase();
	return [diagnostic.severity, diagnostic.category, stableMessage, sourceReference ?? ""].join("|");
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
	return (hash >>> 0).toString(16);
}

export function createEngineDebugDiagnostic(input: {
	source: EngineDebugSource;
	message: unknown;
	detail?: unknown;
	location?: string;
	route?: string;
	now?: number;
}): EngineDebugDiagnostic {
	const rawMessage = redactEngineDebugText(input.message, 1_600).trim() || "(empty diagnostic)";
	const detail = redactEngineDebugText(input.detail ?? "", 6_000).trim();
	const message = usefulErrorMessage(input.source, rawMessage, detail);
	const classification = classifyEngineDebugDiagnostic(input.source, message, detail);
	const location = input.location ? redactEngineDebugText(input.location, 500) : undefined;
	const stableFingerprint = engineDebugDiagnosticFingerprint({ ...classification, message, detail, location });
	const at = input.now ?? Date.now();
	const route = routeFromLocation(input.route) ?? routeFromLocation(location);
	return {
		id: "diag-" + hashText(stableFingerprint),
		at,
		firstAt: at,
		occurrences: 1,
		repeatCount: 1,
		route: route ?? undefined,
		routes: route ? [route] : [],
		...classification,
		source: input.source,
		message,
		detail,
		location,
	};
}

export function formatEngineDebugDiagnostic(diagnostic: EngineDebugDiagnostic): string {
	const routes = diagnostic.routes?.length ? "Routes observed: " + diagnostic.routes.join(", ") : "";
	return [
		"[" + diagnostic.severity.toUpperCase() + "] " + diagnostic.category,
		"Likely owner: " + diagnostic.ownerHint,
		"Source: " + diagnostic.source,
		diagnostic.route ? "Route: " + diagnostic.route : "",
		"Occurrences: " + String(diagnostic.occurrences ?? diagnostic.repeatCount ?? 1),
		"First seen: " + new Date(diagnostic.firstAt ?? diagnostic.at).toISOString(),
		"Last seen: " + new Date(diagnostic.at).toISOString(),
		diagnostic.location ? "Location: " + diagnostic.location : "",
		routes,
		"",
		diagnostic.message,
		diagnostic.detail,
	].filter((line, index) => line || index === 8).join("\n").trim();
}

export function appendEngineDebugDiagnostics(
	current: readonly EngineDebugDiagnostic[],
	incoming: EngineDebugDiagnostic,
	limit = 200,
): EngineDebugDiagnostic[] {
	const incomingFingerprint = engineDebugDiagnosticFingerprint(incoming);
	const existingIndex = current.findIndex(item => engineDebugDiagnosticFingerprint(item) === incomingFingerprint);
	if (existingIndex >= 0) {
		const existing = current[existingIndex];
		const routes = [...new Set([...(existing.routes ?? []), ...(incoming.routes ?? []), ...[routeFromLocation(incoming.location)].filter((route): route is string => Boolean(route))])];
		const richerDetail = (incoming.detail ?? "").length > (existing.detail ?? "").length ? incoming.detail : existing.detail;
		const merged: EngineDebugDiagnostic = {
			...existing,
			at: incoming.at,
			firstAt: existing.firstAt ?? existing.at,
			occurrences: (existing.occurrences ?? existing.repeatCount ?? 1) + (incoming.occurrences ?? incoming.repeatCount ?? 1),
			repeatCount: (existing.repeatCount ?? existing.occurrences ?? 1) + (incoming.repeatCount ?? incoming.occurrences ?? 1),
			route: existing.route ?? incoming.route ?? routes[0],
			routes,
			detail: richerDetail ?? "",
			location: incoming.location ?? existing.location,
			ownerHint: existing.ownerHint === "Unknown" ? incoming.ownerHint : existing.ownerHint,
		};
		return [...current.slice(0, existingIndex), ...current.slice(existingIndex + 1), merged].slice(-Math.max(1, limit));
	}
	const normalized: EngineDebugDiagnostic = {
		...incoming,
		firstAt: incoming.firstAt ?? incoming.at,
		occurrences: incoming.occurrences ?? incoming.repeatCount ?? 1,
		repeatCount: incoming.repeatCount ?? incoming.occurrences ?? 1,
		route: incoming.route ?? routeFromLocation(incoming.location) ?? undefined,
		routes: incoming.routes ?? [...new Set([incoming.route, routeFromLocation(incoming.location)].filter((route): route is string => Boolean(route)))],
	};
	return [...current, normalized].slice(-Math.max(1, limit));
}
