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
import type { PageSchema, EngineConfig } from "./schema/types";
import { EngineProvider } from "./providers/EngineProvider";
import { SchemaRenderer } from "./core/SchemaRenderer";
import { globalStyleCollector, StyleCollector } from "./core/StyleCollector";
import { clearResolverCache } from "./core/resolver";

// ── createPage options ────────────────────────────────────────────────────────

export interface CreatePageOptions {
	/** The page schema definition */
	schema: PageSchema;
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
export function createPage({
	schema,
	config,
	handlers,
	slots,
}: CreatePageOptions): React.FC {
	// Clear resolver cache so CSS vars are re-generated per page
	clearResolverCache();
	globalStyleCollector.reset();

	function EnginePage() {
		return (
			<EngineProvider
				config={config}
				handlers={handlers}
				slots={slots}
				styleCollector={globalStyleCollector}
			>
				{/* Inject theme CSS vars + fonts */}
				<EngineTheme schema={schema} />
				{/* Inject responsive CSS custom properties */}
				<EngineStyles collector={globalStyleCollector} />
				{/* Render the schema tree */}
				<SchemaRenderer schema={schema} />
			</EngineProvider>
		);
	}

	EnginePage.displayName = `EnginePage(${schema.meta?.title ?? "unnamed"})`;
	return EnginePage;
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
