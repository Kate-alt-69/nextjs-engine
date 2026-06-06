// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Public API
//  Import everything from "@/engine" (or wherever this lives in your project)
// ─────────────────────────────────────────────────────────────────────────────

// ── Core page factory ─────────────────────────────────────────────────────────
export { createPage, defineSchema } from "./createPage";
export type { CreatePageOptions } from "./createPage";

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
	// Per-node prop types (for typed schema authoring)
	BoxProps,
	StackProps,
	GridProps,
	TextProps,
	TextPart,
	TextVariant,
	HeadingProps,
	ImageNodeProps,
	ButtonProps,
	ButtonVariant,
	ButtonSize,
	SectionProps,
	CardProps,
	SpacerProps,
	DividerProps,
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

export { EngineImage } from "./components/EngineImage";
export { EngineVideo } from "./components/EngineVideo";
export { LazyMount, LazySection } from "./components/LazyMount";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useInView, useImageInView, useSectionInView, useVisibleInView } from "./hooks/useInView";
export { useBreakpoint, useMinBreakpoint, useEngineContext } from "./providers/EngineProvider";

// ── Provider (for wrapping sub-trees with custom config) ──────────────────────
export { EngineProvider } from "./providers/EngineProvider";
export type { EngineProviderProps } from "./providers/EngineProvider";

// ── Breakpoint constants ──────────────────────────────────────────────────────
export { BREAKPOINTS, BREAKPOINT_ORDER } from "./schema/types";
