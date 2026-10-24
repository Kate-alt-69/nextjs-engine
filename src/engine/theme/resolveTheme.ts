import type {
	EngineTheme,
	EngineThemeJsonObject,
	PageSchema,
	SchemaNode,
} from "../schema/types";
import {
	getEngineThemeComponentDefinitions,
	resolveRegisteredEngineTheme,
} from "./createTheme";

interface ResolvedMarkdownTheme {
	props: Record<string, unknown>;
	styles?: Record<string, unknown>;
}

const MARKDOWN_THEME_PROP_KEYS = new Set([
	"textColor", "headingColor", "linkColor", "mutedColor", "fontFamily",
	"bodySize", "bodyLineHeight", "headingSizes", "headingIdPrefix",
	"textAnimation", "blockAnimation", "animationDuration", "animationStagger",
	"codeBackground", "codeColor", "inlineCodeBackground", "inlineCodeColor",
	"codeBorderColor", "codeFontFamily", "showCodeLanguage", "prettyPlease", "themeTemplates", "ansiPalette",
	"ansiForeground", "ansiBackground", "markdownStyles",
	"emd_show-url-icon", "emd_url-icon-size",
]);
const THEME_REFERENCE_KEYS = new Set(["id", "scope", "sourceUrl", "vars", "fonts", "globalStyles"]);

function isThemeRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeMarkdownStyleSlots(
	base: Record<string, unknown> | undefined,
	overlay: unknown,
): Record<string, unknown> | undefined {
	if (!base && !isThemeRecord(overlay)) return undefined;
	const result: Record<string, unknown> = { ...(base ?? {}) };
	if (isThemeRecord(overlay)) {
		for (const [slot, style] of Object.entries(overlay)) {
			result[slot] = isThemeRecord(result[slot]) && isThemeRecord(style)
				? { ...(result[slot] as Record<string, unknown>), ...style }
				: style;
		}
	}
	return result;
}

function pickMarkdownThemeProps(value: unknown): Record<string, unknown> {
	if (!isThemeRecord(value)) return {};
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (MARKDOWN_THEME_PROP_KEYS.has(key) && key !== "markdownStyles") result[key] = item;
	}
	return result;
}

function resolveMarkdownThemeDefinition(value: EngineThemeJsonObject): {
	props: Record<string, unknown>;
	styles?: Record<string, unknown>;
} {
	const definition = value as Record<string, unknown>;
	const defaults = isThemeRecord(definition.defaults) ? definition.defaults : undefined;
	const explicitProps = isThemeRecord(definition.props) ? definition.props : undefined;
	const props = {
		...pickMarkdownThemeProps(definition),
		...pickMarkdownThemeProps(defaults),
		...pickMarkdownThemeProps(explicitProps),
	};
	const styleParts = [
		definition.styles,
		definition.markdownStyles,
		defaults?.markdownStyles,
		explicitProps?.markdownStyles,
	];
	let styles: Record<string, unknown> | undefined;
	for (const part of styleParts) {
		styles = mergeMarkdownStyleSlots(styles, part);
	}
	if (styles) delete props.markdownStyles;

	// A variant may replace one named template without copying every block.
	const templateParts = [
		definition.templates,
		definition.themeTemplates,
		defaults?.templates,
		defaults?.themeTemplates,
		explicitProps?.themeTemplates,
	];
	const templates: Record<string, unknown> = {};
	for (const part of templateParts) {
		if (isThemeRecord(part)) Object.assign(templates, part);
	}
	if (Object.keys(templates).length > 0) props.themeTemplates = templates;
	return { props, styles };
}

