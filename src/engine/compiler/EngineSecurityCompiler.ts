// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — schema security diagnostics (D.19)
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCompiledNode, EngineCompilerDiagnostic } from "./types";

const SECRET_KEY = /^(?:api[-_]?key|authorization|bearer|client[-_]?secret|password|private[-_]?key|secret|token)$/i;
const PRIVATE_IMPORT = /(?:^|[/@._-])(?:database|db|drizzle|mongoose|mysql|pg|postgres|prisma|redis|server-only)(?:$|[/@._-])/i;
const SAFE_SECRET_REFERENCE = /^(?:\$\{|env:|process\.env\.|secret:|vault:|<[^>]+>|\*+)/i;

function diagnostic(
	level: EngineCompilerDiagnostic["level"],
	code: string,
	message: string,
	node: EngineCompiledNode,
	path?: string,
): EngineCompilerDiagnostic {
	return Object.freeze({ level, code, message, nodeId: node.id, path: path ?? node.path });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scanValue(value: unknown, key: string, path: string, node: EngineCompiledNode, diagnostics: EngineCompilerDiagnostic[]): void {
	if (typeof value === "string") {
		if (SECRET_KEY.test(key) && value.trim() && !SAFE_SECRET_REFERENCE.test(value.trim())) {
			diagnostics.push(diagnostic("error", "G3-S001", `A literal ${key} value would be compiled into the schema. Use an environment or vault reference.`, node, path));
		}
		if (/^(?:href|src|url|action)$/i.test(key) && /^\s*javascript:/i.test(value)) {
			diagnostics.push(diagnostic("error", "G3-S002", `Unsafe javascript: URL in ${key}.`, node, path));
		}
		if (node.runtime === "client" && /^(?:import|module|resolver)$/i.test(key) && PRIVATE_IMPORT.test(value)) {
			diagnostics.push(diagnostic("error", "G3-S003", `A client node imports a private database/server module through ${key}.`, node, path));
		}
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((entry, index) => scanValue(entry, key, `${path}.${index}`, node, diagnostics));
		return;
	}
	if (!isRecord(value)) return;

	const origin = value.origin ?? value.origins;
	const wildcardOrigin = origin === "*" || Array.isArray(origin) && origin.includes("*");
	if (wildcardOrigin && value.credentials === true) {
		diagnostics.push(diagnostic("error", "G3-S004", "Credentialed CORS cannot allow the wildcard origin.", node, path));
	}
	const sameSite = typeof value.sameSite === "string" ? value.sameSite.toLowerCase() : undefined;
	if (sameSite === "none" && value.secure !== true) {
		diagnostics.push(diagnostic("error", "G3-S005", "SameSite=None cookies must also be Secure.", node, path));
	}
	if ((value.protected === true || value.auth === "required") && value.requiresDeviceProof === false) {
		diagnostics.push(diagnostic("error", "G3-S006", "A protected command explicitly disables device verification.", node, path));
	}

	for (const [childKey, childValue] of Object.entries(value)) {
		scanValue(childValue, childKey, `${path}.${childKey}`, node, diagnostics);
	}
}

function visit(node: EngineCompiledNode, diagnostics: EngineCompilerDiagnostic[]): void {
	scanValue(node.source.props ?? {}, "props", `${node.path}.props`, node, diagnostics);
	if (node.type === "form" && (node.source.props?.upload === true || node.source.props?.encType === "multipart/form-data")) {
		if (node.source.props?.maxBytes === undefined) diagnostics.push(diagnostic("warning", "G3-S101", "Upload form has no maxBytes limit.", node));
		if (node.source.props?.allowedTypes === undefined) diagnostics.push(diagnostic("warning", "G3-S102", "Upload form has no allowedTypes list.", node));
	}
	for (const child of node.children) visit(child, diagnostics);
}

export function compileEngineSecurityDiagnostics(root: EngineCompiledNode): readonly EngineCompilerDiagnostic[] {
	const diagnostics: EngineCompilerDiagnostic[] = [];
	visit(root, diagnostics);
	return Object.freeze(diagnostics);
}

export function assertEngineSecurityDiagnostics(diagnostics: readonly EngineCompilerDiagnostic[]): void {
	const errors = diagnostics.filter((entry) => entry.level === "error" && entry.code.startsWith("G3-S"));
	if (errors.length === 0) return;
	throw new Error(`[Next.js Engine] Security compilation failed with ${errors.length} serious diagnostic(s): ${errors.map(({ code }) => code).join(", ")}.`);
}
