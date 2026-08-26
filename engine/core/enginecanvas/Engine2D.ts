// ============================================================================
// Engine2D.ts — custom vector rendering engine
// ============================================================================
//
//  Primary purpose: modern vector animation. Renders an ECScene onto a 2D
//  canvas context using flat, high-contrast artistic shading — never
//  physically-based lighting. Optional rim-light pass gives shapes a
//  cartoon/illustration-style edge highlight for readability.
// ============================================================================

import type { ECGroup, ECMesh, ECNode, ECScene, ECTransform } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

export class Engine2D implements RenderingEngine {

	public readonly name = "2d";

	private ctx:    CanvasRenderingContext2D | null = null;
	private width   = 0;
	private height  = 0;

	// -------------------------------------------------------------------------

	public init(context: ECRenderContext): void {

		if (!context.ctx2d) {
			throw new Error(
				"[Engine2D] Requires a 2D canvas context. Pass mode=\"2d\" on EngineCanvas.",
			);
		}

		this.ctx    = context.ctx2d;
		this.width  = context.width;
		this.height = context.height;

	}

	// -------------------------------------------------------------------------

	public resize(width: number, height: number): void {
		this.width  = width;
		this.height = height;
	}

	// -------------------------------------------------------------------------

	public render(scene: ECScene, _delta: number, _frame: number): void {

		const ctx = this.ctx;
		if (!ctx) return;

		ctx.clearRect(0, 0, this.width, this.height);

		// "Void" environment paints nothing — infinite empty transparent space.
		if (scene.environment !== "void" && scene.background) {
			ctx.fillStyle = scene.background;
			ctx.fillRect(0, 0, this.width, this.height);
		}

		// Origin at canvas center — matches EngineManim / typical vector-scene convention.
		ctx.save();
		ctx.translate(this.width / 2, this.height / 2);

		for (const node of scene.children) {
			this.renderNode(ctx, node);
		}

		ctx.restore();

	}

	// -------------------------------------------------------------------------

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

		for (const child of group.children) {
			this.renderNode(ctx, child);
		}

		ctx.restore();

	}

	private applyTransform(ctx: CanvasRenderingContext2D, t: ECTransform): void {
		ctx.translate(t.position.x, t.position.y);
		ctx.rotate((t.rotation.z * Math.PI) / 180);
		ctx.scale(t.scale.x, t.scale.y);
	}

	// -------------------------------------------------------------------------

	private renderMesh(ctx: CanvasRenderingContext2D, mesh: ECMesh): void {

		ctx.save();
		this.applyTransform(ctx, mesh.transform);

		const mat   = mesh.material;
		const verts = mesh.vertices;

		ctx.beginPath();

		for (let i = 0; i < verts.length; i += 3) {
			const x = verts[i], y = verts[i + 1];
			if (i === 0) ctx.moveTo(x, y);
			else         ctx.lineTo(x, y);
		}

		if (mesh.topology === "fan") ctx.closePath();

		ctx.globalAlpha = mat.opacity ?? 1;

		// Rim-light pass — drawn BEHIND the flat fill/stroke as a soft wider
		// outline, so only the edges show through. Illustration-style, not PBR.
		if (mat.shading === "rim" && mat.rimColor) {
			ctx.save();
			ctx.strokeStyle = mat.rimColor;
			ctx.lineWidth   = (mat.strokeWidth ?? 1) + 4;
			ctx.globalAlpha = (mat.opacity ?? 1) * (mat.rimIntensity ?? 0.5);
			ctx.stroke();
			ctx.restore();
		}

		if (mat.fill && mesh.topology !== "strip") {
			ctx.fillStyle = mat.fill;
			ctx.fill();
		}

		if (mat.stroke) {
			ctx.strokeStyle = mat.stroke;
			ctx.lineWidth   = mat.strokeWidth ?? 1;
			ctx.stroke();
		}

		ctx.restore();

	}

	// -------------------------------------------------------------------------

	public dispose(): void {
		this.ctx = null;
	}

}
