// ─────────────────────────────────────────────────────────────────────────────
// Engine — createPage
// ─────────────────────────────────────────────────────────────────────────────

import React, { type ReactNode } from "react";
import type {
	PageSchema,
	EngineConfig,
	SchemaNode,
	PageMeta,
	MarkdownProps,
	EngineTheme as EngineThemeConfig,
} from "./schema/types";
import { EngineCollectedStyles, EngineProvider } from "./providers/EngineProvider";
import { EngineScrollProvider } from "./core/enginescroll";
import { SchemaRenderer } from "./core/SchemaRenderer";
import {
	compileAdaptiveSchema,
	type EngineAdaptiveDeviceConfig,
} from "./compiler/EngineAdaptiveCompiler";
import { compilePage } from "./compiler/EngineCompiler";
import type { EngineCompiledPage } from "./compiler/types";

export interface EngineCompilerOptions {
	strict?: boolean;
	pageId?: string;
}

interface CreateOptionsBase {
	config?: EngineConfig;
	handlers?: Record<string, (...args: unknown[]) => void>;
	slots?: Record<string, ReactNode>;
	/** Generation 3 phone adaptation. Existing patch arrays remain supported. */
	mobile?: EngineAdaptiveDeviceConfig;
	/** Generation 3 tablet adaptation. Falls back to `mobile` when omitted. */
	tablet?: EngineAdaptiveDeviceConfig;
	compiler?: EngineCompilerOptions;
}

export interface CreateSchemaPageOptions extends CreateOptionsBase {
	schema: PageSchema;
}

export type CreateDirectPageOptions = CreateOptionsBase & PageSchema & {
	schema?: never;
};

export interface CreateMarkdownPageOptions extends CreateOptionsBase {
	schema?: never;
	root?: never;
	title?: string;
	description?: string;
	meta?: PageMeta;
	theme?: EngineThemeConfig;
	filePath: string;
	content?: string;
	markdown?: Omit<MarkdownProps, "content" | "filePath">;
	section?: Record<string, unknown>;
}

export type CreatePageOptions = CreateSchemaPageOptions | CreateDirectPageOptions | CreateMarkdownPageOptions;
export type CreateComponentOptions = CreateSchemaPageOptions | CreateDirectPageOptions;

export interface EngineComponentProps {
	slots?: Record<string, ReactNode>;
	children?: ReactNode;
}

export type EnginePageComponent = (() => ReactNode | Promise<ReactNode>) & {
	/** Base, request-independent Generation 3 compiler plan for dev tooling. */
	enginePlan: EngineCompiledPage;
};

interface NormalizedCreateOptions extends CreateOptionsBase {
	schema: PageSchema;
}

function isSchemaOption(options: CreatePageOptions): options is CreateSchemaPageOptions {
	return "schema" in options && options.schema !== undefined;
}

function isDirectSchemaOption(options: CreatePageOptions): options is CreateDirectPageOptions {
	return "root" in options && options.root !== undefined;
}

function normalizeMarkdownPath(filePath: string): string {
	const cwd = process.cwd().replace(/\\/g, "/").replace(/\/$/, "");
	const normalizedPath = filePath.replace(/\\/g, "/");
	const cwdAliasPrefix = `${cwd}/@/`;
	if (normalizedPath.startsWith("@/")) return `${cwd}/${normalizedPath.slice(2)}`;
	if (normalizedPath.startsWith(cwdAliasPrefix)) return `${cwd}/${normalizedPath.slice(cwdAliasPrefix.length)}`;
	return filePath;
}

function createMarkdownSchema(options: CreateMarkdownPageOptions): PageSchema {
	const { title, description, meta, theme, filePath, content, markdown, section } = options;
	return {
		meta: {
			...(title ? { title } : {}),
			...(description ? { description } : {}),
			...(meta ?? {}),
		},
		theme,
		root: {
			type: "section",
			props: {
				contentMaxWidth: "900px",
				py: { xs: "4rem", md: "6rem" },
				px: { xs: "1.5rem", md: "2rem" },
				...(section ?? {}),
			},
			children: [{
				type: "markdown",
				props: {
					...(markdown ?? {}),
					...(content ? { content } : {}),
					filePath,
				},
			}],
		},
	};
}

function normalizeCreateOptions(options: CreatePageOptions): NormalizedCreateOptions {
	const { config, handlers, slots, mobile, tablet, compiler } = options;
	if (isSchemaOption(options)) return { schema: options.schema, config, handlers, slots, mobile, tablet, compiler };
	if (isDirectSchemaOption(options)) {
		return {
			schema: { meta: options.meta, theme: options.theme, root: options.root },
			config, handlers, slots, mobile, tablet, compiler,
		};
	}
	return {
		schema: createMarkdownSchema(options),
		config, handlers, slots, mobile, tablet, compiler,
	};
}

