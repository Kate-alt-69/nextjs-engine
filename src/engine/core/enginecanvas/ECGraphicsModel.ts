// ============================================================================
// ECGraphicsModel.ts — factory functions for the EC graphics model
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
		scale: overrides.scale ?? ecVec3(1, 1, 1),
	};
}

export function ecMaterial(overrides: Partial<ECMaterial> = {}): ECMaterial {
	return {
		fill: overrides.fill,
		stroke: overrides.stroke,
		strokeWidth: overrides.strokeWidth ?? 1,
		opacity: overrides.opacity ?? 1,
		shading: overrides.shading ?? "flat",
		rimColor: overrides.rimColor,
		rimIntensity: overrides.rimIntensity ?? 0.5,
	};
}

function computeBounds(vertices: Float32Array): ECBounds {
	if (vertices.length === 0) return { min: ecVec3(0, 0, 0), max: ecVec3(0, 0, 0) };

	let minX = Infinity;
	let minY = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	let maxZ = -Infinity;

	for (let index = 0; index < vertices.length; index += 3) {
		const x = vertices[index];
		const y = vertices[index + 1];
		const z = vertices[index + 2];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		if (z < minZ) minZ = z;
		if (z > maxZ) maxZ = z;
	}

	return { min: ecVec3(minX, minY, minZ), max: ecVec3(maxX, maxY, maxZ) };
}

function computeFaceCount(
	topology: ECMesh["topology"],
	vertices: Float32Array,
	indices?: Uint16Array | Uint32Array,
): number {
	if (topology === "strip") return 0;
	if (indices) return Math.floor(indices.length / 3);
	const vertexCount = Math.floor(vertices.length / 3);
	if (topology === "fan") return Math.max(0, vertexCount - 2);
	return Math.floor(vertexCount / 3);
}

function makeMesh(
	topology: ECMesh["topology"],
	vertices: Float32Array,
	material: ECMaterial,
	transform: ECTransform,
	indices?: Uint16Array | Uint32Array,
): ECMesh {
	return {
		id: nextId("mesh"),
		type: "mesh",
		vertices,
		indices,
		material,
		transform,
		topology,
		vertexCount: () => vertices.length / 3,
		faceCount: () => computeFaceCount(topology, vertices, indices),
		bounds: () => computeBounds(vertices),
		center(): ECVector3 {
			const bounds = computeBounds(vertices);
			return ecVec3(
				(bounds.min.x + bounds.max.x) / 2,
				(bounds.min.y + bounds.max.y) / 2,
				(bounds.min.z + bounds.max.z) / 2,
			);
		},
	};
}

