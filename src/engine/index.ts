// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { createPage, createComponent, defineSchema } from "./createPage";
export type {
	CreateComponentOptions,
	CreatePageOptions,
	EngineComponentProps,
	EngineCompilerOptions,
	EnginePageComponent,
} from "./createPage";

// Generation 3 compiler/runtime foundation. Server-only request helpers remain
// in `nextjs-engine/server`; this barrel only exposes browser/server-safe APIs.
export {
	compilePage,
	explainCompiledNode,
	findCompiledNode,
	getEngineRuntimeProfile,
	registerEngineRuntimeProfile,
	resolveNodeRuntime,
	unregisterEngineRuntimeProfile,
} from "./compiler";
export type {
	EngineAssetKind,
	EngineCapability,
	EngineCompileOptions,
	EngineCompiledAsset,
	EngineCompiledNode,
	EngineCompiledPage,
	EngineCompilerDiagnostic,
	EngineCompilerSummary,
	EngineDeviceTarget,
	EngineRuntimeKind,
	EngineRuntimeProfile,
	EngineWorkClass,
} from "./compiler";
export { compileAdaptiveSchema } from "./compiler/EngineAdaptiveCompiler";
export type {
	EngineAdaptiveChange,
	EngineAdaptiveCompileResult,
	EngineAdaptiveDeviceConfig,
	EngineAdaptiveDeviceOptions,
} from "./compiler/EngineAdaptiveCompiler";
export { EngineScheduler } from "./core/enginescheduler";
export type { EngineScheduleListener, EngineSchedulePolicy, EngineScheduleSnapshot } from "./core/enginescheduler";
export { useEngineSchedule, useEngineVisible } from "./hooks/useEngineScheduler";
export type { UseEngineScheduleReturn } from "./hooks/useEngineScheduler";
export { EngineModel } from "./core/EngineModel";
export type { EngineModelAction, EngineModelKeyListener, EngineModelListener, EngineModelState } from "./core/EngineModel";
export { useEngineModel, useEngineModelValue } from "./hooks/useEngineModel";
export { EngineViewport } from "./core/EngineViewport";
export type { EngineViewportSnapshot } from "./core/EngineViewport";
export { useEngineViewport } from "./hooks/useEngineViewport";

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
	EngineSuspenseProps, SuspensePreset,
	EngineHeroProps,
	EngineFormProps, EngineInputProps, EngineTextareaProps, EngineCheckboxProps, EngineLabelProps, InputType,
} from "./schema/types";
export type { EngineShaderSurfaceProps } from "./schema/EngineShaderSchemaTypes";
export type { EngineScrollPointSchemaProps } from "./schema/EngineScrollSchema";

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
export type { EngineLinkConfig, EngineLinkProps } from "./components/EngineLink";
export { EngineNav, renderEngineAnchor } from "./components/EngineNav";
export { EngineTransitionLink } from "./components/EngineTransitionLink";
export type { EngineTransitionLinkProps } from "./components/EngineTransitionLink";
export {
	ENGINE_TRANSITIONS,
	isKnownEngineTransition,
	navigateWithEngineTransition,
	normalizeEngineTransitionType,
	resolveEngineTransition,
	runEngineTransition,
	useEngineTransitions,
} from "./core/enginetransitions";
export type {
	EngineTransitionAlias,
	EngineTransitionAxis,
	EngineTransitionConfig,
	EngineTransitionDirection,
	EngineTransitionEasing,
	EngineTransitionInput,
	EngineTransitionName,
	EngineTransitionOptions,
	EngineTransitionPointer,
	EngineTransitionRunContext,
	EngineTransitionShape,
	EngineTransitionsController,
	ResolvedEngineTransition,
} from "./core/enginetransitions";
export { EngineManim, EngineManim3D } from "./components/EngineManim";
export { compileManimConfig, applyEasing, parseManimDSL, routeAnimation } from "./components/EngineManim";
export type { ManimConfig, Manim3DConfig, ManimDSLDocument, ManimAnimationRoute, EngineManimProps, EngineManim3DProps } from "./components/EngineManim";
export type { EngineNavProps, EngineNavItem, EngineNavLogo, EngineNavVariant, EngineAnchorConfig } from "./components/EngineNav";
export { EngineImage } from "./components/EngineImage";
export { EngineVideo } from "./components/EngineVideo";
export { EngineCanvas, useEngineCanvas } from "./components/EngineCanvas";
export type { EngineCanvasFrameInfo, EngineCanvasProps } from "./components/EngineCanvas";
export { EngineShader } from "./components/EngineShader";
export type { EngineShaderProps } from "./components/EngineShader";
export {
	EngineShaderScheduler,
	clearEngineShaderCache,
	loadEngineShader,
	normalizeEngineShaderName,
} from "./core/engineshader";
export type {
	EngineShaderConfig,
	EngineShaderExecution,
	EngineShaderInput,
	EngineShaderManifest,
	EngineShaderManifestEntry,
	EngineShaderRenderPlan,
	EngineShaderVariableDefinition,
	EngineShaderVariableValue,
} from "./core/engineshader";

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
export { EngineDialog, EngineDrawer, EnginePopover } from "./components/EngineOverlay";
export type {
	EngineDialogProps,
	EngineDrawerProps,
	EngineOverlayAction,
	EngineOverlayActionVariant,
	EngineOverlayCommonProps,
	EngineOverlayOpenChange,
	EnginePopoverProps,
} from "./components/EngineOverlay";
export {
	computePopoverPosition,
	getFocusableElements,
	isTopOverlay,
	lockBodyScroll,
	registerOverlay,
} from "./core/engineoverlay";
export type {
	EnginePopoverAlign,
	EnginePopoverPlacement,
	OverlayRect,
	PopoverPosition,
	PopoverPositionOptions,
} from "./core/engineoverlay";

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
	APIStaticEndpointInfo,
	APIStaticEndpointManifestEntry,
	APIStaticExecuteOptions,
	APIStaticInputSchema,
	APIStaticManifest,
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
	useEngineScrollTimeline,
	EngineScrollRange,
	EngineScrollDirector,
	EngineScrollTimeline,
	EngineScrollTimelineTrack,
	bindEngineScrollTimelineStyles,
	EngineScrollNavigator,
	EngineScrollURL,
	EngineScrollMovement,
	EngineScrollHash,
	EngineScrollSnap,
	EngineScrollPointManager,
	EngineScrollPointTracker,
	EngineScrollEasing,
} from "./core/enginescroll";
export type {
	EngineScrollCtx,
	EngineScrollTarget,
	EngineScrollNavigationOptions,
	EngineScrollState,
	EngineScrollPoint,
	EngineRegisteredPoint,
	EngineScrollPointGroupInput,
	EngineScrollPointLocation,
	EngineScrollPointOptions,
	EngineScrollRegisteredPoint,
	EngineScrollResolvedPoint,
	EngineScrollPointChangeSubscriber,
	EngineScrollPointTrackerConfig,
	EngineScrollPointTrackerFrame,
	EngineScrollPointTrackerSource,
	EngineScrollPointTrackerSubscriber,
	EngineScrollRangeConfig,
	EngineScrollRangeSnapshot,
	EngineScrollRangeTarget,
	EngineScrollDirectorConfig,
	EngineScrollDirectorFrame,
	EngineScrollDirectorName,
	EngineScrollDirectorSubscriber,
	EngineScrollDirectorTimelineFrames,
	EngineScrollAlignment,
	EngineScrollDirection,
	EngineScrollEasingName,
	EngineScrollMoveOptions,
	EngineScrollSnapMode,
	EngineScrollSnapOptions,
	EngineScrollTimelineActivityEvent,
	EngineScrollTimelineActivitySubscriber,
	EngineScrollTimelineActivityType,
	EngineScrollTimelineBoundary,
	EngineScrollTimelineConfig,
	EngineScrollTimelineCrossEvent,
	EngineScrollTimelineCrossSubscriber,
	EngineScrollTimelineFrame,
	EngineScrollTimelineFrameSource,
	EngineScrollTimelineKeyframe,
	EngineScrollTimelineSource,
	EngineScrollTimelineStyleBinding,
	EngineScrollTimelineStyleBindings,
	EngineScrollTimelineStyleKeyframes,
	EngineScrollTimelineStyleRange,
	EngineScrollTimelineSubscriber,
	EngineScrollTimelineTarget,
} from "./core/enginescroll";

export { EngineBrowser, useBrowser } from "./core/EngineBrowserSafe";
export type {
	BrowserInfo, BrowserIs, BrowserSupports, BrowserName,
	RenderingEngine, BrowserConditions,
	BrowserClipboard,
	BrowserInteract, ShareData, PickFileOptions, OrientationLock,
	BrowserMedia, MediaCameraOptions,
	BrowserSpeech, SpeakOptions, ListenOptions, BrowserNetwork,
	NetworkStatus, NetworkType,
} from "./core/EngineBrowserSafe";

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
