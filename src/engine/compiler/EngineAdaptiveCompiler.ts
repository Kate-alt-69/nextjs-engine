// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — adaptive layout compiler
//
// This compiler changes layout structure/spacing for device classes. It does
// not lower image, video, Canvas, Shader, or other visual resolution.
// ─────────────────────────────────────────────────────────────────────────────

import type { MobileSchemaConfig, PageSchema, SchemaNode } from "../schema/types";
import { applyMobilePatches } from "../core/EngineMobilePatcher";
import type { EngineDeviceTarget } from "./types";

export type EngineAdaptiveRole = "header" | "navigation" | "hero" | "content" | "footer" | "generic";

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
	/** Set false when only structural adaptation + explicit patches are desired. */
	compact?: boolean;
	patches?: MobileSchemaConfig;
}

export type EngineAdaptiveDeviceConfig = "auto" | MobileSchemaConfig | EngineAdaptiveDeviceOptions;

interface AdaptiveContext {
	target: Exclude<EngineDeviceTarget, "desktop">;
	compact: boolean;
}

const ROLE_SPACING = {
	phone: {
		header: { px: "1rem", py: "0.75rem", gap: "0.75rem" },
		navigation: { px: "1rem", py: "0.75rem", gap: "0.75rem" },
		hero: { px: "1.25rem", py: "3.5rem", gap: "1.5rem" },
		content: { px: "1.25rem", py: "3.5rem", gap: "1.25rem" },
		footer: { px: "1.25rem", py: "2.5rem", gap: "1.25rem" },
		generic: { px: "1.25rem", py: "3.5rem", gap: "1.25rem" },
	},
	tablet: {
		header: { px: "1.5rem", py: "1rem", gap: "1rem" },
		navigation: { px: "1.5rem", py: "1rem", gap: "1rem" },
		hero: { px: "1.75rem", py: "4.5rem", gap: "2rem" },
		content: { px: "1.75rem", py: "4.5rem", gap: "1.75rem" },
		footer: { px: "1.75rem", py: "3.5rem", gap: "1.5rem" },
		generic: { px: "1.75rem", py: "4.5rem", gap: "1.75rem" },
	},
} as const;

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

function normalizedHint(value: unknown): string {
	return typeof value === "string"
		? value.trim().toLowerCase().replace(/[_\s]+/g, "-")
		: "";
}

function inferAdaptiveRole(node: SchemaNode): EngineAdaptiveRole {
	const props = node.props ?? {};
	const explicit = normalizedHint(props.adaptiveRole);
	if (["header", "navigation", "hero", "content", "footer"].includes(explicit)) {
		return explicit as EngineAdaptiveRole;
	}

	const htmlRole = normalizedHint(props.role);
	if (htmlRole === "banner") return "header";
	if (htmlRole === "navigation") return "navigation";
	if (htmlRole === "main") return "content";
	if (htmlRole === "contentinfo") return "footer";
	if (node.type === "nav" || node.type === "EngineNav") return "navigation";
	if (node.type === "hero") return "hero";

	const name = normalizedHint(node.name);
	if (/(^|-)header($|-)|(^|-)topbar($|-)/.test(name)) return "header";
	if (/(^|-)nav($|-)|(^|-)navbar($|-)|(^|-)navigation($|-)/.test(name)) return "navigation";
	if (/(^|-)footer($|-)/.test(name)) return "footer";
	if (/(^|-)hero($|-)/.test(name)) return "hero";
	if (/(^|-)main($|-)|(^|-)content($|-)|(^|-)body($|-)/.test(name)) return "content";
	if (node.type === "section") return "content";
	return "generic";
}

function isResponsiveValue(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	return ["xs", "sm", "md", "lg", "xl", "2xl"].some((key) => key in value);
}

function asCssLength(value: unknown): string | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value === 0 ? "0" : `${value / 16}rem`;
	}
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "auto" || trimmed === "none" || trimmed === "normal") return undefined;
	if (/^-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|vw|vh|svw|svh|dvw|dvh|vmin|vmax|ch|ex|cap|ic|lh|rlh)$/.test(trimmed)) return trimmed;
	if (/^(?:var|calc|clamp|min|max)\(/.test(trimmed)) return trimmed;
	return undefined;
}

