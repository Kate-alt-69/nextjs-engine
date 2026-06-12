// ─────────────────────────────────────────────────────────────────────────────
//  Next.js Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

// ── Core page factory ──────────────────────────────────────────────────────────
export { createPage, createComponent, defineSchema }            from "./createPage";
export type { CreateComponentOptions, CreatePageOptions, EngineComponentProps } from "./createPage";

// ── Metadata integration (Next.js generateMetadata()) ─────────────────────────
export { generateEngineMetadata }                               from "./core/engineMetadata";

// ── Schema validation ─────────────────────────────────────────────────────────
export { validateSchema, validatePageSchema }                   from "./core/validateSchema";
export type { ValidationError, ValidationResult }               from "./core/validateSchema";

// ── Schema types ──────────────────────────────────────────────────────────────
export type {
	PageSchema, SchemaNode, PageMeta, EngineTheme, EngineConfig,
	NodeType, BuiltinNodeType, Breakpoint, ResponsiveValue,
	CpropValue, SelectOption,
	// Per-node prop types
	BoxProps, StackProps, GridProps, TextProps, TextPart, TextVariant,
	MarkdownProps, HeadingProps, ImageNodeProps, ButtonProps,
	ButtonVariant, ButtonSize, SectionProps, HeroProps, CardProps,
	SpacerProps, DividerProps, EngineScrollProps, CustomSelectProps,
	OptionProps, OptGroupProps,
} from "./schema/types";

// ── Component registry ────────────────────────────────────────────────────────
export {
	registerComponent, unregisterComponent, getComponent,
	hasComponent, registeredTypes,
} from "./core/registry";

// ── Individual components (imperative use outside schema) ─────────────────────
export {
	EngineBox, EngineStack, EngineGrid, EngineText, EngineHeading,
	EngineSection, EngineButton, EngineCard, EngineSpacer, EngineDivider,
	EngineOption, EngineOptGroup,
} from "./components/primitives";
export { EngineImage }                              from "./components/EngineImage";
export { EngineVideo }                              from "./components/EngineVideo";
export { EngineCanvas, useEngineCanvas }            from "./components/EngineCanvas";
export { EngineMarkdown }                           from "./components/EngineMarkdown";
export { EngineHero }                              from "./components/EngineHero";
export type { EngineHeroProps }                    from "./components/EngineHero";
export { LazyMount, LazySection }                   from "./components/LazyMount";
export { CustomSelect }                             from "./components/CustomSelect";
export { EngineSuspense }                           from "./components/EngineSuspense";
export type { EngineSuspenseProps, SuspensePreset } from "./components/EngineSuspense";
export { EngineForm, EngineInput, EngineTextarea, EngineCheckbox, EngineLabel } from "./components/EngineForms";
export type { EngineFormProps, EngineInputProps, EngineTextareaProps, EngineCheckboxProps, EngineLabelProps, InputType } from "./components/EngineForms";


// ── Scroll system ─────────────────────────────────────────────────────────────
export {
	EngineScroll, EngineScrollProvider, useEngineScroll,
} from "./components/EngineScroll";

// ── Browser detection ─────────────────────────────────────────────────────────
export { EngineBrowser, useBrowser }                from "./core/EngineBrowser";
export type {
	BrowserInfo, BrowserIs, BrowserSupports, BrowserName,
	RenderingEngine, BrowserConditions,
} from "./core/EngineBrowser";

// ── CSS utilities ─────────────────────────────────────────────────────────────
export { cpropClass }                               from "./hooks/usePropStyles";
export { EngineGlobalStyles }                       from "./core/StyleCollector";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useInView, useImageInView, useSectionInView, useVisibleInView } from "./hooks/useInView";
export { useBreakpoint, useMinBreakpoint, useEngineContext } from "./providers/EngineProvider";

// ── Provider ──────────────────────────────────────────────────────────────────
export { EngineProvider }                           from "./providers/EngineProvider";
export type { EngineProviderProps }                 from "./providers/EngineProvider";

// ── Default pages ─────────────────────────────────────────────────────────────
export { default as DefaultNotFoundPage }           from "./not-found";

// ── Constants ─────────────────────────────────────────────────────────────────
export { BREAKPOINTS, BREAKPOINT_ORDER }            from "./schema/types";
