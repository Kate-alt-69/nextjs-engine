// ─────────────────────────────────────────────────────────────────────────────
//  Engine — schemaAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

import type { PageSchema, SchemaNode } from "../schema/types";
import { registeredTypes } from "./registry";

export type DiagnosticSeverity = "error" | "warn" | "info";

export interface EngineDiagnostic {
	severity: DiagnosticSeverity;
	code: string;
	message: string;
	path: string;
	hint?: string;
}

export interface AnalyzerResult {
	diagnostics: EngineDiagnostic[];
	errors: number;
	warnings: number;
	formatted: string;
}

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	let rows = a;
	let columns = b;
	if (columns.length > rows.length) {
		rows = b;
		columns = a;
	}

	let previous = new Uint32Array(columns.length + 1);
	let current = new Uint32Array(columns.length + 1);
	for (let column = 0; column <= columns.length; column++) previous[column] = column;

	for (let row = 1; row <= rows.length; row++) {
		current[0] = row;
		for (let column = 1; column <= columns.length; column++) {
			const substitutionCost = rows[row - 1] === columns[column - 1] ? 0 : 1;
			current[column] = Math.min(
				previous[column] + 1,
				current[column - 1] + 1,
				previous[column - 1] + substitutionCost,
			);
		}
		const swap = previous;
		previous = current;
		current = swap;
	}
	return previous[columns.length];
}

function nearest(unknown: string, candidates: string[]): string | undefined {
	let best: string | undefined;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const candidate of candidates) {
		const distance = levenshtein(unknown.toLowerCase(), candidate.toLowerCase());
		if (distance < bestDistance) {
			bestDistance = distance;
			best = candidate;
		}
	}
	const threshold = Math.floor(Math.min(unknown.length, best?.length ?? 0) / 2) + 1;
	return bestDistance <= threshold ? best : undefined;
}

// optgroup owns option children at runtime and therefore is not a leaf.
const LEAF_TYPES = new Set([
	"text", "heading", "image", "button", "link", "input", "textarea",
	"checkbox", "label", "option", "spacer", "divider", "markdown", "canvas", "video",
]);

const REQUIRED_PROPS: Record<string, string[]> = {
	image: ["src"],
	video: ["src"],
	link: ["href"],
	option: ["value"],
};

interface SeenNavigationTarget {
	path: string;
	kind: "id" | "point";
}

interface AnalyzerState {
	diagnostics: EngineDiagnostic[];
	seenNavigationTargets: Map<string, SeenNavigationTarget>;
	seenNames: Map<string, string>;
	seenObjects: WeakSet<SchemaNode>;
	knownTypes: string[];
}

function push(
	state: AnalyzerState,
	severity: DiagnosticSeverity,
	code: string,
	message: string,
	path: string,
	hint?: string,
): void {
	state.diagnostics.push({ severity, code, message, path, hint });
}

function hasAccessibleContent(node: SchemaNode, props: Record<string, unknown>): boolean {
	if (typeof props.label === "string" && props.label.trim()) return true;
	if (typeof props.content === "string" && props.content.trim()) return true;
	if (typeof node.children === "string" && node.children.trim()) return true;
	return Array.isArray(node.children) && node.children.length > 0;
}

function recordNavigationTarget(
	state: AnalyzerState,
	value: unknown,
	kind: "id" | "point",
	path: string,
): void {
	if (typeof value !== "string" || value.length === 0) return;
	const first = state.seenNavigationTargets.get(value);
	if (!first) {
		state.seenNavigationTargets.set(value, { path, kind });
		return;
	}
	if (first.path === path) return;

	push(
		state,
		"error",
		"E003",
		`Duplicate navigation target "${value}" — ${kind} collides with ${first.kind} first declared at ${first.path}.`,
		path,
		"Use unique id/point values across the schema so DOM anchors and EngineScroll targets stay unambiguous.",
	);
}

function recordPatchName(state: AnalyzerState, node: SchemaNode, path: string): void {
	if (typeof node.name !== "string" || node.name.length === 0) return;
	const firstPath = state.seenNames.get(node.name);
	if (!firstPath) {
		state.seenNames.set(node.name, path);
		return;
	}

	push(
		state,
		"warn",
		"W007",
		`Duplicate schema name "${node.name}" — first declared at ${firstPath}.`,
		path,
		"EngineMobilePatcher selectors match every node with the same name. Use unique names when a patch should target exactly one node.",
	);
}

