// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineMobilePatcher
//
//  Applies a MobileSchemaConfig patch list to a PageSchema, producing a new
//  schema tree tailored for mobile devices.
//
//  The original schema is never mutated. Untouched branches preserve their
//  original object/children references so large schemas do not pay for a full
//  deep clone when only a few named nodes are patched.
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
//
//  Repeated patches for the same node are applied sequentially in array order.
// ─────────────────────────────────────────────────────────────────────────────

import type {
	PageSchema,
	SchemaNode,
	MobileSchemaConfig,
	MobilePatchDirectives,
} from "../schema/types";

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Keep the working rows as small as possible. The old implementation
	// allocated (a.length + 1) * (b.length + 1) cells for every suggestion.
	const longer = a.length >= b.length ? a : b;
	const shorter = a.length >= b.length ? b : a;
	let previous = new Uint16Array(shorter.length + 1);
	let current = new Uint16Array(shorter.length + 1);

	for (let column = 0; column <= shorter.length; column++) {
		previous[column] = column;
	}

	for (let row = 1; row <= longer.length; row++) {
		current[0] = row;
		for (let column = 1; column <= shorter.length; column++) {
			const cost = longer[row - 1] === shorter[column - 1] ? 0 : 1;
			current[column] = Math.min(
				previous[column] + 1,
				current[column - 1] + 1,
				previous[column - 1] + cost,
			);
		}
		const swap = previous;
		previous = current;
		current = swap;
	}

	return previous[shorter.length];
}

function didYouMean(name: string, available: string[]): string | null {
	if (available.length === 0) return null;

	let bestName = available[0];
	let bestDist = levenshtein(name, bestName);

	for (let index = 1; index < available.length; index++) {
		const distance = levenshtein(name, available[index]);
		if (distance < bestDist) {
			bestDist = distance;
			bestName = available[index];
		}
	}

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
	const normalized = selector.trim();
	const hashIndex = normalized.indexOf("#");
	return (hashIndex >= 0 ? normalized.slice(hashIndex + 1) : normalized).trim();
}

// ── Name index builder ────────────────────────────────────────────────────────

type NameIndex = Map<string, true>;

function collectNodeNames(node: SchemaNode, out: NameIndex): void {
	if (node.name) out.set(node.name, true);
	if (Array.isArray(node.children)) {
		for (const child of node.children) {
			collectNodeNames(child, out);
		}
	}
}

// ── Patch directive applicator ────────────────────────────────────────────────

function applyDirectives(node: SchemaNode, patch: MobilePatchDirectives): SchemaNode {
	const wipeAllProps = patch["remove-all-prop"] === true;
	const wipeCpropOnly = patch["remove-all-cprop"] === true;

	const baseProps: Record<string, unknown> = wipeAllProps
		? {}
		: { ...(node.props ?? {}) };

	if (wipeCpropOnly && !wipeAllProps) {
		delete baseProps.cprop;
	}

	const mergedProps: Record<string, unknown> = {
		...baseProps,
		...(patch.props ?? {}),
	};

	if (patch.cprop) {
		const { hide, ...realCpropEntries } = patch.cprop;

		if (hide === true) {
			mergedProps.display = "none";
		}

		if (Object.keys(realCpropEntries).length > 0) {
			// Merge against the already-merged props value so patch.props.cprop and
			// patch.cprop compose instead of the latter restoring stale base cprop.
			const currentCprop = mergedProps.cprop;
			const existingCprop = currentCprop !== null
				&& typeof currentCprop === "object"
				&& !Array.isArray(currentCprop)
				? currentCprop as Record<string, unknown>
				: {};
			mergedProps.cprop = { ...existingCprop, ...realCpropEntries };
		}
	}

	return { ...node, props: mergedProps };
}

// ── Tree patcher ──────────────────────────────────────────────────────────────

type PatchPlan = Map<string, MobilePatchDirectives[]>;

/**
 * Applies matching directives while structurally sharing untouched branches.
 * A node is cloned only when it is directly patched or one of its descendants
 * changes, avoiding a complete schema clone for small mobile overrides.
 */
function patchTree(node: SchemaNode, patchPlan: PatchPlan): SchemaNode {
	let patched = node;
	const directives = node.name ? patchPlan.get(node.name) : undefined;

	if (directives) {
		for (const directive of directives) {
			patched = applyDirectives(patched, directive);
		}
	}

	if (!Array.isArray(patched.children)) return patched;

	let childrenChanged = false;
	const currentChildren = patched.children;
	const patchedChildren = new Array<SchemaNode>(currentChildren.length);

	for (let index = 0; index < currentChildren.length; index++) {
		const currentChild = currentChildren[index];
		const patchedChild = patchTree(currentChild, patchPlan);
		patchedChildren[index] = patchedChild;
		if (patchedChild !== currentChild) childrenChanged = true;
	}

	if (!childrenChanged) return patched;
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
 * - Patches are processed in array order; repeated targets compose sequentially.
 * - Unknown selectors emit a dev-only warning with a close-name suggestion.
 * - Returns the original schema unchanged if no patches matched.
 * - Untouched schema branches preserve their original object references.
 * - Never mutates the input schema or any node within it.
 */
export function applyMobilePatches(
	schema: PageSchema,
	patches: MobileSchemaConfig,
): PageSchema {
	const nameIndex: NameIndex = new Map();
	collectNodeNames(schema.root, nameIndex);
	const allNames = [...nameIndex.keys()];
	const patchPlan: PatchPlan = new Map();

	for (const patchObject of patches) {
		for (const [selector, directives] of Object.entries(patchObject)) {
			const name = parseSelector(selector);

			if (!nameIndex.has(name)) {
				const suggestion = didYouMean(name, allNames);
				const hint = suggestion
					? ` Did you mean "children#${suggestion}"?`
					: allNames.length === 0
						? " No named nodes found in the schema."
						: " No close named-node match found.";
				devWarn(`Selector "children#${name}" did not match any node.${hint}`);
				continue;
			}

			let targetPatches = patchPlan.get(name);
			if (!targetPatches) {
				targetPatches = [];
				patchPlan.set(name, targetPatches);
			}
			targetPatches.push(directives);
		}
	}

	if (patchPlan.size === 0) return schema;

	const patchedRoot = patchTree(schema.root, patchPlan);
	if (patchedRoot === schema.root) return schema;
	return { ...schema, root: patchedRoot };
}