function capSpacing(
	props: Record<string, unknown>,
	key: string,
	cap: string,
	fallbackWhenMissing = false,
): Record<string, unknown> {
	const current = props[key];
	if (current === undefined) return fallbackWhenMissing ? { ...props, [key]: cap } : props;
	if (isResponsiveValue(current)) return props;
	const cssLength = asCssLength(current);
	if (!cssLength || cssLength === "0") return props;
	const next = `min(${cssLength}, ${cap})`;
	return current === next ? props : { ...props, [key]: next };
}

function compactSemanticSpacing(
	props: Record<string, unknown>,
	role: EngineAdaptiveRole,
	target: AdaptiveContext["target"],
	nodeType: string,
): Record<string, unknown> {
	const limits = ROLE_SPACING[target][role];
	let output = props;
	const sectionLike = nodeType === "section" || nodeType === "hero";
	output = capSpacing(output, "px", limits.px, sectionLike);
	output = capSpacing(output, "py", limits.py, sectionLike);
	output = capSpacing(output, "gap", limits.gap);
	output = capSpacing(output, "rowGap", limits.gap);
	output = capSpacing(output, "colGap", limits.gap);
	if (role === "header" || role === "navigation" || role === "footer") {
		output = capSpacing(output, "p", limits.px);
		output = capSpacing(output, "mt", limits.gap);
		output = capSpacing(output, "mb", limits.gap);
	}
	return output;
}

function adaptNodeProps(
	node: SchemaNode,
	context: AdaptiveContext,
): { props: Record<string, unknown>; reason?: string } {
	const original = node.props ?? {};
	if (original.adaptive === "keep") return { props: original };
	const { target, compact } = context;
	const role = inferAdaptiveRole(node);
	let props = original;
	const reasons: string[] = [];

	if (compact) {
		const compacted = compactSemanticSpacing(props, role, target, String(node.type));
		if (compacted !== props) {
			props = compacted;
			reasons.push(`The ${role} layout spacing was compacted for ${target} without changing visual resolution or content.`);
		}
	}

	if (node.type === "grid") {
		const columns = props.columns;
		if (typeof columns === "number" && columns > (target === "phone" ? 2 : 3) && props.autoFit !== true) {
			props = {
				...props,
				autoFit: true,
				minColWidth: props.minColWidth ?? (target === "phone" ? "min(100%, 220px)" : "min(100%, 250px)"),
			};
			reasons.push("Grid columns now use container-driven auto-fit, so cards compact only when their own available width requires it.");
		}
	}

	if (node.type === "stack" && props.direction === "horizontal") {
		const childCount = Array.isArray(node.children) ? node.children.length : 0;
		const preserveHorizontalRole = role === "header" || role === "navigation";
		if (target === "phone" && childCount >= 3 && !preserveHorizontalRole) {
			props = { ...props, direction: "vertical" };
			reasons.push("A crowded horizontal stack becomes vertical on phone layouts instead of shrinking its contents.");
		} else if (childCount >= (target === "phone" ? 3 : 4) && props.wrap === undefined) {
			props = { ...props, wrap: true };
			reasons.push("The horizontal stack can wrap when its container becomes too narrow.");
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
	context: AdaptiveContext,
	path: string,
	changes: EngineAdaptiveChange[],
): SchemaNode {
	const adapted = adaptNodeProps(node, context);
	let nextChildren = node.children;
	let childrenChanged = false;

	if (Array.isArray(node.children)) {
		const output = node.children.map((child, index) => {
			const nextChild = adaptTree(child, context, `${path}.${index}`, changes);
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

	const compact = typeof config === "object" ? config.compact !== false : true;
	const changes: EngineAdaptiveChange[] = [];
	const root = adaptTree(schema.root, { target, compact }, "root", changes);
	let output = root === schema.root ? schema : { ...schema, root };
	if (typeof config === "object" && config.patches?.length) {
		output = applyMobilePatches(output, config.patches);
	}
	return { schema: output, target, changes };
}
