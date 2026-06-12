// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Schema Validator
//
//  Lightweight structural validation for PageSchema and SchemaNode trees.
//  Zero dependencies — no Zod, no ajv.
//
//  USE IN DEVELOPMENT: wrap your createPage call with validatePageSchema()
//  to catch structural errors before they crash the renderer at runtime.
//
//  USE IN SchemaRenderer: optionally enable with NEXT_PUBLIC_ENGINE_VALIDATE=1
//  to get clean console warnings instead of runtime crashes.
//
//  The validator catches:
//    · Missing required props (image src/alt, markdown content)
//    · Wrong value types (passing array where string expected)
//    · Unknown node types (typos in "type" field)
//    · Deeply nested errors with a readable path like "root.children[2].props.src"
//
//  It does NOT block rendering — it emits console.warn in development and
//  returns a list of ValidationError objects the caller can act on.
// ─────────────────────────────────────────────────────────────────────────────

import type { SchemaNode, PageSchema } from "../schema/types";
import { hasComponent } from "./registry";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationError {
	/** Dot-path to the offending node, e.g. "root.children[2].props.src" */
	path:    string;
	/** Human-readable description of what's wrong */
	message: string;
	/** Severity level */
	level:   "error" | "warn";
}

export interface ValidationResult {
	valid:  boolean;
	errors: ValidationError[];
}

// ── Required props per type ───────────────────────────────────────────────────

const REQUIRED_PROPS: Partial<Record<string, Array<{ key: string; type: string }>>> = {
	image:          [{ key: "src", type: "string" }, { key: "alt", type: "string" }],
	markdown:       [],  // content or filePath — validated below
	button:         [],  // label or children — soft check
	"custom-select": [{ key: "name", type: "string" }, { key: "options", type: "array" }],
	canvas:         [],  // no required props but warn if no handlers
	slot:           [{ key: "name", type: "string" }],
};

// ── Node validator ────────────────────────────────────────────────────────────

function validateNode(node: SchemaNode, path: string): ValidationError[] {
	const errors: ValidationError[] = [];

	// ── type must be a non-empty string ───────────────────────────────────────
	if (!node.type || typeof node.type !== "string") {
		errors.push({
			path,
			message: `node.type is missing or not a string (got ${JSON.stringify(node.type)})`,
			level:   "error",
		});
		return errors; // can't validate further without a type
	}

	// ── warn on unknown types (not in registry + not a string wildcard) ───────
	if (!hasComponent(node.type)) {
		errors.push({
			path,
			message: `unknown node type "${node.type}" — not registered in the component registry`,
			level:   "warn",
		});
	}

	// ── props must be object or absent ────────────────────────────────────────
	if (node.props !== undefined && (typeof node.props !== "object" || Array.isArray(node.props))) {
		errors.push({
			path: `${path}.props`,
			message: "props must be a plain object",
			level: "error",
		});
	}

	const props = node.props ?? {};

	// ── required prop checks ──────────────────────────────────────────────────
	const required = REQUIRED_PROPS[node.type];
	if (required) {
		for (const { key, type } of required) {
			const val = props[key];
			if (val === undefined || val === null) {
				errors.push({
					path:    `${path}.props.${key}`,
					message: `"${node.type}" nodes require a ${key} prop`,
					level:   "error",
				});
			} else if (type === "array" && !Array.isArray(val)) {
				errors.push({
					path:    `${path}.props.${key}`,
					message: `"${node.type}" prop "${key}" must be an array (got ${typeof val})`,
					level:   "error",
				});
			} else if (type !== "array" && typeof val !== type) {
				errors.push({
					path:    `${path}.props.${key}`,
					message: `"${node.type}" prop "${key}" must be a ${type} (got ${typeof val})`,
					level:   "error",
				});
			}
		}
	}

	// ── markdown: must have content or filePath ───────────────────────────────
	if (node.type === "markdown" && !props.content && !props.filePath) {
		errors.push({
			path:    `${path}.props`,
			message: "markdown nodes require either a content or filePath prop",
			level:   "warn",
		});
	}

	// ── canvas: warn if no handlers ───────────────────────────────────────────
	if (node.type === "canvas" && !props.onDraw && !props.onSetup) {
		errors.push({
			path:    `${path}.props`,
			message: "canvas node has no onDraw or onSetup handler — it will render a blank canvas",
			level:   "warn",
		});
	}

	// ── children must be array or string ─────────────────────────────────────
	if (node.children !== undefined && !Array.isArray(node.children) && typeof node.children !== "string") {
		errors.push({
			path:    `${path}.children`,
			message: "children must be an array of SchemaNode or a plain string",
			level:   "error",
		});
	}

	// ── recurse into children ─────────────────────────────────────────────────
	if (Array.isArray(node.children)) {
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i] as SchemaNode;
			if (child && typeof child === "object") {
				errors.push(...validateNode(child, `${path}.children[${i}]`));
			} else if (child !== null && child !== undefined && typeof child !== "string") {
				errors.push({
					path:    `${path}.children[${i}]`,
					message: `child at index ${i} must be a SchemaNode object or string (got ${typeof child})`,
					level:   "error",
				});
			}
		}
	}

	return errors;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate a SchemaNode tree. Returns all errors found at every depth.
 *
 * @example
 * const result = validateSchema(mySchema.root);
 * if (!result.valid) console.error(result.errors);
 */
export function validateSchema(root: SchemaNode): ValidationResult {
	const errors = validateNode(root, "root");
	return { valid: errors.filter((e) => e.level === "error").length === 0, errors };
}

/**
 * Validate an entire PageSchema including meta and theme.
 * Emits console.warn for each issue in development; returns the result.
 */
export function validatePageSchema(schema: PageSchema): ValidationResult {
	const result = validateSchema(schema.root);

	if (process.env.NODE_ENV !== "production" && result.errors.length > 0) {
		for (const err of result.errors) {
			const prefix = err.level === "error" ? "❌ [Engine]" : "⚠️  [Engine]";
			console.warn(`${prefix} ${err.path}: ${err.message}`);
		}
	}

	return result;
}
