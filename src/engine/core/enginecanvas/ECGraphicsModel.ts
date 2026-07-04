// ============================================================================
// ECGraphicsModel.ts — factory functions for the EC graphics model
// ============================================================================
//
//  Every shape ultimately becomes vertices. These factories generate the
//  Float32Array vertex data once, so mesh.vertices() / vertexCount() /
//  faceCount() / bounds() / center() work on any shape without the caller
//  knowing how it was built.
// ============================================================================

import type {
	ECBounds,
	ECCamera,
	ECGroup,
	ECMaterial,
	ECMesh,
	ECNode,
	ECScene,
	ECTransform,
	ECVector2,
	ECVector3,
} from "./ECTypes";

let idCounter = 0;
function nextId(prefix: string): string {
	return `${prefix}-${(idCounter++).toString(36)}`;
}

// ── Primitives ───────────────────────────────────────────────────────────────

export function ecVec2(x: number, y: number): ECVector2 {
	return { x, y };
}

export function ecVec3(x: number, y: number, z = 0): ECVector3 {
	return { x, y, z };
}

export function ecTransform(overrides: Partial<ECTransform> = {}): ECTransform {
	return {
		position: overrides.position ?? ecVec3(0, 0, 0),
		rotation: overrides.rotation ?? ecVec3(0, 0, 0),
		scale:    overrides.scale    ?? ecVec3(1, 1, 1),
	};
}

export function ecMaterial(overrides: Partial<ECMaterial> = {}): ECMaterial {
	return {
		fill:         overrides.fill,
		stroke:       overrides.stroke,
		strokeWidth:  overrides.strokeWidth  ?? 1,
		opacity:      overrides.opacity      ?? 1,
		shading:      overrides.shading      ?? "flat",
		rimColor:     overrides.rimColor,
		rimIntensity: overrides.rimIntensity ?? 0.5,
	};
}

// ── Mesh helpers ─────────────────────────────────────────────────────────────

function computeBounds(vertices: Float32Array): ECBounds {

	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

	for (let i = 0; i < vertices.length; i += 3) {
		const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
		if (x < minX) minX = x; if (x > maxX) maxX = x;
		if (y < minY) minY = y; if (y > maxY) maxY = y;
		if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
	}

	if (vertices.length === 0) {
		return { min: ecVec3(0, 0, 0), max: ecVec3(0, 0, 0) };
	}

	return { min: ecVec3(minX, minY, minZ), max: ecVec3(maxX, maxY, maxZ) };

}

function makeMesh(
	topology:  ECMesh["topology"],
	vertices:  Float32Array,
	material:  ECMaterial,
	transform: ECTransform,
	indices?:  Uint16Array | Uint32Array,
): ECMesh {

	const mesh: ECMesh = {
		id: nextId("mesh"),
		type: "mesh",
		vertices,
		indices,
		material,
		transform,
		topology,

		vertexCount(): number {
			return vertices.length / 3;
		},

		faceCount(): number {
			if (indices) return indices.length / 3;
			if (topology === "fan") return Math.max(0, (vertices.length / 3) - 2);
			return 0;
		},

		bounds(): ECBounds {
			return computeBounds(vertices);
		},

		center(): ECVector3 {
			const b = computeBounds(vertices);
			return ecVec3(
				(b.min.x + b.max.x) / 2,
				(b.min.y + b.max.y) / 2,
				(b.min.z + b.max.z) / 2,
			);
		},
	};

	return mesh;

}

// ── Shape builders ───────────────────────────────────────────────────────────

/**
 * Circle → generates a vertex ring + a center vertex at index 0 for
 * triangle-fan filling. `segments` controls smoothness (default 48).
 */
