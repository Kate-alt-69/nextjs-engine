// ─────────────────────────────────────────────────────────────────────────────
//  Engine — schemaAnalyzer  (TASK-018)
//
//  Static analyzer for PageSchema / SchemaNode trees.
//  Produces TypeScript-compiler-style diagnostics without throwing.
//
//  Checks:
//    E001 — Unknown node type          (+ "did you mean X?" via Levenshtein)
//    E002 — Missing required prop      (type-specific required fields)
//    E003 — Duplicate id / point       (reports first-seen path)
//    E004 — Circular reference         (same object seen twice in tree)
//    W001 — Accessibility: image missing alt
//    W002 — Accessibility: button / link has no label or children
//    W003 — Accessibility: checkbox / input missing id or associated label
//    W004 — Performance: node has >100 direct children
//    W005 — Performance: tree depth exceeds 15 levels
//    W006 — Leaf node with children declared (silently ignored at runtime)
// ─────────────────────────────────────────────────────────────────────────────

import type { PageSchema, SchemaNode } from "../schema/types";
import { registeredTypes }             from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
//  Diagnostic types
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warn" | "info";

export interface EngineDiagnostic {
	severity:  DiagnosticSeverity;
	code:      string;
	message:   string;
	path:      string;
	// Optional suggestion for fixes
	hint?:     string;
}

export interface AnalyzerResult {
	diagnostics: EngineDiagnostic[];
	errors:      number;
	warnings:    number;
	/** TypeScript-compiler-style formatted string */
	formatted:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Levenshtein distance for "did you mean?"
// ─────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
		Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	);
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] = a[i - 1] === b[j - 1]
				? dp[i - 1][j - 1]
				: 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
		}
	}
	return dp[m][n];
}

