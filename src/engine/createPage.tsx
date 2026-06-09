// ─────────────────────────────────────────────────────────────────────────────
//  Engine — createPage
//
//  The main entry point for defining pages with the engine.
//  Returns a standard Next.js page component (works with both App Router
//  and Pages Router) that wraps the schema in the EngineProvider and
//  injects a CSS <style> tag containing all collected CSS variable blocks.
//
//  Usage (App Router — app/page.tsx):
//
//    import { createPage } from "@/engine";
//
//    export default createPage({
//      meta: { title: "Home" },
//      root: {
//        type: "section",
//        children: [
//          { type: "heading", props: { level: 1, content: "Hello World" } },
//          {
//            type: "image",
//            props: { src: "/hero.jpg", alt: "Hero", width: 1920, height: 1080, priority: true }
//          },
//          {
//            type: "video",
//            props: { src: "/intro.mp4", poster: "/intro-thumb.jpg" }
//          },
//        ],
//      },
//    });
//
//  Usage (Pages Router — pages/index.tsx):
//
//    export default createPage({ … });
//    export const getStaticProps = async () => ({ props: {} });
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
		// Dynamic import keeps webpack from statically bundling "fs/promises"
		// into the client build. This branch only runs inside the async server
		// component (EnginePage), never on the client.
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

/**
 * Renders a <style> tag containing all CSS custom-property blocks
 * collected during the render pass.
 *
 * Must be rendered BEFORE the schema tree so that browsers don't see
 * a flash of unstyled content.
 */
function EngineStyles({ collector }: { collector: StyleCollector }) {
	const css = collector.collect();
	if (!css) return null;
	// biome-ignore lint/security/noDangerouslySetInnerHtml: controlled CSS generation
	return <style id="__engine_styles__" dangerouslySetInnerHTML={{ __html: css }} />;
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
				// biome-ignore lint/security/noDangerouslySetInnerHtml: controlled CSS generation
				<style id="__engine_theme__" dangerouslySetInnerHTML={{ __html: css }} />
			)}
		</>
	);
}

// ── Page head ─────────────────────────────────────────────────────────────────

function EngineHead({ schema }: { schema: PageSchema }) {
	const meta = schema.meta;
	if (!meta) return null;

	// App Router: this component is used inside layout.tsx with <head> tag
	// Pages Router: wrap in next/head
	return (
		<>
			{meta.title && <title>{meta.title}</title>}
			{meta.description && <meta name="description" content={meta.description} />}
			{meta.keywords && (
				<meta name="keywords" content={meta.keywords.join(", ")} />
			)}
			{meta.noIndex && <meta name="robots" content="noindex,nofollow" />}
			{meta.canonical && <link rel="canonical" href={meta.canonical} />}
			{meta.ogTitle && <meta property="og:title" content={meta.ogTitle} />}
			{meta.ogDescription && <meta property="og:description" content={meta.ogDescription} />}
			{meta.ogImage && <meta property="og:image" content={meta.ogImage} />}
			{meta.twitterCard && <meta name="twitter:card" content={meta.twitterCard} />}
			<meta
				name="viewport"
				content={meta.viewport ?? "width=device-width, initial-scale=1, viewport-fit=cover"}
			/>
		</>
	);
}

// ── createPage ────────────────────────────────────────────────────────────────

/**
 * Creates a fully optimised Next.js page component from a schema definition.
 *
 * The returned component:
 *   · Is a valid default export for both App Router and Pages Router
 *   · Injects a <style> tag with all responsive CSS variable blocks
 *   · Injects theme CSS custom properties
 *   · Wraps everything in EngineProvider
 *   · Lazily mounts heavy sections/images/videos via IntersectionObserver
 *   · Uses content-visibility: auto for off-screen sections
 *   · Never re-renders on viewport resize (CSS handles all responsive layout)
 */
export function createPage(options: CreatePageOptions): EnginePageComponent {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);
	const shouldResolveMarkdown = nodeHasMarkdownFile(schema.root);

	// Clear resolver cache so CSS vars are re-generated per page
	clearResolverCache();
	globalStyleCollector.reset();
	// BUG-001 FIX: reset cross-render tier registry in dev so hydration CSS is always
	// generated from a cold counter, matching the fresh client-side counter exactly.
	if (process.env.NODE_ENV !== "production") StyleCollector._resetRegistry();

	function renderPage(resolvedSchema: PageSchema) {
		return (
			<EngineProvider
				config={config}
				handlers={handlers}
				slots={slots}
			>
				{/* Inject theme CSS vars + fonts */}
				<EngineTheme schema={resolvedSchema} />
				{/* Inject responsive CSS custom properties */}
				<EngineStyles collector={globalStyleCollector} />
				{/* Render the schema tree */}
				<SchemaRenderer schema={resolvedSchema} />
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

/**
 * Creates a reusable engine-rendered component from a schema definition.
 *
 * Unlike createPage, the returned component accepts runtime slots. Its
 * children are also exposed to the schema as a slot named "children".
 */
export function createComponent(options: CreateComponentOptions): React.FC<EngineComponentProps> {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);

	clearResolverCache();
	globalStyleCollector.reset();
	// BUG-001 FIX: reset cross-render tier registry in dev so hydration CSS is always
	// generated from a cold counter, matching the fresh client-side counter exactly.
	if (process.env.NODE_ENV !== "production") StyleCollector._resetRegistry();

	function EngineComponent({ children, slots: runtimeSlots }: EngineComponentProps) {
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
				<EngineStyles collector={globalStyleCollector} />
				<SchemaRenderer schema={schema} />
			</EngineProvider>
		);
	}

	EngineComponent.displayName = `EngineComponent(${schema.meta?.title ?? "unnamed"})`;
	return EngineComponent;
}

// ── Convenience: define a schema without creating the page yet ────────────────

/**
 * Type-safe schema definition helper.
 * Useful when you want to define schemas in separate files and pass them to createPage later.
 *
 * @example
 * // home.schema.ts
 * export const HomeSchema = defineSchema({ … });
 *
 * // app/page.tsx
 * export default createPage({ schema: HomeSchema });
 */
export function defineSchema(schema: PageSchema): PageSchema {
	return schema;
}
