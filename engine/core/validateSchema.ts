// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Schema Validator
// ─────────────────────────────────────────────────────────────────────────────

import type { PageSchema, SchemaNode } from "../schema/types";
import { hasComponent } from "./registry";

export interface ValidationError {
	path: string;
	message: string;
	level: "error" | "warn";
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

const REQUIRED_PROPS: Partial<Record<string, Array<{ key: string; type: string }>>> = {
	image: [{ key: "src", type: "string" }, { key: "alt", type: "string" }],
	markdown: [],
	button: [],
	"custom-select": [{ key: "name", type: "string" }, { key: "options", type: "array" }],
	canvas: [],
	slot: [{ key: "name", type: "string" }],
};

function validateNode(node: SchemaNode, path: string): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!node.type || typeof node.type !== "string") {
		errors.push({
			path,
			message: `node.type is missing or not a string (got ${JSON.stringify(node.type)})`,
			level: "error",
		});
		return errors;
	}

	if (!hasComponent(node.type)) {
		errors.push({
			path,
			message: `unknown node type "${node.type}" — not registered in the component registry`,
			level: "warn",
		});
	}

	if (node.props !== undefined && (typeof node.props !== "object" || Array.isArray(node.props))) {
		errors.push({
			path: `${path}.props`,
			message: "props must be a plain object",
			level: "error",
		});
	}

	const props = node.props ?? {};
	for (const { key, type } of REQUIRED_PROPS[node.type] ?? []) {
		const value = props[key];
		if (value === undefined || value === null) {
			errors.push({
				path: `${path}.props.${key}`,
				message: `"${node.type}" nodes require a ${key} prop`,
				level: "error",
			});
		} else if (type === "array" && !Array.isArray(value)) {
			errors.push({
				path: `${path}.props.${key}`,
				message: `"${node.type}" prop "${key}" must be an array (got ${typeof value})`,
				level: "error",
			});
		} else if (type !== "array" && typeof value !== type) {
			errors.push({
				path: `${path}.props.${key}`,
				message: `"${node.type}" prop "${key}" must be a ${type} (got ${typeof value})`,
				level: "error",
			});
		}
	}

	if (node.type === "markdown" && !props.content && !props.filePath) {
		errors.push({
			path: `${path}.props`,
			message: "markdown nodes require either a content or filePath prop",
			level: "warn",
		});
	}

	// Callback mode and graphics mode are both valid Canvas render sources.
	if (node.type === "canvas" && !props.onDraw && !props.onSetup && !props.graphics) {
		errors.push({
			path: `${path}.props`,
			message: "canvas node has no callback or graphics source — it will render a blank canvas",
			level: "warn",
		});
	}

	if (node.children !== undefined && !Array.isArray(node.children) && typeof node.children !== "string") {
		errors.push({
			path: `${path}.children`,
			message: "children must be an array of SchemaNode or a plain string",
			level: "error",
		});
	}

	if (Array.isArray(node.children)) {
		for (let index = 0; index < node.children.length; index++) {
			const child = node.children[index] as SchemaNode;
			if (child && typeof child === "object") {
				errors.push(...validateNode(child, `${path}.children[${index}]`));
			} else if (child !== null && child !== undefined && typeof child !== "string") {
				errors.push({
					path: `${path}.children[${index}]`,
					message: `child at index ${index} must be a SchemaNode object or string (got ${typeof child})`,
					level: "error",
				});
			}
		}
	}

	return errors;
}

export function validateSchema(root: SchemaNode): ValidationResult {
	const errors = validateNode(root, "root");
	return { valid: errors.every((error) => error.level !== "error"), errors };
}

export function validatePageSchema(schema: PageSchema): ValidationResult {
	const result = validateSchema(schema.root);
	if (process.env.NODE_ENV !== "production" && result.errors.length > 0) {
		for (const error of result.errors) {
			const prefix = error.level === "error" ? "❌ [Engine]" : "⚠️  [Engine]";
			console.warn(`${prefix} ${error.path}: ${error.message}`);
		}
	}
	return result;
}
