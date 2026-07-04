// ============================================================================
// enginecanvas/index.ts — EngineCanvas V2 graphics runtime public barrel
// ============================================================================

// ── Graphics model types ─────────────────────────────────────────────────────
export type {
	ECVector2,
	ECVector3,
	ECBounds,
	ECMaterial,
	ECShadingMode,
	ECTransform,
	ECCamera,
	ECMesh,
	ECGroup,
	ECNode,
	ECScene,
	ECEnvironment,
} from "./ECTypes";

// ── Graphics model factories ─────────────────────────────────────────────────
export {
	ecVec2,
	ecVec3,
	ecTransform,
	ecMaterial,
	ecCircle,
	ecRect,
	ecPath,
	ecLine,
	ecPolygon,
	ecGroup,
	ecScene,
	ecVoidEnvironment,
} from "./ECGraphicsModel";

// ── Rendering engine contract ────────────────────────────────────────────────
export type { RenderingEngine, ECRenderContext } from "./RenderingEngine";

// ── Rendering engines ─────────────────────────────────────────────────────────
export { Engine2D }         from "./Engine2D";
export { Engine3D }         from "./Engine3D";
export { EngineSVGEngine, importSVG, exportSVG } from "./EngineSVG";
export { EngineSkiaEngine } from "./EngineSkia";

// ── Registry ──────────────────────────────────────────────────────────────────
export {
	createRenderingEngine,
	registerRenderingEngine,
	hasRenderingEngine,
} from "./ECEngineRegistry";
