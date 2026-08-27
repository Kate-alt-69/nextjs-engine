// ============================================================================
// enginescroll/index.ts — Public barrel
// ============================================================================

export { EngineScroll } from "./EngineScroll";
export { EngineScrollRuntime } from "./EngineScrollRuntime";

export {
	EngineScrollProvider,
	useEngineScroll,
} from "./EngineScrollProvider";
export type {
	EngineScrollCtx,
	EngineScrollProviderProps,
} from "./EngineScrollProvider";

export { useEngineScrollTimeline } from "./useEngineScrollTimeline";
export { EngineScrollTimeline } from "./EngineScrollTimeline";
export type {
	EngineScrollTimelineActivityEvent,
	EngineScrollTimelineActivitySubscriber,
	EngineScrollTimelineActivityType,
	EngineScrollTimelineBoundary,
	EngineScrollTimelineConfig,
	EngineScrollTimelineCrossEvent,
	EngineScrollTimelineCrossSubscriber,
	EngineScrollTimelineFrame,
	EngineScrollTimelineSource,
	EngineScrollTimelineSubscriber,
	EngineScrollTimelineTarget,
} from "./EngineScrollTimeline";
export { EngineScrollTimelineTrack } from "./EngineScrollTimelineTrack";
export type { EngineScrollTimelineKeyframe } from "./EngineScrollTimelineTrack";
export { bindEngineScrollTimelineStyles } from "./EngineScrollTimelineBinding";
export type {
	EngineScrollTimelineStyleBinding,
	EngineScrollTimelineStyleBindings,
	EngineScrollTimelineStyleKeyframes,
	EngineScrollTimelineStyleRange,
} from "./EngineScrollTimelineBinding";

export { EngineScrollNavigator } from "./EngineScrollNavigator";
export type {
	EngineScrollNavigationOptions,
	EngineScrollTarget,
} from "./EngineScrollNavigator";

export { EngineScrollMovement } from "./EngineScrollMovement";
export { EngineScrollHash } from "./EngineScrollHash";
export { EngineScrollURL } from "./EngineScrollURL";

export { EngineScrollSnap } from "./EngineScrollSnap";
export type {
	EngineScrollSnapMode,
	EngineScrollSnapOptions,
} from "./EngineScrollSnap";

export { EngineScrollPointManager } from "./EngineScrollPointManager";
export type {
	EngineRegisteredPoint,
	EngineScrollPointGroupInput,
	EngineScrollPointOptions,
	EngineScrollRegisteredPoint,
	EngineScrollResolvedPoint,
} from "./EngineScrollPointManager";

export { EngineScrollEasing } from "./EngineScrollEasing";
export type { EngineScrollEasingFunction } from "./EngineScrollEasing";

export type {
	EnginePage,
	EngineScrollAlignment,
	EngineScrollAnimation,
	EngineScrollDirection,
	EngineScrollEasingName,
	EngineScrollMoveOptions,
	EngineScrollPoint,
	EngineScrollState,
	EngineScrollSubscriber,
	EngineViewport,
} from "./EngineScrollTypes";