export function ecCircle(
	radius:    number,
	opts: {
		segments?:  number;
		material?:  Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {

	const segments = opts.segments ?? 48;
	const verts    = new Float32Array((segments + 2) * 3);

	// Center vertex (fan origin)
	verts[0] = 0; verts[1] = 0; verts[2] = 0;

	for (let i = 0; i <= segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		const idx   = (i + 1) * 3;
		verts[idx]     = Math.cos(angle) * radius;
		verts[idx + 1] = Math.sin(angle) * radius;
		verts[idx + 2] = 0;
	}

	return makeMesh(
		"fan",
		verts,
		ecMaterial(opts.material),
		ecTransform(opts.transform),
	);

}

/** Rectangle → 4 corner vertices, fan-filled (2 triangles). */
export function ecRect(
	width:  number,
	height: number,
	opts: {
		material?:  Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {

	const hw = width / 2, hh = height / 2;

	const verts = new Float32Array([
		-hw, -hh, 0,
		 hw, -hh, 0,
		 hw,  hh, 0,
		-hw,  hh, 0,
	]);

	return makeMesh(
		"fan",
		verts,
		ecMaterial(opts.material),
		ecTransform(opts.transform),
	);

}

/**
 * Path → parses a minimal SVG-like command string (M, L, C, Q, Z) or an
 * explicit point list into a line-strip mesh (no fill).
 */
export function ecPath(
	source: string | ECVector2[],
	opts: {
		material?:  Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {

	const points: ECVector2[] =
		typeof source === "string" ? parsePathString(source) : source;

	const verts = new Float32Array(points.length * 3);

	for (let i = 0; i < points.length; i++) {
		verts[i * 3]     = points[i].x;
		verts[i * 3 + 1] = points[i].y;
		verts[i * 3 + 2] = 0;
	}

	return makeMesh(
		"strip",
		verts,
		ecMaterial(opts.material),
		ecTransform(opts.transform),
	);

}

function parsePathString(d: string): ECVector2[] {

	const points: ECVector2[] = [];
	const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];

	let i = 0, cx = 0, cy = 0;

	function num(): number {
		return parseFloat(tokens[i++]);
	}

	while (i < tokens.length) {

		const cmd = tokens[i];

		if (cmd === "M" || cmd === "L") {
			i++;
			cx = num(); cy = num();
			points.push(ecVec2(cx, cy));
		} else if (cmd === "C") {
			i++;
			const c1x = num(), c1y = num();
			const c2x = num(), c2y = num();
			const ex  = num(), ey  = num();
			// Flatten cubic bezier into line segments
			const steps = 16;
			for (let s = 1; s <= steps; s++) {
				const t  = s / steps;
				const mt = 1 - t;
				const x  = mt*mt*mt*cx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*ex;
				const y  = mt*mt*mt*cy + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*ey;
				points.push(ecVec2(x, y));
			}
			cx = ex; cy = ey;
		} else if (cmd === "Z" || cmd === "z") {
			i++;
			if (points.length) points.push(points[0]);
		} else {
			i++; // skip unknown token defensively
		}

	}

	return points;

}

/** Line strip through explicit points — no fill, stroke only. */
export function ecLine(
	points: ECVector2[],
	opts: {
		material?:  Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	return ecPath(points, opts);
}

/** Closed polygon, fan-filled. */
export function ecPolygon(
	points: ECVector2[],
	opts: {
		material?:  Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {

	const verts = new Float32Array(points.length * 3);

	for (let i = 0; i < points.length; i++) {
		verts[i * 3]     = points[i].x;
		verts[i * 3 + 1] = points[i].y;
		verts[i * 3 + 2] = 0;
	}

	return makeMesh(
		"fan",
		verts,
		ecMaterial(opts.material),
		ecTransform(opts.transform),
	);

}

// ── Group / Scene ────────────────────────────────────────────────────────────

export function ecGroup(
	children:  ECNode[],
	transform: Partial<ECTransform> = {},
): ECGroup {
	return {
		id: nextId("group"),
		type: "group",
		children,
		transform: ecTransform(transform),
	};
}

export function ecScene(
	children: ECNode[],
	opts: {
		camera?:      ECCamera;
		environment?: ECScene["environment"];
		background?:  string;
	} = {},
): ECScene {
	return {
		id: nextId("scene"),
		type: "scene",
		children,
		camera:      opts.camera,
		environment: opts.environment ?? "void",
		background:  opts.background,
	};
}

/**
 * The Void — EngineCanvas's default environment. No background, no HDRI,
 * no sky, no fog, no floor. Infinite empty space. Works for both 2D and 3D.
 */
export const ecVoidEnvironment: ECScene["environment"] = "void";
