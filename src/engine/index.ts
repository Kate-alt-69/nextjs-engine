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
	OptionProps, OptGroupProps, SlotProps,
	EngineLinkProps, EngineLinkConfig,
	EngineSuspenseProps, SuspensePreset,
	EngineHeroProps,
	EngineFormProps, EngineInputProps, EngineTextareaProps, EngineCheckboxProps, EngineLabelProps, InputType,
	EngineAPIConfig, EngineAPIAuthConfig,
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
	EngineOption, EngineOptGroup, EngineSlot,
} from "./components/primitives";
export { EngineLink }                              from "./components/EngineLink";
export { EngineNav, renderEngineAnchor }           from "./components/EngineNav";
export { EngineManim, EngineManim3D }                                       from "./components/EngineManim";
export { compileManimConfig, applyEasing, parseManimDSL, routeAnimation }   from "./components/EngineManim";
export type { ManimConfig, Manim3DConfig, ManimDSLDocument, ManimAnimationRoute, EngineManimProps, EngineManim3DProps } from "./components/EngineManim";
export type { EngineNavProps, EngineNavItem, EngineNavLogo, EngineNavVariant, EngineAnchorConfig } from "./components/EngineNav";
export { EngineImage }                              from "./components/EngineImage";
export { EngineVideo }                              from "./components/EngineVideo";
export { EngineCanvas, useEngineCanvas }            from "./components/EngineCanvas";
export { EngineMarkdown }                           from "./components/EngineMarkdown";
export { EngineHero }                              from "./components/EngineHero";
export { LazyMount, LazySection }                   from "./components/LazyMount";
export { CustomSelect }                             from "./components/CustomSelect";
export { EngineSuspense }                           from "./components/EngineSuspense";
export { EngineForm, EngineInput, EngineTextarea, EngineCheckbox, EngineLabel } from "./components/EngineForms";

// ── Networking ─────────────────────────────────────────────────────────────
export { EngineAPIResolver }                        from "./core/EngineAPIResolver";
export {
	compileAPIConfig,
	loadAPIConfigDir,
	setCompiledAPIConfig,
	getCompiledAPIConfig,
	ensureAPIConfig,
} from "./core/EngineAPIConfigParser";
export type { EngineAPICompiledConfig }             from "./core/EngineAPIConfigParser";

// ── Static analysis ───────────────────────────────────────────────────────────
export { analyzeNode, analyzeSchema, isSchemaValid } from "./core/schemaAnalyzer";
export type { EngineDiagnostic, AnalyzerResult, DiagnosticSeverity } from "./core/schemaAnalyzer";


// ── Scroll system ─────────────────────────────────────────────────────────────
export {
	EngineScroll as EngineScrollComponent, EngineScrollProvider as _OldScrollProvider,
	useEngineScroll as _oldUseEngineScroll,
} from "./components/EngineScroll";
// Re-export the schema component under its original name
// export { EngineScrollComponent as EngineScrollComponent };

// ── EngineScroll core (runtime, navigation, URL protocol) ────────────────────
export {
	EngineScroll,
	EngineScrollProvider,
	useEngineScroll,
	EngineScrollNavigator,
	EngineScrollURL,
	EngineScrollMovement,
	EngineScrollHash,
	EngineScrollPointManager,
	EngineScrollEasing,
}                                from "./core/enginescroll";
export type {
	EngineScrollCtx,
	EngineScrollTarget,
	EngineScrollState,
	EngineScrollPoint,
	EngineRegisteredPoint,
}                                from "./core/enginescroll";

// ── Browser detection + interactions ──────────────────────────────────────────
export { EngineBrowser, useBrowser }                from "./core/EngineBrowser";
export type {
	BrowserInfo, BrowserIs, BrowserSupports, BrowserName,
	RenderingEngine, BrowserConditions,
	// Clipboard subsystem
	BrowserClipboard,
	// Interact subsystem
	BrowserInteract, ShareData, PickFileOptions, OrientationLock,
	// Media subsystem
	BrowserMedia, MediaCameraOptions,
	// Speech subsystem
	BrowserSpeech, SpeakOptions, ListenOptions,
	// Network subsystem
	BrowserNetwork, NetworkStatus, NetworkType,
} from "./core/EngineBrowser";

// ── CSS utilities ─────────────────────────────────────────────────────────────
export { cpropClass, staticClass, mediaClass }                  from "./hooks/usePropStyles";
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
