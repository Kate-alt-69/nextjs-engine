// ============================================================================
// RenderingEngine.ts — the pluggable rendering engine contract
// ============================================================================
//
// EngineCanvas owns the runtime (canvas lifecycle, GPU optimization, context
// creation, resize, DPR, performance monitoring, pause management, SSR).
//
// A RenderingEngine owns rendering only: scene management, drawing, object
// conversion, engine-specific optimizations. It does NOT own animation logic,
// physics, particles, or bone/skeleton systems.
// ============================================================================

import type { ECScene } from "./ECTypes";

export interface ECRenderContext {
	canvas: HTMLCanvasElement;
	ctx2d?: CanvasRenderingContext2D;
	gl?: WebGLRenderingContext | WebGL2RenderingContext;
	width: number;
	height: number;
	dpr: number;
}

export interface RenderingEngine {
	readonly name: string;

	/** Called once after the canvas context is created. */
	init(context: ECRenderContext): void | Promise<void>;

	/** Called every animation frame with the current scene graph. */
	render(scene: ECScene, delta: number, frame: number): void;

	/**
	 * Called when CSS size or backing-store DPR changes.
	 * `dpr` is optional for backwards compatibility with custom engines that
	 * only care about CSS dimensions.
	 */
	resize(width: number, height: number, dpr?: number): void;

	/** Called on unmount — release GPU resources, cancel internal timers. */
	dispose(): void;
}