function nodeHasMarkdownFile(node: SchemaNode): boolean {
	if (node.type === "markdown" && typeof node.props?.filePath === "string") return true;
	return Array.isArray(node.children) ? node.children.some(nodeHasMarkdownFile) : false;
}

async function resolveMarkdownNode(node: SchemaNode): Promise<SchemaNode> {
	const children = Array.isArray(node.children)
		? await Promise.all(node.children.map(resolveMarkdownNode))
		: node.children;
	if (node.type !== "markdown" || typeof node.props?.filePath !== "string") return { ...node, children };
	let content = typeof node.props.content === "string" ? node.props.content : "";
	try {
		const { readFile } = await import("fs/promises");
		content = await readFile(normalizeMarkdownPath(node.props.filePath), "utf8");
	} catch {
		if (!content) content = "# Content coming soon\n\nThis page is ready for Markdown content.";
	}
	return { ...node, props: { ...node.props, content }, children };
}

async function resolveMarkdownFiles(schema: PageSchema): Promise<PageSchema> {
	if (!nodeHasMarkdownFile(schema.root)) return schema;
	return { ...schema, root: await resolveMarkdownNode(schema.root) };
}

function stableThemeHash(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function EngineTheme({ schema }: { schema: PageSchema }) {
	if (!schema.theme) return null;
	const { vars, fonts, globalStyles } = schema.theme;
	let css = "";
	if (vars) {
		const declarations = Object.entries(vars)
			.map(([key, value]) => `  ${key.startsWith("--") ? key : `--${key}`}: ${value};`)
			.join("\n");
		css += `:root {\n${declarations}\n}\n`;
	}
	if (globalStyles) css += globalStyles;
	const themeHref = css ? `engine-theme-${stableThemeHash(css)}` : "";

	return (
		<>
			{fonts?.map((url) => (
				<link key={url} rel="stylesheet" href={url} precedence="engine-font" />
			))}
			{css && (
				<style href={themeHref} precedence="engine-theme">{css}</style>
			)}
		</>
	);
}

export function createPage(options: CreatePageOptions): EnginePageComponent {
	const { schema, config, handlers, slots, mobile, tablet, compiler } = normalizeCreateOptions(options);
	const shouldResolveMarkdown = nodeHasMarkdownFile(schema.root);
	const usesAdaptiveLayout = mobile !== undefined || tablet !== undefined;
	const basePlan = compilePage(schema, {
		pageId: compiler?.pageId,
		strict: compiler?.strict,
	});

	function renderPage(resolvedSchema: PageSchema) {
		return (
			<EngineScrollProvider>
				<EngineProvider config={config} handlers={handlers} slots={slots}>
					<EngineTheme schema={resolvedSchema} />
					<SchemaRenderer schema={resolvedSchema} />
					<EngineCollectedStyles id="__engine_styles__" />
				</EngineProvider>
			</EngineScrollProvider>
		);
	}

	if (shouldResolveMarkdown || usesAdaptiveLayout) {
		async function EnginePage() {
			let resolvedSchema: PageSchema = shouldResolveMarkdown ? await resolveMarkdownFiles(schema) : schema;
			if (usesAdaptiveLayout) {
				const { getServerDevice } = await import("./core/EngineDeviceServer");
				const device = await getServerDevice();
				if (device.isMobile) {
					resolvedSchema = compileAdaptiveSchema(resolvedSchema, "phone", mobile).schema;
				} else if (device.isTablet) {
					resolvedSchema = compileAdaptiveSchema(resolvedSchema, "tablet", tablet ?? mobile).schema;
				}
			}
			return renderPage(resolvedSchema);
		}
		EnginePage.displayName = `EnginePage(${schema.meta?.title ?? "unnamed"})`;
		const compiledPage = EnginePage as EnginePageComponent;
		compiledPage.enginePlan = basePlan;
		return compiledPage;
	}

	function EnginePage() {
		return renderPage(schema);
	}
	EnginePage.displayName = `EnginePage(${schema.meta?.title ?? "unnamed"})`;
	const compiledPage = EnginePage as EnginePageComponent;
	compiledPage.enginePlan = basePlan;
	return compiledPage;
}

export function createComponent(options: CreateComponentOptions): React.FC<EngineComponentProps> {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);
	function EngineComponent({ children, slots: runtimeSlots }: EngineComponentProps) {
		const mergedSlots = {
			...(slots ?? {}),
			...(runtimeSlots ?? {}),
			...(children !== undefined ? { children } : {}),
		};
		return (
			<EngineProvider config={config} handlers={handlers} slots={mergedSlots}>
				<EngineTheme schema={schema} />
				<SchemaRenderer schema={schema} />
				<EngineCollectedStyles />
			</EngineProvider>
		);
	}
	EngineComponent.displayName = `EngineComponent(${schema.meta?.title ?? "unnamed"})`;
	return EngineComponent;
}

export function defineSchema(schema: PageSchema): PageSchema {
	return schema;
}
