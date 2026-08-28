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
	MobileSchemaConfig,
} from "./schema/types";
import { EngineCollectedStyles, EngineProvider } from "./providers/EngineProvider";
import { EngineScrollProvider } from "./core/enginescroll";
import { SchemaRenderer } from "./core/SchemaRenderer";
import { applyMobilePatches } from "./core/EngineMobilePatcher";

interface CreateOptionsBase {
	config?: EngineConfig;
	handlers?: Record<string, (...args: unknown[]) => void>;
	slots?: Record<string, ReactNode>;
	mobile?: MobileSchemaConfig;
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
	mobile?: MobileSchemaConfig;
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
	const { config, handlers, slots, mobile } = options;

	if (isSchemaOption(options)) {
		return { schema: options.schema, config, handlers, slots, mobile };
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
			mobile,
		};
	}

	return {
		schema: createMarkdownSchema(options),
		config,
		handlers,
		slots,
		mobile,
	};
}

function nodeHasMarkdownFile(node: SchemaNode): boolean {
	if (node.type === "markdown" && typeof node.props?.filePath === "string") return true;
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
		if (!content) content = "# Content coming soon\n\nThis page is ready for Markdown content.";
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

export function createPage(options: CreatePageOptions): EnginePageComponent {
	const { schema, config, handlers, slots, mobile } = normalizeCreateOptions(options);
	const shouldResolveMarkdown = nodeHasMarkdownFile(schema.root);
	const hasMobilePatches = mobile !== undefined && mobile.length > 0;

	function renderPage(resolvedSchema: PageSchema) {
		return (
			<EngineScrollProvider>
				<EngineProvider
					config={config}
					handlers={handlers}
					slots={slots}
				>
					<EngineTheme schema={resolvedSchema} />
					<SchemaRenderer schema={resolvedSchema} />
					<EngineCollectedStyles id="__engine_styles__" />
				</EngineProvider>
			</EngineScrollProvider>
		);
	}

	if (shouldResolveMarkdown || hasMobilePatches) {
		async function EnginePage() {
			let resolvedSchema: PageSchema = shouldResolveMarkdown
				? await resolveMarkdownFiles(schema)
				: schema;

			if (hasMobilePatches) {
				// Keep next/headers and all request-only device logic out of the
				// universal/client graph unless mobile patching is actually enabled.
				const { getServerDevice } = await import("./core/EngineDeviceServer");
				const device = await getServerDevice();
				if (device.isMobile || device.isTablet) {
					resolvedSchema = applyMobilePatches(resolvedSchema, mobile!);
				}
			}

			return renderPage(resolvedSchema);
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

export function createComponent(options: CreateComponentOptions): React.FC<EngineComponentProps> {
	const { schema, config, handlers, slots } = normalizeCreateOptions(options);

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
