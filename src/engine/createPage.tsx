// ─────────────────────────────────────────────────────────────────────────────
//	Engine — createPage
//
//	The main entry point for defining pages with the engine.
//	Returns a standard Next.js page component (works with both App Router
//	and Pages Router) that wraps the schema in the EngineProvider and
//	injects a CSS <style> tag containing all collected CSS variable blocks.
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
import { EngineProvider } from "./providers/EngineProvider";
import { SchemaRenderer } from "./core/SchemaRenderer";
import { globalStyleCollector, StyleCollector } from "./core/StyleCollector";
import { clearResolverCache } from "./core/resolver";

// ── createPage options ────────────────────────────────────────────────────────

interface CreateOptionsBase {
	/** Engine configuration overrides */
	config?: EngineConfig;
	/**
	 * Named event handlers available to nodes via props.onClick = "handlerName".
	 * These are provided at the call site so they can close over React state.
	 */
	handlers?: Record<string, (...args: unknown[]) => void>;
	/**
	 * Named slot content — React nodes that can be injected into the schema
	 * tree via { type: "slot", props: { name: "mySlot" } } nodes.
	 */
	slots?: Record<string, ReactNode>;
}

export interface CreateSchemaPageOptions extends CreateOptionsBase {
	/** The page schema definition */
	schema: PageSchema;
}

export type CreateDirectPageOptions = CreateOptionsBase & PageSchema & {
	schema?: never;
};

export interface CreateMarkdownPageOptions extends CreateOptionsBase {
	schema?: never;
	root?: never;
	/** Shorthand page title used as meta.title when meta.title is omitted. */
	title?: string;
	/** Shorthand page description used as meta.description when meta.description is omitted. */
	description?: string;
	/** Optional full metadata object. Values here take precedence over title/description. */
	meta?: PageMeta;
	/** Optional theme applied to the generated markdown page schema. */
	theme?: EngineThemeConfig;
	/** Local markdown file path. Supports absolute paths, relative paths, and "@/..." paths. */
	filePath: string;
	/** Fallback markdown content used only if filePath cannot be read. */
	content?: string;
	/** Props forwarded to the generated markdown node. */
	markdown?: Omit<MarkdownProps, "content" | "filePath">;
	/** Props forwarded to the generated section wrapper. */
	section?: Record<string, unknown>;
}

export type CreatePageOptions =
	| CreateSchemaPageOptions
	| CreateDirectPageOptions
	| CreateMarkdownPageOptions;

export type CreateComponentOptions = CreateSchemaPageOptions | CreateDirectPageOptions;

export interface EngineComponentProps {
	slots?: Record<string, ReactNode>;
	children?: ReactNode;
}

type EnginePageComponent = () => ReactNode | Promise<ReactNode>;

interface NormalizedCreateOptions extends CreateOptionsBase {
	schema: PageSchema;
}

// ── createPage option normalizer ─────────────────────────────────────────────

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

	if (normalizedPath.startsWith("@/")) {
		return `${cwd}/${normalizedPath.slice(2)}`;
	}

	if (normalizedPath.startsWith(cwdAliasPrefix)) {
		return `${cwd}/${normalizedPath.slice(cwdAliasPrefix.length)}`;
	}

	return filePath;
}

function createMarkdownSchema(options: CreateMarkdownPageOptions): PageSchema {
	const {
		title,
		description,
		meta,
		theme,
		filePath,
		content,
		markdown,
		section,
	} = options;

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
			children: [
				{
					type: "markdown",
					props: {
						...(markdown ?? {}),
						...(content ? { content } : {}),
						filePath,
					},
				},
			],
		},
	};
}

function normalizeCreateOptions(options: CreatePageOptions): NormalizedCreateOptions {
	const { config, handlers, slots } = options;

	if (isSchemaOption(options)) {
		return { schema: options.schema, config, handlers, slots };
	}

	if (isDirectSchemaOption(options)) {
		return {
			schema: {
				meta: options.meta,
				theme: options.theme,
				root: options.root,
			},
			config,
			handlers,
			slots,
		};
	}

	return {
		schema: createMarkdownSchema(options),
		config,
		handlers,
		slots,
	};
}

// ── Markdown file resolver ───────────────────────────────────────────────────

function nodeHasMarkdownFile(node: SchemaNode): boolean {
	if (node.type === "markdown" && typeof node.props?.filePath === "string") {
		return true;
	}

	return Array.isArray(node.children)
		? node.children.some(nodeHasMarkdownFile)
		: false;
}

