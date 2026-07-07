// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim public API
// ─────────────────────────────────────────────────────────────────────────────

export { EngineManim }      from "./EngineManim";
export { EngineManim3D }    from "./EngineManim3D";

export { compileManimConfig, applyEasing, interpolatePoints } from "./manimCompiler";
export { parseManimDSL }    from "./manimDSLParser";
export { routeAnimation, sampleBoneTrack } from "./manimAnimationRouter";

export type {
	// 2D
	ManimConfig,
	ManimMobject,
	ManimTimelineStep,
	ManimAction,
	ManimEasing,
	ManimCircle,
	ManimSquare,
	ManimRectangle,
	ManimLine,
	ManimPath,
	ManimSettings,
	CompiledManimTimeline,
	// 3D
	Manim3DConfig,
	Manim3DCamera,
	Manim3DLight,
	// DSL
	ManimDSLDocument,
	ManimDSLFrameGroup,
	ManimBoneTransform,
	ManimDSLConstraints,
	// Animation routing
	ManimAnimationRoute,
	ManimBoneOverride,
	ResolvedBoneTrack,
	ResolvedKeyframe,
	RoutedAnimation,
	SampledBoneState,
} from "./manimTypes";

export type { EngineManimProps }   from "./EngineManim";
export type { EngineManim3DProps } from "./EngineManim3D";
