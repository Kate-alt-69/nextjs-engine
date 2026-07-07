// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineMobilePatcher
//
//  Applies a MobileSchemaConfig patch list to a PageSchema, producing a new
//  schema tree tailored for mobile devices.
//
//  The original schema is never mutated — all operations return new objects.
//  The patcher runs server-side inside createPage(), triggered only when the
//  incoming request UA is classified as a mobile device.
//
//  Selector format:
//    "children#my-node"  →  finds the node with name: "my-node"
//    "#my-node"          →  short form, identical effect
//
//  Directive order for each patch entry:
//    1. remove-all-prop  — wipe existing props (including cprop inside it)
//    2. remove-all-cprop — wipe cprop only (keeps all other props)
//    3. props            — merge new prop values in
//    4. cprop.hide       — if true, set display: "none" in props
//    5. cprop (rest)     — merge remaining cprop values into props.cprop
// ─────────────────────────────────────────────────────────────────────────────

import type {
	PageSchema,
	SchemaNode,
	MobileSchemaConfig,
	MobilePatchDirectives,
} from "../schema/types";

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	// Single flat Uint16Array — avoids 2-D array allocation
	const dp = new Uint16Array(rows * cols);

	for (let i = 0; i < rows; i++) dp[i * cols] = i;
	for (let j = 0; j < cols; j++) dp[j]        = j;

	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			dp[i * cols + j] = Math.min(
				dp[(i - 1) * cols + j]     + 1,    // deletion
				dp[i * cols + (j - 1)]     + 1,    // insertion
				dp[(i - 1) * cols + (j - 1)] + cost, // substitution
			);
		}
	}

	return dp[(rows - 1) * cols + (cols - 1)];
}

function didYouMean(name: string, available: string[]): string | null {
	if (available.length === 0) return null;

	let bestName = available[0];
	let bestDist = levenshtein(name, bestName);

	for (let i = 1; i < available.length; i++) {
		const dist = levenshtein(name, available[i]);
		if (dist < bestDist) {
			bestDist = dist;
			bestName = available[i];
		}
	}

	// Only suggest when within 3 edits — beyond that the match is noise
	return bestDist <= 3 ? bestName : null;
}

// ── Selector parser ───────────────────────────────────────────────────────────

/**
 * Extracts the node name from a patch selector string.
 * "children#pricing-point" → "pricing-point"
 * "#pricing-point"         → "pricing-point"
 * "pricing-point"          → "pricing-point"
 */
function parseSelector(selector: string): string {
	const hashIdx = selector.indexOf("#");
	return hashIdx >= 0 ? selector.slice(hashIdx + 1) : selector;
}

// ── Name index builder ────────────────────────────────────────────────────────

type NameIndex = Map<string, true>;

/**
 * Walks the schema tree and collects every node name into a set.
 * Used for "did you mean" suggestions when a selector misses.
 */
function collectNodeNames(node: SchemaNode, out: NameIndex): void {
	if (node.name) out.set(node.name, true);
	if (Array.isArray(node.children)) {
		for (const child of node.children) {
			collectNodeNames(child, out);
		}
	}
}

// ── Patch directive applicator ────────────────────────────────────────────────

/**
 * Applies a MobilePatchDirectives object to a single SchemaNode, returning
 * a new node. The original node is not mutated.
 *
 * Directive application order:
 *   1. remove-all-prop  → wipe node.props entirely
 *   2. remove-all-cprop → wipe props.cprop only
 *   3. patch.props      → merge new props in
 *   4. cprop.hide       → if true, force display: "none" into props
 *   5. cprop (rest)     → merge remaining cprop into props.cprop
 */
