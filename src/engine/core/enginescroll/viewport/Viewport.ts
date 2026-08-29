// ============================================================================
// Viewport.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { ViewportMath } from "./ViewportMath";
import { ViewportPoints } from "./ViewportPoints";

export class Viewport {
	public static update(): void {
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const cache = runtime.getCache();
		const spacing = state.page.pointSpacing > 0 ? state.page.pointSpacing : 1;

		const topPoint = ViewportMath.pixelsToPoints(cache.scrollY, spacing);
		const bottomPoint = ViewportMath.pixelsToPoints(
			cache.scrollY + cache.viewportHeight,
			spacing,
		);

		// Movement points represent the top scroll edge. The maximum reachable
		// top edge is documentHeight - viewportHeight, not the document bottom.
		state.page.totalPoints = ViewportMath.pixelsToPoints(
			Math.max(0, cache.documentHeight - cache.viewportHeight),
			spacing,
		);

		const focus = ViewportPoints.resolveFocus(
			cache.scrollY,
			cache.documentHeight,
			cache.viewportHeight,
		);
		const currentPoint = ViewportMath.lerp(topPoint, bottomPoint, focus);

		state.viewport.top = topPoint;
		state.viewport.current = currentPoint;
		state.viewport.bottom = bottomPoint;
	}
}