function applyMarkdownThemeToNode(node: SchemaNode, markdownTheme: ResolvedMarkdownTheme): SchemaNode {
	let children = node.children;
	if (Array.isArray(node.children)) {
		const mapped = node.children.map((child) => typeof child === "string"
			? child
			: applyMarkdownThemeToNode(child, markdownTheme));
		if (mapped.some((child, index) => child !== node.children?.[index])) children = mapped;
	}

	if (node.type !== "markdown") {
		return children === node.children ? node : { ...node, children };
	}

	const resolved = markdownTheme;
	const originalProps = node.props ?? {};
	const themeProps = resolved.props;
	const localStyles = originalProps.markdownStyles;
	const mergedStyles = mergeMarkdownStyleSlots(resolved.styles, localStyles);
	const nextProps: Record<string, unknown> = {
		...themeProps,
		...originalProps,
	};
	if (isThemeRecord(themeProps.prettyPlease) || isThemeRecord(originalProps.prettyPlease)) {
		// Per-node provider/theme settings override the corresponding shared
		// options, but an explicitly supplied palette remains a full replacement.
		nextProps.prettyPlease = {
			...(isThemeRecord(themeProps.prettyPlease) ? themeProps.prettyPlease : {}),
			...(isThemeRecord(originalProps.prettyPlease) ? originalProps.prettyPlease : {}),
		};
	}
	if (isThemeRecord(themeProps.themeTemplates) || isThemeRecord(originalProps.themeTemplates)) {
		nextProps.themeTemplates = {
			...(isThemeRecord(themeProps.themeTemplates) ? themeProps.themeTemplates : {}),
			...(isThemeRecord(originalProps.themeTemplates) ? originalProps.themeTemplates : {}),
		};
	}
	if (mergedStyles) nextProps.markdownStyles = mergedStyles;

	return {
		...node,
		...(children !== node.children ? { children } : {}),
		props: nextProps as SchemaNode["props"],
	};
}

export function resolveEngineThemeSchema(schema: PageSchema): PageSchema {
	const theme = schema.theme;
	if (!theme || typeof theme.id !== "string" || !theme.id) return schema;

	const themeRecord = theme as Record<string, unknown>;
	const keys = Object.keys(themeRecord);
	const isQualifiedReference = theme.id.includes(".");
	const isBareReference = keys.every((key) => THEME_REFERENCE_KEYS.has(key));
	const isReference = isQualifiedReference || isBareReference;

	let resolvedCssTheme: EngineTheme = theme;
	let markdownThemes = getEngineThemeComponentDefinitions(theme);

	if (isReference) {
		if (themeRecord.sourceUrl || themeRecord.scope === "remote") {
			throw new Error(
				"Remote EngineTheme fetching is not enabled in this build. The .etr artifact format is data-only; "
				+ "provide a globally registered theme or wait for the remote resolver phase.",
			);
		}
		const resolved = resolveRegisteredEngineTheme(theme.id);
		resolvedCssTheme = {
			...resolved.group,
			...(isThemeRecord(themeRecord.vars)
				? { vars: { ...(resolved.group.vars ?? {}), ...(themeRecord.vars as Record<string, string>) } }
				: {}),
			...(Array.isArray(themeRecord.fonts)
				? { fonts: [...(resolved.group.fonts ?? []), ...(themeRecord.fonts as string[])] }
				: {}),
			...(typeof themeRecord.globalStyles === "string"
				? { globalStyles: themeRecord.globalStyles }
				: {}),
		};
		markdownThemes = resolved.components;
	} else if (theme.scope === "global") {
		// Calling createTheme() registered the group in this module instance.
		// Resolve by root ID so unknown/redefined IDs fail consistently.
		const resolved = resolveRegisteredEngineTheme(theme.id);
		markdownThemes = resolved.components;
	}

	const markdownTheme = markdownThemes.markdown;
	if (!markdownTheme) {
		return resolvedCssTheme === theme ? schema : { ...schema, theme: resolvedCssTheme };
	}

	const resolvedMarkdownTheme = resolveMarkdownThemeDefinition(markdownTheme);
	const hasMarkdownDefaults = Object.keys(resolvedMarkdownTheme.props).length > 0
		|| resolvedMarkdownTheme.styles !== undefined;
	return {
		...schema,
		theme: resolvedCssTheme,
		...(hasMarkdownDefaults
			? { root: applyMarkdownThemeToNode(schema.root, resolvedMarkdownTheme) }
			: {}),
	};
}
