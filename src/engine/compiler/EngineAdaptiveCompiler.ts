// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — adaptive layout compiler
//
// This compiler changes layout structure/spacing for device classes. It does
// not lower image, video, Canvas, Shader, or other visual resolution.
// ─────────────────────────────────────────────────────────────────────────────

import type { MobileSchemaConfig, PageSchema, SchemaNode } from "../schema/types";
import { applyMobilePatches } from "../core/EngineMobilePatcher";
import type { EngineDeviceTarget } from "./types";

export interface EngineAdaptiveChange {
	path: string;
	nodeType: string;
	name?: string;
	reason: string;
	changes: Record<string, unknown>;
}

export interface EngineAdaptiveCompileResult {
	schema: PageSchema;
	target: EngineDeviceTarget;
	changes: EngineAdaptiveChange[];
}

export interface EngineAdaptiveDeviceOptions {
	mode: "auto";
	patches?: MobileSchemaConfig;
}

export type EngineAdaptiveDeviceConfig = "auto" | MobileSchemaConfig | EngineAdaptiveDeviceOptions;

function isPatchList(config: EngineAdaptiveDeviceConfig | undefined): config is MobileSchemaConfig {
	return Array.isArray(config);
}

function withDefaults(
	props: Record<string, unknown>,
	defaults: Record<string, unknown>,
): Record<string, unknown> {
	let changed = false;
	const output = { ...props };
	for (const [key, value] of Object.entries(defaults)) {
		if (output[key] !== undefined) continue;
		output[key] = value;
		changed = true;
	}
	return changed ? output : props;
}

function adaptNodeProps(
	node: SchemaNode,
	target: Exclude<EngineDeviceTarget, "desktop">,
): { props: Record<string, unknown>; reason?: string } {
	const original = node.props ?? {};
	if (original.adaptive === "keep") return { props: original };
	let props = original;
	const reasons: string[] = [];

	if (node.type === "grid") {
		const columns = props.columns;
		if (typeof columns === "number" && columns > (target === "phone" ? 2 : 3) && props.autoFit !== true) {
			props = {
				...props,
				autoFit: true,
				minColWidth: props.minColWidth ?? (target === "phone" ? "min(100%, 220px)" : "min(100%, 250px)"),
			};
			reasons.push("Grid columns were converted to container-driven auto-fit so items compact only when available width requires it.");
		}
	}

	if (node.type === "stack" && props.direction === "horizontal") {
		const childCount = Array.isArray(node.children) ? node.children.length : 0;
		if (target === "phone" && childCount >= 3) {
			props = { ...props, direction: "vertical" };
			reasons.push("A multi-item horizontal stack becomes vertical on phone-sized layouts to prevent cramped content.");
		} else if (target === "tablet" && childCount >= 4 && props.wrap === undefined) {
			props = { ...props, wrap: true };
			reasons.push("A wide tablet stack enables wrapping instead of shrinking its children.");
		}
	}

	if (node.type === "section" || node.type === "hero") {
		const next = withDefaults(props, target === "phone"
			? {
				px: "clamp(1rem, 4vw, 1.5rem)",
				py: "clamp(2.5rem, 8vw, 4rem)",
			}
			: {
				px: "clamp(1.25rem, 3vw, 2rem)",
				py: "clamp(3rem, 6vw, 5rem)",
			});
		if (next !== props) {
			props = next;
			reasons.push("Section spacing was compacted with fluid values while preserving the original content and visual styling.");
		}
	}

	if (node.type === "card" && target === "phone" && props.direction === "horizontal") {
		props = {
			...props,
			direction: "vertical",
			coverWidth: "100%",
		};
		reasons.push("A horizontal card becomes vertical when phone width would otherwise compress its content.");
	}

	if (node.type === "button" || node.type === "input" || node.type === "textarea" || node.type === "custom-select") {
		const next = withDefaults(props, {
			minHeight: target === "phone" ? "44px" : "42px",
		});
		if (next !== props) {
			props = next;
			reasons.push("Interactive controls keep a usable touch target without changing their visual resolution.");
		}
	}

	if ((node.type === "nav" || node.type === "EngineNav") && props.mobileBreakpoint === undefined) {
		props = {
			...props,
			mobileBreakpoint: target === "tablet" ? 900 : 768,
		};
		reasons.push("Navigation uses its built-in compact menu at the target device width.");
	}

	return {
		props,
		reason: reasons.length > 0 ? reasons.join(" ") : undefined,
	};
}

function adaptTree(
	node: SchemaNode,
	target: Exclude<EngineDeviceTarget, "desktop">,
	path: string,
	changes: EngineAdaptiveChange[],
): SchemaNode {
	const adapted = adaptNodeProps(node, target);
	let nextChildren = node.children;
	let childrenChanged = false;

	if (Array.isArray(node.children)) {
		const output = node.children.map((child, index) => {
			const nextChild = adaptTree(child, target, `${path}.${index}`, changes);
			if (nextChild !== child) childrenChanged = true;
			return nextChild;
		});
		if (childrenChanged) nextChildren = output;
	}

	const propsChanged = adapted.props !== (node.props ?? {});
	if (propsChanged && adapted.reason) {
		const changedProps: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(adapted.props)) {
			if ((node.props ?? {})[key] !== value) changedProps[key] = value;
		}
		changes.push({
			path,
			nodeType: String(node.type),
			name: node.name,
			reason: adapted.reason,
			changes: changedProps,
		});
	}

	if (!propsChanged && !childrenChanged) return node;
	return {
		...node,
		...(propsChanged ? { props: adapted.props } : {}),
		...(childrenChanged ? { children: nextChildren } : {}),
	};
}

export function compileAdaptiveSchema(
	schema: PageSchema,
	target: EngineDeviceTarget,
	config: EngineAdaptiveDeviceConfig | undefined = "auto",
): EngineAdaptiveCompileResult {
	if (target === "desktop" || config === undefined) return { schema, target, changes: [] };
	if (isPatchList(config)) {
		return { schema: applyMobilePatches(schema, config), target, changes: [] };
	}

	const changes: EngineAdaptiveChange[] = [];
	const root = adaptTree(schema.root, target, "root", changes);
	let output = root === schema.root ? schema : { ...schema, root };
	if (typeof config === "object" && config.patches?.length) {
		output = applyMobilePatches(output, config.patches);
	}
	return { schema: output, target, changes };
}
