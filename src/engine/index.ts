// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { createPage, createComponent, defineSchema } from "./createPage";
export type { CreateComponentOptions, CreatePageOptions, EngineComponentProps } from "./createPage";

export { generateEngineMetadata } from "./core/engineMetadata";

export { validateSchema, validatePageSchema } from "./core/validateSchema";
export type { ValidationError, ValidationResult } from "./core/validateSchema";

export type {
	PageSchema, SchemaNode, PageMeta, EngineTheme, EngineConfig,
	NodeType, BuiltinNodeType, Breakpoint, ResponsiveValue,
	CpropValue, SelectOption,
	BoxProps, StackProps, GridProps, TextProps, TextPart, TextVariant,
	MarkdownProps, HeadingProps, ImageNodeProps, ButtonProps,
	ButtonVariant, ButtonSize, SectionProps, HeroProps, CardProps,
	SpacerProps, DividerProps, EngineScrollProps, CustomSelectProps,
	OptionProps, OptGroupProps, SlotProps,
	EngineLinkProps, EngineLinkConfig,
	EngineSuspenseProps, SuspensePreset,
	EngineHeroProps,
	EngineFormProps, EngineInputProps, EngineTextareaProps, EngineCheckboxProps, EngineLabelProps, InputType,
} from "./schema/types";

export {
	registerComponent, unregisterComponent, getComponent,
	hasComponent, registeredTypes,
} from "./core/registry";

export {
	EngineBox, EngineStack, EngineGrid, EngineText, EngineHeading,
	EngineSection, EngineButton, EngineCard, EngineSpacer, EngineDivider,
	EngineOption, EngineOptGroup, EngineSlot,
} from "./components/primitives";
export { EngineLink } from "./components/EngineLink";
export { EngineNav, renderEngineAnchor } from "./components/EngineNav";
export { EngineManim, EngineManim3D } from "./components/EngineManim";
export { compileManimConfig, applyEasing, parseManimDSL, routeAnimation } from "./components/EngineManim";
export type { ManimConfig, Manim3DConfig, ManimDSLDocument, ManimAnimationRoute, EngineManimProps, EngineManim3DProps } from "./components/EngineManim";
export type { EngineNavProps, EngineNavItem, EngineNavLogo, EngineNavVariant, EngineAnchorConfig } from "./components/EngineNav";
export { EngineImage } from "./components/EngineImage";
export { EngineVideo } from "./components/EngineVideo";
export { EngineCanvas, useEngineCanvas } from "./components/EngineCanvas";

export {
	ecVec2, ecVec3, ecTransform, ecMaterial,
	ecCircle, ecRect, ecPath, ecLine, ecPolygon,
	ecGroup, ecScene, ecVoidEnvironment,
	Engine2D, Engine3D, EngineSVGEngine, EngineSkiaEngine,
	importSVG, exportSVG,
	createRenderingEngine, registerRenderingEngine, hasRenderingEngine,
} from "./core/enginecanvas";
export type {
	ECVector2, ECVector3, ECBounds, ECMaterial, ECShadingMode,
	ECTransform, ECCamera, ECMesh, ECGroup, ECNode, ECScene, ECEnvironment,
	RenderingEngine as ECRenderingEngine, ECRenderContext,
} from "./core/enginecanvas";
export { EngineMarkdown } from "./components/EngineMarkdown";
export { EngineHero } from "./components/EngineHero";
export { LazyMount, LazySection } from "./components/LazyMount";
export { CustomSelect } from "./components/CustomSelect";
export { EngineSuspense } from "./components/EngineSuspense";
export { EngineForm, EngineInput, EngineTextarea, EngineCheckbox, EngineLabel } from "./components/EngineForms";

// Networking. File/config loading helpers should be called in server/build paths.
export { EngineAPIResolver } from "./core/EngineAPIResolver";
export type {
	EngineAPIAuthConfig,
	EngineAPIConfig,
	EngineAPIFormData,
	EngineAPIStaticEndpoint,
} from "./core/EngineAPIResolver";
export {
	APIStatic,
	configureAPIStatic,
	getDefaultAPIStatic,
	getAPIStaticRouteHash,
	getAPIStaticRouteURL,
	normalizeAPIStaticRoute,
	staticEndpoint,
} from "./core/APIStatic";
export type {
	APIStaticExecuteOptions,
	APIStaticInputSchema,
	APIStaticOperation,
	APIStaticOptions,
	APIStaticProxyHandler,
	APIStaticResponseDescriptor,
	APIStaticRouteModule,
	APIStaticRunContext,
	APIStaticRunSource,
} from "./core/APIStatic";
export {
	compileAPIConfig,
	loadAPIConfigDir,
	setCompiledAPIConfig,
	getCompiledAPIConfig,
	ensureAPIConfig,
} from "./core/EngineAPIConfigParser";
export type { EngineAPICompiledConfig } from "./core/EngineAPIConfigParser";

export { analyzeNode, analyzeSchema, isSchemaValid } from "./core/schemaAnalyzer";
export type { EngineDiagnostic, AnalyzerResult, DiagnosticSeverity } from "./core/schemaAnalyzer";

export {
	EngineScroll as EngineScrollComponent, EngineScrollProvider as _OldScrollProvider,
	useEngineScroll as _oldUseEngineScroll,
} from "./components/EngineScroll";

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
} from "./core/enginescroll";
export type {
	EngineScrollCtx,
	EngineScrollTarget,
	EngineScrollState,
	EngineScrollPoint,
	EngineRegisteredPoint,
} from "./core/enginescroll";

export { EngineBrowser, useBrowser } from "./core/EngineBrowser";
export type {
	BrowserInfo, BrowserIs, BrowserSupports, BrowserName,
	RenderingEngine, BrowserConditions,
	BrowserClipboard,
	BrowserInteract, ShareData, PickFileOptions, OrientationLock,
	BrowserMedia, MediaCameraOptions,
	BrowserSpeech, SpeakOptions, ListenOptions,
	BrowserNetwork, NetworkStatus, NetworkType,
} from "./core/EngineBrowser";

// Device detection. Request-aware helpers such as getServerDevice live in the
// server-only entrypoint (`nextjs-engine/server` in the package build).
export { detectDevice } from "./core/EngineDeviceShared";
export type { DeviceBrand, DeviceInfo, DeviceOS } from "./core/EngineDeviceShared";
export { useMobileDevice } from "./core/EngineDevice";

export { cpropClass, staticClass, mediaClass } from "./hooks/usePropStyles";
export { EngineGlobalStyles } from "./core/StyleCollector";

export { useInView, useImageInView, useSectionInView, useVisibleInView } from "./hooks/useInView";
export { useBreakpoint, useMinBreakpoint, useEngineContext } from "./providers/EngineProvider";

export { EngineProvider } from "./providers/EngineProvider";
export type { EngineProviderProps } from "./providers/EngineProvider";

export { default as DefaultNotFoundPage } from "./not-found";

export { BREAKPOINTS, BREAKPOINT_ORDER } from "./schema/types";