function nearest(unknown: string, candidates: string[]): string | undefined {
	let best: string | undefined;
	let bestDist = Infinity;
	for (const c of candidates) {
		const d = levenshtein(unknown.toLowerCase(), c.toLowerCase());
		if (d < bestDist) { bestDist = d; best = c; }
	}
	// Only suggest if edit distance is ≤ half the length of the shorter string
	const threshold = Math.floor(Math.min(unknown.length, (best?.length ?? 0)) / 2) + 1;
	return bestDist <= threshold ? best : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Leaf nodes  (children declared on these are ignored)
// ─────────────────────────────────────────────────────────────────────────────

const LEAF_TYPES = new Set([
	"text", "heading", "image", "img", "button", "link",
	"input", "textarea", "checkbox", "label", "option", "optgroup",
	"spacer", "divider", "markdown", "canvas", "video",
]);

// ─────────────────────────────────────────────────────────────────────────────
//  Required-prop map
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_PROPS: Record<string, string[]> = {
	image:    ["src"],
	img:      ["src"],
	video:    ["src"],
	link:     ["href"],
	option:   ["value"],
	select:   [],
};

// ─────────────────────────────────────────────────────────────────────────────
//  Analyzer state
// ─────────────────────────────────────────────────────────────────────────────

interface AnalyzerState {
	diagnostics:    EngineDiagnostic[];
	seenIds:        Map<string, string>;    // id → path where first seen
	seenObjects:    WeakSet<SchemaNode>;    // for circular reference detection
	knownTypes:     string[];
}

function push(
	state:    AnalyzerState,
	severity: DiagnosticSeverity,
	code:     string,
	message:  string,
	path:     string,
	hint?:    string,
): void {
	state.diagnostics.push({ severity, code, message, path, hint });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Node walker
// ─────────────────────────────────────────────────────────────────────────────

function walkNode(node: SchemaNode, path: string, depth: number, state: AnalyzerState): void {
	// ── Circular reference check ─────────────────────────────────────────────
	if (state.seenObjects.has(node)) {
		push(state, "error", "E004",
			`Circular reference detected — the same node object appears more than once in the tree.`,
			path,
			"Ensure every node in the schema is a distinct object, not a shared reference.",
		);
		return; // Don't recurse — would infinite-loop
	}
	state.seenObjects.add(node);

	const props = (node.props ?? {}) as Record<string, unknown>;
	const type  = node.type;

	// ── Unknown node type ────────────────────────────────────────────────────
	if (!state.knownTypes.includes(type)) {
		const suggestion = nearest(type, state.knownTypes);
		push(state, "error", "E001",
			`Unknown node type "${type}".`,
			path,
			suggestion ? `Did you mean "${suggestion}"?` : undefined,
		);
	}

	// ── Required props ───────────────────────────────────────────────────────
	const required = REQUIRED_PROPS[type];
	if (required) {
		for (const prop of required) {
			if (props[prop] == null) {
				push(state, "error", "E002",
					`Node type "${type}" is missing required prop "${prop}".`,
					path,
				);
			}
		}
	}

	// ── Duplicate id / point ─────────────────────────────────────────────────
	const nodeId = (props["id"] ?? props["point"]) as string | undefined;
	if (nodeId) {
		if (state.seenIds.has(nodeId)) {
			push(state, "error", "E003",
				`Duplicate id "${nodeId}" — first declared at ${state.seenIds.get(nodeId)}.`,
				path,
			);
		} else {
			state.seenIds.set(nodeId, path);
		}
	}

	// ── Accessibility ─────────────────────────────────────────────────────────
	if ((type === "image" || type === "img") && props["alt"] == null) {
		push(state, "warn", "W001",
			`Image node is missing an "alt" prop.`,
			path,
			"Add alt=\"\" for decorative images or a descriptive string for meaningful ones.",
		);
	}

	if ((type === "button" || type === "link") && !props["label"] && !props["children"]) {
		push(state, "warn", "W002",
			`"${type}" node has neither a "label" prop nor children — it will render with no accessible text.`,
			path,
			"Add a label prop or children to make this element accessible.",
		);
	}

	if ((type === "checkbox" || type === "input") && !props["id"]) {
		push(state, "warn", "W003",
			`"${type}" node has no "id" prop — it cannot be associated with a <label>.`,
			path,
			"Add an id prop and a matching label's htmlFor to improve accessibility.",
		);
	}

	// ── Performance ───────────────────────────────────────────────────────────
	if (depth > 15) {
		push(state, "warn", "W005",
			`Schema tree is nested ${depth} levels deep — consider flattening the structure.`,
			path,
			"Deep nesting increases reconciliation cost. Aim for ≤ 12 levels.",
		);
	}

	// ── Leaf with children ───────────────────────────────────────────────────
	const children = node.children;
	if (LEAF_TYPES.has(type) && Array.isArray(children) && children.length > 0) {
		push(state, "warn", "W006",
			`"${type}" is a leaf node — its ${children.length} child(ren) will be silently ignored.`,
			path,
		);
		return; // Don't recurse into ignored children
	}

	// ── Child recursion ───────────────────────────────────────────────────────
	if (Array.isArray(children)) {
		if (children.length > 100) {
			push(state, "warn", "W004",
				`Node "${type}" at ${path} has ${children.length} direct children — consider pagination or virtualisation.`,
				path,
				"Rendering >100 children in a single pass may cause layout thrash on low-end devices.",
			);
		}

		for (let i = 0; i < children.length; i++) {
			walkNode(children[i], `${path}.children[${i}]`, depth + 1, state);
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatDiagnostics(diagnostics: EngineDiagnostic[]): string {
	if (diagnostics.length === 0) return "Engine schema analyzer: no issues found.";
	return diagnostics.map((d) => {
		const severity = d.severity === "error" ? "Error" : d.severity === "warn" ? "Warning" : "Info";
		const hint     = d.hint ? `\n    hint: ${d.hint}` : "";
		return `[schema:${d.path}] Engine${severity}(${d.code}): ${d.message}${hint}`;
	}).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Analyze a single SchemaNode tree. */
export function analyzeNode(root: SchemaNode, rootPath = "root"): AnalyzerResult {
	const state: AnalyzerState = {
		diagnostics: [],
		seenIds:     new Map(),
		seenObjects: new WeakSet(),
		knownTypes:  registeredTypes(),
	};

	walkNode(root, rootPath, 0, state);

	const errors   = state.diagnostics.filter((d) => d.severity === "error").length;
	const warnings = state.diagnostics.filter((d) => d.severity === "warn").length;

	return {
		diagnostics: state.diagnostics,
		errors,
		warnings,
		formatted: formatDiagnostics(state.diagnostics),
	};
}

/** Analyze a full PageSchema (analyzes all top-level and nested nodes). */
export function analyzeSchema(schema: PageSchema): AnalyzerResult {
	const state: AnalyzerState = {
		diagnostics: [],
		seenIds:     new Map(),
		seenObjects: new WeakSet(),
		knownTypes:  registeredTypes(),
	};

	if (!schema.root) {
		state.diagnostics.push({
			severity: "error",
			code:     "E005",
			message:  "PageSchema is missing a \"root\" node.",
			path:     "schema",
		});
	} else {
		walkNode(schema.root, "root", 0, state);
	}

	const errors   = state.diagnostics.filter((d) => d.severity === "error").length;
	const warnings = state.diagnostics.filter((d) => d.severity === "warn").length;

	return {
		diagnostics: state.diagnostics,
		errors,
		warnings,
		formatted: formatDiagnostics(state.diagnostics),
	};
}

/** Returns true if the schema has no errors (warnings are allowed). */
export function isSchemaValid(schema: PageSchema): boolean {
	return analyzeSchema(schema).errors === 0;
}