function applyDirectives(node: SchemaNode, patch: MobilePatchDirectives): SchemaNode {
	const wipeAllProps  = patch["remove-all-prop"]  === true;
	const wipeCpropOnly = patch["remove-all-cprop"] === true;

	// Step 1 — base props (wiped or cloned)
	const baseProps: Record<string, unknown> = wipeAllProps
		? {}
		: { ...(node.props ?? {}) };

	// Step 2 — wipe cprop only if requested (and we didn't already wipe all)
	if (wipeCpropOnly && !wipeAllProps) {
		delete baseProps.cprop;
	}

	// Step 3 — merge patch.props on top
	const mergedProps: Record<string, unknown> = {
		...baseProps,
		...(patch.props ?? {}),
	};

	// Step 4 & 5 — handle patch.cprop
	if (patch.cprop) {
		const { hide, ...realCpropEntries } = patch.cprop;

		// `hide: true` → display: none directly on the node's props
		if (hide === true) {
			mergedProps.display = "none";
		}

		// Merge the remaining cprop entries into props.cprop
		const entriesCount = Object.keys(realCpropEntries).length;
		if (entriesCount > 0) {
			const existingCprop = (wipeAllProps || wipeCpropOnly)
				? {}
				: ((baseProps.cprop as Record<string, unknown>) ?? {});
			mergedProps.cprop = { ...existingCprop, ...realCpropEntries };
		}
	}

	return { ...node, props: mergedProps };
}

// ── Tree patcher ──────────────────────────────────────────────────────────────

/**
 * Recursively walks the schema tree and applies patches to named nodes.
 * Returns a new tree — original nodes are not mutated.
 */
function patchTree(
	node: SchemaNode,
	patchMap: Map<string, MobilePatchDirectives>,
): SchemaNode {
	// Apply directives if this node was targeted
	const patched: SchemaNode = (node.name && patchMap.has(node.name))
		? applyDirectives(node, patchMap.get(node.name)!)
		: node;

	// Recurse into children
	if (!Array.isArray(patched.children)) return patched;

	const patchedChildren = patched.children.map((child) =>
		patchTree(child, patchMap),
	);

	return { ...patched, children: patchedChildren };
}

// ── Dev warning helper ────────────────────────────────────────────────────────

function devWarn(message: string): void {
	if (process.env.NODE_ENV !== "production") {
		process.stderr.write(`\x1b[33m[engine:mobile]\x1b[0m ${message}\n`);
	}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Applies a `MobileSchemaConfig` patch list to a `PageSchema`.
 *
 * - Patches are processed in array order (later entries override earlier ones
 *   for the same target node).
 * - Unknown selectors emit a dev-only warning with "did you mean?" suggestion.
 * - Returns the original schema unchanged if no patches matched.
 * - Never mutates the input schema or any node within it.
 *
 * @param schema  The original PageSchema (not mutated).
 * @param patches The MobileSchemaConfig array from createPage options.
 * @returns       A new PageSchema with all matching patches applied.
 */
export function applyMobilePatches(
	schema:  PageSchema,
	patches: MobileSchemaConfig,
): PageSchema {
	// Collect all named nodes for did-you-mean suggestions
	const nameIndex: NameIndex = new Map();
	collectNodeNames(schema.root, nameIndex);
	const allNames = [...nameIndex.keys()];

	// Build a flat name → directives map (later patches override earlier ones)
	const patchMap = new Map<string, MobilePatchDirectives>();

	for (const patchObject of patches) {
		for (const [selector, directives] of Object.entries(patchObject)) {
			const name = parseSelector(selector);

			if (!nameIndex.has(name)) {
				const suggestion = didYouMean(name, allNames);
				const hint       = suggestion
					? ` Did you mean "children#${suggestion}"?`
					: " No named nodes found in the schema.";
				devWarn(`Selector "children#${name}" did not match any node.${hint}`);
				continue;
			}

			patchMap.set(name, directives);
		}
	}

	// Nothing matched — return the original schema untouched
	if (patchMap.size === 0) return schema;

	return {
		...schema,
		root: patchTree(schema.root, patchMap),
	};
}