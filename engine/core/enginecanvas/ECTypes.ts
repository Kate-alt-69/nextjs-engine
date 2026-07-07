// ============================================================================
// ECTypes.ts — EngineCanvas V2 graphics model types
// ============================================================================
//
//  EngineCanvas owns its own graphics primitives. Rendering engines (Engine2D,
//  Engine3D, EngineSVG, EngineSkia) translate these into their own internal
//  representations — they never define the source of truth themselves.
//
//  These types carry NO animation, physics, or bone/skeleton data. That is
//  the responsibility of consumer components (e.g. EngineManim) — EC only
//  describes what to draw, not how it moves over time.
// ============================================================================

export interface ECVector2 {
	x: number;
	y: number;
}

export interface ECVector3 {
	x: number;
	y: number;
	z: number;
}

export interface ECBounds {
	min: ECVector3;
	max: ECVector3;
}

// ── Material ─────────────────────────────────────────────────────────────────

export type ECShadingMode = "none" | "flat" | "rim";

export interface ECMaterial {
	fill?:         string;
	stroke?:       string;
	strokeWidth?:  number;
	opacity?:      number;
	/** "none" = no lighting pass. "flat" = solid fill, high contrast, no gradient.
	 *  "rim" = flat fill + a rim-light edge highlight (cartoon/illustration look). */
	shading?:      ECShadingMode;
	rimColor?:     string;
	/** 0–1, how strong the rim highlight is. Default 0.5. */
	rimIntensity?: number;
}

// ── Transform ────────────────────────────────────────────────────────────────

export interface ECTransform {
	position: ECVector3;
	rotation: ECVector3; // degrees
	scale:    ECVector3;
}

// ── Camera ───────────────────────────────────────────────────────────────────

export interface ECCamera {
	position: ECVector3;
	lookAt?:  ECVector3;
	fov?:     number;
	near?:    number;
	far?:     number;
}

// ── Mesh ─────────────────────────────────────────────────────────────────────

/**
 * The universal drawable primitive. Every ECShape (circle, rect, path, line,
 * polygon) compiles down to an ECMesh — flat vertex + optional index data.
 */
export interface ECMesh {
	id:         string;
	type:       "mesh";
	/** Flat [x,y,z, x,y,z, ...] vertex positions. */
	vertices:   Float32Array;
	/** Triangle indices. Omitted for line/point-only meshes. */
	indices?:   Uint16Array | Uint32Array;
	material:   ECMaterial;
	transform:  ECTransform;
	/** "fan" = triangle-fan from vertex 0 (circles/polygons).
	 *  "strip" = line strip, no fill (paths/lines). */
	topology:   "fan" | "strip" | "triangles";

	vertexCount(): number;
	faceCount():   number;
	bounds():      ECBounds;
	center():      ECVector3;
}

// ── Group / Scene ────────────────────────────────────────────────────────────

export type ECNode = ECMesh | ECGroup;

export interface ECGroup {
	id:        string;
	type:      "group";
	children:  ECNode[];
	transform: ECTransform;
}

export type ECEnvironment = "void" | "custom";

export interface ECScene {
	id:           string;
	type:         "scene";
	children:     ECNode[];
	camera?:      ECCamera;
	/** "void" = no background, no HDRI, no sky, no fog, no floor. Infinite
	 *  empty space. Default for both 2D and 3D scenes. */
	environment:  ECEnvironment;
	background?:  string;
}
