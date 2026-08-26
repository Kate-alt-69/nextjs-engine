export type ManimEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "bounce" | "elastic";
export type ManimAction = "Create" | "FadeIn" | "FadeOut" | "Transform" | "Wait" | "MoveTo" | "Scale" | "Rotate";
export interface ManimCircle { id: string; type: "Circle"; radius: number; x?: number; y?: number; strokeColor?: string; fillColor?: string; strokeWidth?: number; }
export interface ManimSquare { id: string; type: "Square"; sideLength: number; x?: number; y?: number; strokeColor?: string; fillColor?: string; strokeWidth?: number; }
export interface ManimRectangle { id: string; type: "Rectangle"; width: number; height: number; x?: number; y?: number; strokeColor?: string; fillColor?: string; strokeWidth?: number; }
export interface ManimLine { id: string; type: "Line"; x1: number; y1: number; x2: number; y2: number; strokeColor?: string; strokeWidth?: number; }
export interface ManimPath { id: string; type: "Path"; d: string; strokeColor?: string; fillColor?: string; strokeWidth?: number; }
export type ManimMobject = ManimCircle | ManimSquare | ManimRectangle | ManimLine | ManimPath;
export interface ManimTimelineStep { action: ManimAction; target?: string; origin?: string; durationMs: number; delay?: number; easing?: ManimEasing; }
export interface ManimSettings { loop?: boolean; fpsLimit?: 30 | 60 | 120; background?: string; }
export interface ManimConfig { mobjects: ManimMobject[]; timeline: ManimTimelineStep[]; settings?: ManimSettings; }
export interface CompiledMobject { id: string; points: Float32Array; pointCount: number; strokeColor: string; fillColor: string; strokeWidth: number; isBezier: boolean; }
export interface CompiledTimelineStep { action: ManimAction; target?: CompiledMobject; origin?: CompiledMobject; durationMs: number; delay: number; easing: ManimEasing; }
export interface CompiledManimTimeline { steps: CompiledTimelineStep[]; mobjectMap: Map<string, CompiledMobject>; settings: Required<ManimSettings>; }
export type Manim3DLightType = "ambient" | "directional" | "point" | "spot";
export interface Manim3DLight { type: Manim3DLightType; color?: string; intensity?: number; position?: [number, number, number]; direction?: [number, number, number]; castShadow?: boolean; }
export interface Manim3DCamera { position?: [number, number, number]; fov?: number; near?: number; far?: number; look?: { content?: string | [number, number, number]; }; focus?: { distance?: number; aperture?: number; }; }
export interface ManimBoneTransform { bone: string; move?: [number, number, number]; rotate?: [number, number, number]; scale?: [number, number, number]; easing?: ManimEasing; }
export interface ManimDSLFrameGroup { frameStart: number; frameEnd: number; transforms: ManimBoneTransform[]; }
export interface ManimDSLConstraints { camera: Manim3DCamera; lights: Manim3DLight[]; }
export interface ManimDSLDocument { frames: ManimDSLFrameGroup[]; constraints: ManimDSLConstraints; }
export type AnimationSource = "file" | "source";
export interface ManimBoneOverride { bone: string; frames: ManimDSLFrameGroup[]; mode: "replace" | "additive"; }
export interface ManimAnimationRoute { clip?: string; source: AnimationSource; overrides?: ManimBoneOverride[]; dsl?: string; speed?: number; }
export interface ResolvedKeyframe { time: number; move?: [number, number, number]; rotate?: [number, number, number]; scale?: [number, number, number]; easing?: string; }
export interface ResolvedBoneTrack { bone: string; keyframes: ResolvedKeyframe[]; mode: "replace" | "additive"; }
export interface RoutedAnimation { clipName?: string; clipSpeed: number; boneTracks: ResolvedBoneTrack[]; }
export interface SampledBoneState { move?: [number, number, number]; rotate?: [number, number, number]; scale?: [number, number, number]; }
export interface Manim3DConfig {
	src: string;
	format?: "gltf" | "glb" | "obj";
	mtlSrc?: string;
	camera?: Manim3DCamera;
	lights?: Manim3DLight[];
	animation?: ManimAnimationRoute;
	settings?: { loop?: boolean; fps?: number; shadows?: boolean; wireframe?: boolean; background?: string; autoRotate?: boolean | number; autoFrame?: boolean; };
}
