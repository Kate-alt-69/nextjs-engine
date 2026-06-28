// ============================================================================
// enginescroll/index.ts — Public barrel
// ============================================================================

export { EngineScroll }          from "./EngineScroll";
export { EngineScrollNavigator } from "./EngineScrollNavigator";
export { EngineScrollURL }       from "./EngineScrollURL";
export { EngineScrollRuntime }   from "./EngineScrollRuntime";

export {
	EngineScrollProvider,
	useEngineScroll,
} from "./EngineScrollProvider";

export type { EngineScrollCtx, EngineScrollProviderProps } from "./EngineScrollProvider";
export type { EngineScrollTarget }                         from "./EngineScrollNavigator";

export type {
	EngineScrollState,
	EngineScrollPoint,
	EngineViewport,
	EnginePage,
	EngineScrollAnimation,
} from "./EngineScrollTypes";