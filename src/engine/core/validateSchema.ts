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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function describeValue(value: unknown): string {
	try {
		const serialized = JSON.stringify(value);
		return serialized === undefined ? String(value) : serialized;
	} catch {
		return Object.prototype.toString.call(value);
	}
}

function validateNode(
	value: unknown,
	path: string,
	errors: ValidationError[],
	ancestors: WeakSet<object>,
): void {
	if (!isPlainRecord(value)) {
		errors.push({
			path,
			message: `node must be a plain SchemaNode object (got ${describeValue(value)})`,
			level: "error",
		});
		return;
	}

	if (ancestors.has(value)) {
		errors.push({
			path,
			message: "circular schema reference detected",
			level: "error",
		});
		return;
	}

	ancestors.add(value);
	try {
		const node = value as unknown as SchemaNode;

		if (!node.type || typeof node.type !== "string") {
			errors.push({
				path,
				message: `node.type is missing or not a string (got ${describeValue(node.type)})`,
				level: "error",
			});
			return;
		}

		if (!hasComponent(node.type)) {
			errors.push({
				path,
				message: `unknown node type "${node.type}" — not registered in the component registry`,
				level: "warn",
			});
		}

		const propsAreValid = node.props === undefined || isPlainRecord(node.props);
		if (!propsAreValid) {
			errors.push({
				path: `${path}.props`,
				message: "props must be a plain object",
				level: "error",
			});
		}
		const props = propsAreValid && node.props ? node.props : {};

		for (const { key, type } of REQUIRED_PROPS[node.type] ?? []) {
			const propValue = props[key];
			if (propValue === undefined || propValue === null) {
				errors.push({
					path: `${path}.props.${key}`,
					message: `"${node.type}" nodes require a ${key} prop`,
					level: "error",
				});
			} else if (type === "array" && !Array.isArray(propValue)) {
				errors.push({
					path: `${path}.props.${key}`,
					message: `"${node.type}" prop "${key}" must be an array (got ${typeof propValue})`,
					level: "error",
				});
			} else if (type !== "array" && typeof propValue !== type) {
				errors.push({
					path: `${path}.props.${key}`,
					message: `"${node.type}" prop "${key}" must be a ${type} (got ${typeof propValue})`,
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
				const child = node.children[index] as unknown;
				if (typeof child === "string") continue;
				validateNode(child, `${path}.children[${index}]`, errors, ancestors);
			}
		}
	} finally {
		ancestors.delete(value);
	}
}

export function validateSchema(root: SchemaNode): ValidationResult {
	const errors: ValidationError[] = [];
	validateNode(root, "root", errors, new WeakSet<object>());
	return { valid: errors.every((error) => error.level !== "error"), errors };
}

export function validatePageSchema(schema: PageSchema): ValidationResult {
	if (!isPlainRecord(schema)) {
		return {
			valid: false,
			errors: [{
				path: "schema",
				message: "page schema must be a plain object",
				level: "error",
			}],
		};
	}

	const result = validateSchema(schema.root);
	if (process.env.NODE_ENV !== "production" && result.errors.length > 0) {
		for (const error of result.errors) {
			const prefix = error.level === "error" ? "❌ [Engine]" : "⚠️  [Engine]";
			console.warn(`${prefix} ${error.path}: ${error.message}`);
		}
	}
	return result;
}
