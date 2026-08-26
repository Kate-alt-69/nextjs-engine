// ============================================================================
// RenderingEngine.ts — the pluggable rendering engine contract
// ============================================================================
//
//  EngineCanvas owns the runtime (canvas lifecycle, GPU optimization, context
//  creation, resize, DPR, performance monitoring, pause management, SSR).
//
//  A RenderingEngine owns rendering only: scene management, drawing, object
//  conversion, engine-specific optimizations. It does NOT own animation
//  logic, physics, particles, or bone/skeleton systems — those belong to
//  consumer components (e.g. EngineManim) built on top of EC, never inside it.
// ============================================================================

import type { ECScene } from "./ECTypes";

export interface ECRenderContext {
	canvas: HTMLCanvasElement;
	ctx2d?: CanvasRenderingContext2D;
	gl?:    WebGLRenderingContext | WebGL2RenderingContext;
	width:  number;
	height: number;
	dpr:    number;
}

export interface RenderingEngine {
	readonly name: string;

	/** Called once after the canvas context is created. May be async
	 *  (e.g. Engine3D dynamically importing Three.js). */
	init(context: ECRenderContext): void | Promise<void>;

	/** Called every animation frame with the current scene graph. */
	render(scene: ECScene, delta: number, frame: number): void;

	/** Called when the canvas resizes (responsive mode or window resize). */
	resize(width: number, height: number): void;

	/** Called on unmount — release GPU resources, cancel internal timers. */
	dispose(): void;
}