async function resolveMarkdownNode(node: SchemaNode): Promise<SchemaNode> {
	const children = Array.isArray(node.children)
		? await Promise.all(node.children.map(resolveMarkdownNode))
		: node.children;

	if (node.type !== "markdown" || typeof node.props?.filePath !== "string") {
		return { ...node, children };
	}

	let content = typeof node.props.content === "string" ? node.props.content : "";

	try {
		const { readFile } = await import("fs/promises");
		content = await readFile(normalizeMarkdownPath(node.props.filePath), "utf8");
	} catch {
		if (!content) {
			content = "# Content coming soon\n\nThis page is ready for Markdown content.";
		}
	}

	return {
		...node,
		props: { ...node.props, content },
		children,
	};
}

async function resolveMarkdownFiles(schema: PageSchema): Promise<PageSchema> {
	if (!nodeHasMarkdownFile(schema.root)) return schema;

	return {
		...schema,
		root: await resolveMarkdownNode(schema.root),
	};
}

// ── Style injector component ──────────────────────────────────────────────────

function EngineStyles({ collector }: { collector: StyleCollector }) {
	const css = collector.collect();
	if (!css) return null;

	// React 19 + Next.js App Router: `precedence` hoists this <style> tag to
	// <head> so CSS is available before the browser paints any content.
	// Without this, SSG (Netlify / static export) renders content first and
	// the CSS vars are undefined → layout collapses until the tag is parsed.
	//
	// `href` must be unique per-render so React doesn't deduplicate across
	// navigations and drop styles. We hash the content for a stable key.
	//
	// Note: biome suppression below is intentional — style tag content is
	// engine-controlled CSS, not user input.

	// biome-ignore lint/security/noDangerouslySetInnerHtml: engine-generated CSS
	return (
		<style
			id="__engine_styles__"
			precedence="default"
			dangerouslySetInnerHTML={{ __html: css }}
		/>
	);
}

// ── Theme injector ────────────────────────────────────────────────────────────

function EngineTheme({ schema }: { schema: PageSchema }) {
	if (!schema.theme) return null;

	const { vars, fonts, globalStyles } = schema.theme;
	let css = "";

	if (vars) {
		const declarations = Object.entries(vars)
			.map(([k, v]) => `  ${k.startsWith("--") ? k : `--${k}`}: ${v};`)
			.join("\n");
		css += `:root {\n${declarations}\n}\n`;
	}

	if (globalStyles) {
		css += globalStyles;
	}

	return (
		<>
			{fonts?.map((url) => (
				<link key={url} rel="stylesheet" href={url} />
			))}
			{css && (
				<style id="__engine_theme__" dangerouslySetInnerHTML={{ __html: css }} />
			)}
		</>
	);
}

// ── createPage ────────────────────────────────────────────────────────────────

export function createPage(options: CreatePageOptions): EnginePageComponent {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);
	const shouldResolveMarkdown = nodeHasMarkdownFile(schema.root);

	function renderPage(resolvedSchema: PageSchema) {
		// HARD RESOLUTION PREPARATION PHASE (BUG-001):
		// Must clear styles dynamically per-render request execution path,
		// never during base startup module resolution phase.
		clearResolverCache();
		globalStyleCollector.reset();

		return (
			<EngineProvider
				config={config}
				handlers={handlers}
				slots={slots}
			>
				<EngineTheme schema={resolvedSchema} />
				<SchemaRenderer schema={resolvedSchema} />
				<EngineStyles collector={globalStyleCollector} />
			</EngineProvider>
		);
	}

	if (shouldResolveMarkdown) {
		async function EnginePage() {
			return renderPage(await resolveMarkdownFiles(schema));
		}
		EnginePage.displayName = `EnginePage(${schema.meta?.title ?? "unnamed"})`;
		return EnginePage;
	}

	function EnginePage() {
		return renderPage(schema);
	}

	EnginePage.displayName = `EnginePage(${schema.meta?.title ?? "unnamed"})`;
	return EnginePage;
}

// ── createComponent ──────────────────────────────────────────────────────────

export function createComponent(options: CreateComponentOptions): React.FC<EngineComponentProps> {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);

	function EngineComponent({ children, slots: runtimeSlots }: EngineComponentProps) {
		// Isolate dynamic styles during runtime child execution threads
		clearResolverCache();
		globalStyleCollector.reset();

		const mergedSlots = {
			...(slots ?? {}),
			...(runtimeSlots ?? {}),
			...(children !== undefined ? { children } : {}),
		};

		return (
			<EngineProvider
				config={config}
				handlers={handlers}
				slots={mergedSlots}
			>
				<EngineTheme schema={schema} />
				<SchemaRenderer schema={schema} />
				<EngineStyles collector={globalStyleCollector} />
			</EngineProvider>
		);
	}

	EngineComponent.displayName = `EngineComponent(${schema.meta?.title ?? "unnamed"})`;
	return EngineComponent;
}

export function defineSchema(schema: PageSchema): PageSchema {
	return schema;
}