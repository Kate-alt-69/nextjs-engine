// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim types
//  Shared types for 2D (manimCompiler) and 3D (EngineManim3D) systems.
// ─────────────────────────────────────────────────────────────────────────────

// ── 2D ───────────────────────────────────────────────────────────────────────

export type ManimEasing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "bounce"
	| "elastic";

export type ManimAction =
	| "Create"
	| "FadeIn"
	| "FadeOut"
	| "Transform"
	| "Wait"
	| "MoveTo"
	| "Scale"
	| "Rotate";

export interface ManimCircle {
	id:           string;
	type:         "Circle";
	radius:       number;
	x?:           number;
	y?:           number;
	strokeColor?: string;
	fillColor?:   string;
	strokeWidth?: number;
}

export interface ManimSquare {
	id:           string;
	type:         "Square";
	sideLength:   number;
	x?:           number;
	y?:           number;
	strokeColor?: string;
	fillColor?:   string;
	strokeWidth?: number;
}

export interface ManimRectangle {
	id:           string;
	type:         "Rectangle";
	width:        number;
	height:       number;
	x?:           number;
	y?:           number;
	strokeColor?: string;
	fillColor?:   string;
	strokeWidth?: number;
}

export interface ManimLine {
	id:           string;
	type:         "Line";
	x1:           number;
	y1:           number;
	x2:           number;
	y2:           number;
	strokeColor?: string;
	strokeWidth?: number;
}

export interface ManimPath {
	id:           string;
	type:         "Path";
	/** SVG-style path data: "M 0 0 L 100 100 C ..." */
	d:            string;
	strokeColor?: string;
	fillColor?:   string;
	strokeWidth?: number;
}

export type ManimMobject =
	| ManimCircle
	| ManimSquare
	| ManimRectangle
	| ManimLine
	| ManimPath;

export interface ManimTimelineStep {
	action:      ManimAction;
	/** Target mobject id */
	target?:     string;
	/** Source mobject id — only for Transform */
	origin?:     string;
	durationMs:  number;
	delay?:      number;
	easing?:     ManimEasing;
}

export interface ManimSettings {
	loop?:     boolean;
	fpsLimit?: 30 | 60 | 120;
	background?: string;
}

export interface ManimConfig {
	mobjects: ManimMobject[];
	timeline: ManimTimelineStep[];
	settings?: ManimSettings;
}

// ── 2D compiler internals ────────────────────────────────────────────────────

export interface CompiledMobject {
	id:           string;
	/** Flattened [x0,y0, x1,y1, ...] coordinate pool */
	points:       Float32Array;
	pointCount:   number;
	strokeColor:  string;
	fillColor:    string;
	strokeWidth:  number;
	/** true = cubic bezier control points, false = line segments */
	isBezier:     boolean;
}

export interface CompiledTimelineStep {
	action:         ManimAction;
	target?:        CompiledMobject;
	origin?:        CompiledMobject;
	durationMs:     number;
	delay:          number;
	easing:         ManimEasing;
}

export interface CompiledManimTimeline {
	steps:      CompiledTimelineStep[];
	mobjectMap: Map<string, CompiledMobject>;
	settings:   Required<ManimSettings>;
}

// ── 3D ───────────────────────────────────────────────────────────────────────

export type Manim3DLightType = "ambient" | "directional" | "point" | "spot";

export interface Manim3DLight {
	type:         Manim3DLightType;
	color?:       string;
	intensity?:   number;
	position?:    [number, number, number];
	direction?:   [number, number, number];
	castShadow?:  boolean;
}

/** camera.<X>.<Y> = value — see DSL docs */
export interface Manim3DCamera {
	position?: [number, number, number];
	fov?:      number;
	near?:     number;
	far?:      number;
	look?: {
		/** Bone name OR [x,y,z] world position */
		content?: string | [number, number, number];
	};
	focus?: {
		distance?: number;
		aperture?: number;
	};
}

// ── DSL types (Tier 3 / 4) ───────────────────────────────────────────────────

export interface ManimBoneTransform {
	/** Direct bone name: "left.hand", "right.leg", "2.tentacle" */
	bone:     string;
	move?:    [number, number, number];
	rotate?:  [number, number, number]; // Euler degrees [x, y, z]
	scale?:   [number, number, number];
	easing?:  ManimEasing;
}

/**
 * frame ( frame-start = 120  frame-end = 240 ) { ... }
 * Bone transforms are only valid inside this range.
 */
export interface ManimDSLFrameGroup {
	frameStart:  number;
	frameEnd:    number;
	transforms:  ManimBoneTransform[];
}

/** Parsed from camera.X.Y = value lines */
export interface ManimDSLConstraints {
	camera: Manim3DCamera;
	lights: Manim3DLight[];
}

export interface ManimDSLDocument {
	frames:      ManimDSLFrameGroup[];
	constraints: ManimDSLConstraints;
}

// ── Animation routing (Tier 2.5) ─────────────────────────────────────────────

export type AnimationSource = "file" | "source";

export interface ManimBoneOverride {
	bone:   string;
	frames: ManimDSLFrameGroup[];
	/** "replace" removes the GLTF track; "additive" layers on top */
	mode:   "replace" | "additive";
}

export interface ManimAnimationRoute {
	/** GLTF animation clip name — required when source = "file" */
	clip?:     string;
	source:    AnimationSource;
	/** Per-bone overrides applied on top of (or replacing) the file clip */
	overrides?: ManimBoneOverride[];
	/** Full DSL string — used when source = "source" */
	dsl?:      string;
	/** Playback speed multiplier (default: 1.0) */
	speed?:    number;
}

// ── Top-level 3D config ───────────────────────────────────────────────────────

export interface Manim3DConfig {
	/** Path to GLTF/GLB/OBJ file */
	src:        string;
	format?:    "gltf" | "glb" | "obj";
	camera?:    Manim3DCamera;
	lights?:    Manim3DLight[];
	animation?: ManimAnimationRoute;
	settings?: {
		loop?:      boolean;
		fps?:       number;
		shadows?:   boolean;
		wireframe?: boolean;
		background?: string;
	};
}