export function ecCircle(
	radius: number,
	opts: {
		segments?: number;
		material?: Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	const segments = Math.max(3, Math.floor(opts.segments ?? 48));
	const vertices = new Float32Array((segments + 2) * 3);

	for (let segment = 0; segment <= segments; segment++) {
		const angle = (segment / segments) * Math.PI * 2;
		const index = (segment + 1) * 3;
		vertices[index] = Math.cos(angle) * radius;
		vertices[index + 1] = Math.sin(angle) * radius;
	}

	return makeMesh("fan", vertices, ecMaterial(opts.material), ecTransform(opts.transform));
}

export function ecRect(
	width: number,
	height: number,
	opts: {
		material?: Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const vertices = new Float32Array([
		-halfWidth, -halfHeight, 0,
		halfWidth, -halfHeight, 0,
		halfWidth, halfHeight, 0,
		-halfWidth, halfHeight, 0,
	]);
	return makeMesh("fan", vertices, ecMaterial(opts.material), ecTransform(opts.transform));
}

/**
 * SVG-like path parser. The engine intentionally flattens curves to line
 * segments, but supports the common M/L/H/V/C/Q/Z command set in both absolute
 * and relative forms, repeated coordinate groups, commas, and exponent numbers.
 */
export function ecPath(
	source: string | ECVector2[],
	opts: {
		material?: Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	const points = typeof source === "string" ? parsePathString(source) : source;
	const vertices = new Float32Array(points.length * 3);
	for (let index = 0; index < points.length; index++) {
		vertices[index * 3] = points[index].x;
		vertices[index * 3 + 1] = points[index].y;
	}
	return makeMesh("strip", vertices, ecMaterial(opts.material), ecTransform(opts.transform));
}

function parsePathString(path: string): ECVector2[] {
	const points: ECVector2[] = [];
	const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi) ?? [];
	let tokenIndex = 0;
	let command = "";
	let currentX = 0;
	let currentY = 0;
	let startX = 0;
	let startY = 0;

	const isCommand = (token: string | undefined): boolean => Boolean(token && /^[a-zA-Z]$/.test(token));
	const hasNumbers = (count: number): boolean => {
		if (tokenIndex + count > tokens.length) return false;
		for (let offset = 0; offset < count; offset++) {
			if (isCommand(tokens[tokenIndex + offset])) return false;
		}
		return true;
	};
	const number = (): number => Number.parseFloat(tokens[tokenIndex++]);
	const pushPoint = (x: number, y: number): void => {
		currentX = x;
		currentY = y;
		points.push(ecVec2(x, y));
	};

	while (tokenIndex < tokens.length) {
		if (isCommand(tokens[tokenIndex])) command = tokens[tokenIndex++];
		if (!command) {
			tokenIndex++;
			continue;
		}

		const relative = command === command.toLowerCase();
		const upper = command.toUpperCase();

		switch (upper) {
			case "M": {
				if (!hasNumbers(2)) {
					command = "";
					break;
				}
				let first = true;
				while (hasNumbers(2)) {
					const x = number();
					const y = number();
					const nextX = relative ? currentX + x : x;
					const nextY = relative ? currentY + y : y;
					pushPoint(nextX, nextY);
					if (first) {
						startX = nextX;
						startY = nextY;
						first = false;
					}
				}
				// Repeated pairs following M/m are implicit L/l commands.
				command = relative ? "l" : "L";
				break;
			}
			case "L": {
				while (hasNumbers(2)) {
					const x = number();
					const y = number();
					pushPoint(relative ? currentX + x : x, relative ? currentY + y : y);
				}
				break;
			}
			case "H": {
				while (hasNumbers(1)) {
					const x = number();
					pushPoint(relative ? currentX + x : x, currentY);
				}
				break;
			}
			case "V": {
				while (hasNumbers(1)) {
					const y = number();
					pushPoint(currentX, relative ? currentY + y : y);
				}
				break;
			}
			case "C": {
				while (hasNumbers(6)) {
					const rawC1X = number();
					const rawC1Y = number();
					const rawC2X = number();
					const rawC2Y = number();
					const rawEndX = number();
					const rawEndY = number();
					const c1X = relative ? currentX + rawC1X : rawC1X;
					const c1Y = relative ? currentY + rawC1Y : rawC1Y;
					const c2X = relative ? currentX + rawC2X : rawC2X;
					const c2Y = relative ? currentY + rawC2Y : rawC2Y;
					const endX = relative ? currentX + rawEndX : rawEndX;
					const endY = relative ? currentY + rawEndY : rawEndY;
					const originX = currentX;
					const originY = currentY;
					for (let step = 1; step <= 16; step++) {
						const t = step / 16;
						const mt = 1 - t;
						pushPoint(
							mt * mt * mt * originX + 3 * mt * mt * t * c1X + 3 * mt * t * t * c2X + t * t * t * endX,
							mt * mt * mt * originY + 3 * mt * mt * t * c1Y + 3 * mt * t * t * c2Y + t * t * t * endY,
						);
					}
				}
				break;
			}
			case "Q": {
				while (hasNumbers(4)) {
					const rawControlX = number();
					const rawControlY = number();
					const rawEndX = number();
					const rawEndY = number();
					const controlX = relative ? currentX + rawControlX : rawControlX;
					const controlY = relative ? currentY + rawControlY : rawControlY;
					const endX = relative ? currentX + rawEndX : rawEndX;
					const endY = relative ? currentY + rawEndY : rawEndY;
					const originX = currentX;
					const originY = currentY;
					for (let step = 1; step <= 12; step++) {
						const t = step / 12;
						const mt = 1 - t;
						pushPoint(
							mt * mt * originX + 2 * mt * t * controlX + t * t * endX,
							mt * mt * originY + 2 * mt * t * controlY + t * t * endY,
						);
					}
				}
				break;
			}
			case "Z":
				if (points.length > 0 && (currentX !== startX || currentY !== startY)) pushPoint(startX, startY);
				currentX = startX;
				currentY = startY;
				command = "";
				break;
			default:
				// Unsupported SVG commands are skipped until the next command token.
				while (tokenIndex < tokens.length && !isCommand(tokens[tokenIndex])) tokenIndex++;
				command = "";
				break;
		}
	}

	return points;
}

export function ecLine(
	points: ECVector2[],
	opts: {
		material?: Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	return ecPath(points, opts);
}

export function ecPolygon(
	points: ECVector2[],
	opts: {
		material?: Partial<ECMaterial>;
		transform?: Partial<ECTransform>;
	} = {},
): ECMesh {
	const vertices = new Float32Array(points.length * 3);
	for (let index = 0; index < points.length; index++) {
		vertices[index * 3] = points[index].x;
		vertices[index * 3 + 1] = points[index].y;
	}
	return makeMesh("fan", vertices, ecMaterial(opts.material), ecTransform(opts.transform));
}

export function ecGroup(children: ECNode[], transform: Partial<ECTransform> = {}): ECGroup {
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
		camera?: ECCamera;
		environment?: ECScene["environment"];
		background?: string;
	} = {},
): ECScene {
	return {
		id: nextId("scene"),
		type: "scene",
		children,
		camera: opts.camera,
		environment: opts.environment ?? "void",
		background: opts.background,
	};
}

export const ecVoidEnvironment: ECScene["environment"] = "void";
