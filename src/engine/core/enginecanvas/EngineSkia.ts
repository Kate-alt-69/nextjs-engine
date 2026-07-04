// ============================================================================
// EngineSkia.ts — professional GPU 2D rendering (FUTURE — not yet implemented)
// ============================================================================
//
//  Primary purpose: professional GPU vector rendering, high-quality text
//  rendering, clipping, and gradients — powered by CanvasKit (Skia compiled
//  to WebAssembly, the same rendering library behind Chrome/Flutter).
//
//  This is a stub. Calling init() throws a clear error pointing to Engine2D
//  or Engine3D as the current alternatives. Wired into the engine registry
//  now so `engine: "skia"` is a recognised, forward-compatible name — the
//  real CanvasKit integration is planned for a future release.
// ============================================================================

import type { ECScene } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";

export class EngineSkiaEngine implements RenderingEngine {

	public readonly name = "skia";

	public init(_context: ECRenderContext): void {
		throw new Error(
			"[EngineCanvas] EngineSkia is not implemented yet — planned for a " +
			"future release using CanvasKit for GPU-accelerated vector rendering, " +
			"professional text, and high-quality gradients/clipping. " +
			"Use engine: \"2d\" (Engine2D) or engine: \"3d\" (Engine3D) for now.",
		);
	}

	public render(_scene: ECScene): void {
		/* unreachable — init() always throws */
	}

	public resize(_width: number, _height: number): void {
		/* unreachable — init() always throws */
	}

	public dispose(): void {
		/* unreachable — init() always throws */
	}

}
