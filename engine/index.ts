// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Public API
//  Import everything from "@/engine" (or wherever this lives in your project)
// ─────────────────────────────────────────────────────────────────────────────

// ── Core page factory ─────────────────────────────────────────────────────────
export { createPage, createComponent, defineSchema } from "./createPage";
export type { CreateComponentOptions, CreatePageOptions, EngineComponentProps } from "./createPage";

// ── Default error pages ───────────────────────────────────────────────────────
export { default as DefaultNotFoundPage } from "./not-found";

// ── Schema types ──────────────────────────────────────────────────────────────
export type {
	PageSchema,
	SchemaNode,
	PageMeta,
	EngineTheme,
	EngineConfig,
	NodeType,
	BuiltinNodeType,
	Breakpoint,
	ResponsiveValue,
	CpropValue,
	// Per-node prop types (for typed schema authoring)
	BoxProps,
	StackProps,
	GridProps,
	TextProps,
	TextPart,
	TextVariant,
	MarkdownProps,
	HeadingProps,
	ImageNodeProps,
	ButtonProps,
	ButtonVariant,
	ButtonSize,
	SectionProps,
	CardProps,
	SpacerProps,
	DividerProps,
	EngineScrollProps,
} from "./schema/types";

// ── Component registry ────────────────────────────────────────────────────────
export {
	registerComponent,
	unregisterComponent,
	getComponent,
	hasComponent,
	registeredTypes,
} from "./core/registry";

// ── Individual components (for imperative use outside schema) ─────────────────
export {
	EngineBox,
	EngineStack,
	EngineGrid,
	EngineText,
	EngineHeading,
	EngineSection,
	EngineButton,
	EngineCard,
	EngineSpacer,
	EngineDivider,
} from "./components/primitives";

export { EngineImage }         from "./components/EngineImage";
export { EngineVideo }         from "./components/EngineVideo";
export { EngineCanvas, useEngineCanvas } from "./components/EngineCanvas";
export { LazyMount, LazySection } from "./components/LazyMount";
export { EngineGlobalStyles }  from "./core/StyleCollector";

// ── Scroll system ─────────────────────────────────────────────────────────────
export {
	EngineScroll,
	EngineScrollProvider,
	useEngineScroll,
} from "./components/EngineScroll";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useInView, useImageInView, useSectionInView, useVisibleInView } from "./hooks/useInView";
export { useBreakpoint, useMinBreakpoint, useEngineContext } from "./providers/EngineProvider";

// ── usePropStyles utilities ───────────────────────────────────────────────────
export { cpropClass } from "./hooks/usePropStyles";

// ── Provider (for wrapping sub-trees with custom config) ──────────────────────
export { EngineProvider } from "./providers/EngineProvider";
export type { EngineProviderProps } from "./providers/EngineProvider";

// ── Breakpoint constants ──────────────────────────────────────────────────────
export { BREAKPOINTS, BREAKPOINT_ORDER } from "./schema/types";
