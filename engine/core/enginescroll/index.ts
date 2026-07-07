// ============================================================================
// enginescroll/index.ts — Public barrel
// ============================================================================

// ── Runtime & Entry Point ───────────────────────────────────────────────────
export { EngineScroll }              from "./EngineScroll";
export { EngineScrollRuntime }       from "./EngineScrollRuntime";

// ── React Integration ───────────────────────────────────────────────────────
export {
	EngineScrollProvider,
	useEngineScroll,
} from "./EngineScrollProvider";
export type {
	EngineScrollCtx,
	EngineScrollProviderProps,
}                                    from "./EngineScrollProvider";

// ── Navigation ──────────────────────────────────────────────────────────────
export { EngineScrollNavigator }     from "./EngineScrollNavigator";
export type { EngineScrollTarget }   from "./EngineScrollNavigator";

export { EngineScrollMovement }      from "./EngineScrollMovement";
export { EngineScrollHash }          from "./EngineScrollHash";

// ── URL Protocol ────────────────────────────────────────────────────────────
export { EngineScrollURL }           from "./EngineScrollURL";

// ── Point Registry ──────────────────────────────────────────────────────────
// EngineScrollPointManager is the canonical point store.
// Use it to register named scroll targets from React components.
export { EngineScrollPointManager }  from "./EngineScrollPointManager";
export type { EngineRegisteredPoint } from "./EngineScrollPointManager";

// ── Easing ──────────────────────────────────────────────────────────────────
export { EngineScrollEasing }        from "./EngineScrollEasing";

// ── Types ───────────────────────────────────────────────────────────────────
export type {
	EngineScrollState,
	EngineScrollPoint,
	EngineViewport,
	EnginePage,
	EngineScrollAnimation,
	EngineScrollSubscriber,
}                                    from "./EngineScrollTypes";