function walkNode(node: SchemaNode, path: string, depth: number, state: AnalyzerState): void {
	if (state.seenObjects.has(node)) {
		push(
			state,
			"error",
			"E004",
			"The same schema node object is referenced more than once. Shared/circular node objects are not supported.",
			path,
			"Create a distinct object for each position in the schema tree.",
		);
		return;
	}
	state.seenObjects.add(node);

	const props = (node.props ?? {}) as Record<string, unknown>;
	const type = node.type;

	if (!state.knownTypes.includes(type)) {
		const suggestion = nearest(type, state.knownTypes);
		push(state, "error", "E001", `Unknown node type "${type}".`, path, suggestion ? `Did you mean "${suggestion}"?` : undefined);
	}

	for (const prop of REQUIRED_PROPS[type] ?? []) {
		if (props[prop] == null) push(state, "error", "E002", `Node type "${type}" is missing required prop "${prop}".`, path);
	}

	recordNavigationTarget(state, props.id, "id", path);
	recordNavigationTarget(state, props.point, "point", path);
	recordPatchName(state, node, path);

	if (type === "image" && props.alt == null) {
		push(state, "warn", "W001", "Image node is missing an \"alt\" prop.", path, "Add alt=\"\" for decorative images or descriptive text for meaningful images.");
	}

	if ((type === "button" || type === "link") && !hasAccessibleContent(node, props)) {
		push(state, "warn", "W002", `"${type}" node has no accessible label/content.`, path, "Add label, content, or children.");
	}

	if ((type === "checkbox" || type === "input") && !props.id && !props.point) {
		push(state, "warn", "W003", `"${type}" node has no explicit id/point for label association.`, path, "Add id and a matching label htmlFor/forInput.");
	}

	if (depth > 15) {
		push(state, "warn", "W005", `Schema tree is nested ${depth} levels deep.`, path, "Flatten deeply nested layout where practical.");
	}

	const children = node.children;
	if (LEAF_TYPES.has(type) && Array.isArray(children) && children.length > 0) {
		push(state, "warn", "W006", `"${type}" is a leaf node — its ${children.length} child(ren) will be ignored.`, path);
		return;
	}

	if (Array.isArray(children)) {
		if (children.length > 100) {
			push(state, "warn", "W004", `Node "${type}" has ${children.length} direct children.`, path, "Consider pagination or virtualisation for very large lists.");
		}
		for (let index = 0; index < children.length; index++) {
			walkNode(children[index], `${path}.children[${index}]`, depth + 1, state);
		}
	}
}

function formatDiagnostics(diagnostics: EngineDiagnostic[]): string {
	if (diagnostics.length === 0) return "Engine schema analyzer: no issues found.";
	return diagnostics.map((diagnostic) => {
		const severity = diagnostic.severity === "error" ? "Error" : diagnostic.severity === "warn" ? "Warning" : "Info";
		const hint = diagnostic.hint ? `\n    hint: ${diagnostic.hint}` : "";
		return `[schema:${diagnostic.path}] Engine${severity}(${diagnostic.code}): ${diagnostic.message}${hint}`;
	}).join("\n");
}

function resultFor(state: AnalyzerState): AnalyzerResult {
	const errors = state.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
	const warnings = state.diagnostics.filter((diagnostic) => diagnostic.severity === "warn").length;
	return { diagnostics: state.diagnostics, errors, warnings, formatted: formatDiagnostics(state.diagnostics) };
}

function createState(): AnalyzerState {
	return {
		diagnostics: [],
		seenNavigationTargets: new Map(),
		seenNames: new Map(),
		seenObjects: new WeakSet(),
		knownTypes: registeredTypes(),
	};
}

export function analyzeNode(root: SchemaNode, rootPath = "root"): AnalyzerResult {
	const state = createState();
	walkNode(root, rootPath, 0, state);
	return resultFor(state);
}

export function analyzeSchema(schema: PageSchema): AnalyzerResult {
	const state = createState();
	if (!schema.root) {
		state.diagnostics.push({ severity: "error", code: "E005", message: "PageSchema is missing a \"root\" node.", path: "schema" });
	} else {
		walkNode(schema.root, "root", 0, state);
	}
	return resultFor(state);
}

export function isSchemaValid(schema: PageSchema): boolean {
	return analyzeSchema(schema).errors === 0;
}
