// ============================================================================
// Engine2D.ts — custom vector rendering engine
// ============================================================================

import type { ECGroup, ECMesh, ECNode, ECScene, ECTransform } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

interface CompiledMeshTopology {
	indicesRef?: Uint16Array | Uint32Array;
	topology: ECMesh["topology"];
	vertexCount: number;
	triangles: number[];
	boundaryEdges: Array<[number, number]>;
}

export class Engine2D implements RenderingEngine {
	public readonly name = "2d";

	private ctx: CanvasRenderingContext2D | null = null;
	private width = 0;
	private height = 0;
	private readonly topologyCache = new WeakMap<ECMesh, CompiledMeshTopology>();

	public init(context: ECRenderContext): void {
		if (!context.ctx2d) {
			throw new Error("[Engine2D] Requires a 2D canvas context. Pass mode=\"2d\" on EngineCanvas.");
		}
		this.ctx = context.ctx2d;
		this.width = context.width;
		this.height = context.height;
	}

	public resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
	}

	public render(scene: ECScene, _delta: number, _frame: number): void {
		const ctx = this.ctx;
		if (!ctx) return;

		ctx.clearRect(0, 0, this.width, this.height);
		if (scene.environment !== "void" && scene.background) {
			ctx.fillStyle = scene.background;
			ctx.fillRect(0, 0, this.width, this.height);
		}

		ctx.save();
		ctx.translate(this.width / 2, this.height / 2);
		for (const node of scene.children) this.renderNode(ctx, node);
		ctx.restore();
	}

	private renderNode(ctx: CanvasRenderingContext2D, node: ECNode): void {
		if (node.type === "group") {
			this.renderGroup(ctx, node);
			return;
		}
		this.renderMesh(ctx, node);
	}

	private renderGroup(ctx: CanvasRenderingContext2D, group: ECGroup): void {
		ctx.save();
		this.applyTransform(ctx, group.transform);
		for (const child of group.children) this.renderNode(ctx, child);
		ctx.restore();
	}

	private applyTransform(ctx: CanvasRenderingContext2D, transform: ECTransform): void {
		ctx.translate(transform.position.x, transform.position.y);
		ctx.rotate((transform.rotation.z * Math.PI) / 180);
		ctx.scale(transform.scale.x, transform.scale.y);
	}

	private renderMesh(ctx: CanvasRenderingContext2D, mesh: ECMesh): void {
		ctx.save();
		this.applyTransform(ctx, mesh.transform);
		ctx.globalAlpha = mesh.material.opacity ?? 1;

		if (mesh.topology === "strip") {
			this.renderStrip(ctx, mesh);
		} else {
			this.renderTriangles(ctx, mesh);
		}

		ctx.restore();
	}

	private renderStrip(ctx: CanvasRenderingContext2D, mesh: ECMesh): void {
		const vertices = mesh.vertices;
		const order = mesh.indices ? Array.from(mesh.indices) : undefined;
		const count = order?.length ?? vertices.length / 3;
		if (count === 0) return;

		ctx.beginPath();
		for (let position = 0; position < count; position++) {
			const vertexIndex = order ? order[position] : position;
			const x = vertices[vertexIndex * 3];
			const y = vertices[vertexIndex * 3 + 1];
			if (position === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}

		const material = mesh.material;
		const stroke = material.stroke ?? material.fill;
		if (!stroke) return;
		ctx.strokeStyle = stroke;
		ctx.lineWidth = material.strokeWidth ?? 1;
		ctx.stroke();
	}

	private renderTriangles(ctx: CanvasRenderingContext2D, mesh: ECMesh): void {
		const compiled = this.getCompiledTopology(mesh);
		const vertices = mesh.vertices;
		const material = mesh.material;

		if (material.shading === "rim" && material.rimColor && compiled.boundaryEdges.length > 0) {
			ctx.save();
			ctx.strokeStyle = material.rimColor;
			ctx.lineWidth = (material.strokeWidth ?? 1) + 4;
			ctx.globalAlpha = (material.opacity ?? 1) * (material.rimIntensity ?? 0.5);
			this.strokeEdges(ctx, vertices, compiled.boundaryEdges);
			ctx.restore();
		}

		if (material.fill && compiled.triangles.length >= 3) {
			ctx.fillStyle = material.fill;
			ctx.beginPath();
			for (let index = 0; index < compiled.triangles.length; index += 3) {
				const a = compiled.triangles[index];
				const b = compiled.triangles[index + 1];
				const c = compiled.triangles[index + 2];
				ctx.moveTo(vertices[a * 3], vertices[a * 3 + 1]);
				ctx.lineTo(vertices[b * 3], vertices[b * 3 + 1]);
				ctx.lineTo(vertices[c * 3], vertices[c * 3 + 1]);
				ctx.closePath();
			}
			ctx.fill();
		}

		if (material.stroke && compiled.boundaryEdges.length > 0) {
			ctx.strokeStyle = material.stroke;
			ctx.lineWidth = material.strokeWidth ?? 1;
			this.strokeEdges(ctx, vertices, compiled.boundaryEdges);
		}
	}

	private strokeEdges(
		ctx: CanvasRenderingContext2D,
		vertices: Float32Array,
		edges: Array<[number, number]>,
	): void {
		ctx.beginPath();
		for (const [a, b] of edges) {
			ctx.moveTo(vertices[a * 3], vertices[a * 3 + 1]);
			ctx.lineTo(vertices[b * 3], vertices[b * 3 + 1]);
		}
		ctx.stroke();
	}

	private getCompiledTopology(mesh: ECMesh): CompiledMeshTopology {
		const vertexCount = mesh.vertices.length / 3;
		const cached = this.topologyCache.get(mesh);
		if (
			cached
			&& cached.indicesRef === mesh.indices
			&& cached.topology === mesh.topology
			&& cached.vertexCount === vertexCount
		) {
			return cached;
		}

		const triangles: number[] = [];
		if (mesh.indices && mesh.indices.length >= 3) {
			for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
				triangles.push(mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]);
			}
		} else if (mesh.topology === "fan") {
			for (let vertex = 1; vertex + 1 < vertexCount; vertex++) {
				triangles.push(0, vertex, vertex + 1);
			}
		} else {
			for (let vertex = 0; vertex + 2 < vertexCount; vertex += 3) {
				triangles.push(vertex, vertex + 1, vertex + 2);
			}
		}

		const edgeCounts = new Map<string, { count: number; edge: [number, number] }>();
		const recordEdge = (a: number, b: number): void => {
			const low = Math.min(a, b);
			const high = Math.max(a, b);
			const key = `${low}:${high}`;
			const existing = edgeCounts.get(key);
			if (existing) existing.count++;
			else edgeCounts.set(key, { count: 1, edge: [a, b] });
		};

		for (let index = 0; index + 2 < triangles.length; index += 3) {
			const a = triangles[index];
			const b = triangles[index + 1];
			const c = triangles[index + 2];
			recordEdge(a, b);
			recordEdge(b, c);
			recordEdge(c, a);
		}

		const boundaryEdges = Array.from(edgeCounts.values())
			.filter((entry) => entry.count === 1)
			.map((entry) => entry.edge);
		const compiled: CompiledMeshTopology = {
			indicesRef: mesh.indices,
			topology: mesh.topology,
			vertexCount,
			triangles,
			boundaryEdges,
		};
		this.topologyCache.set(mesh, compiled);
		return compiled;
	}

	public dispose(): void {
		this.ctx = null;
	}
}
