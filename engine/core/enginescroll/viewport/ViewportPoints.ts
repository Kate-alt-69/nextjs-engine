// ============================================================================
// ViewportPoints.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { ViewportMath } from "./ViewportMath";

export type EngineScrollViewportFocus =
	| number
	| "top"
	| "center"
	| "bottom"
	| "progressive";

export class ViewportPoints {
	private static focus: EngineScrollViewportFocus = "progressive";

	public static resolveFocus(
		scrollY: number,
		documentHeight: number,
		viewportHeight: number,
	): number {
		if (typeof this.focus === "number") {
			return ViewportMath.clamp(this.focus, 0, 1);
		}
		if (this.focus === "top") return 0;
		if (this.focus === "center") return 0.5;
		if (this.focus === "bottom") return 1;

		const maximumScrollPixels = Math.max(0, documentHeight - viewportHeight);
		if (maximumScrollPixels <= 0) return 0;
		return ViewportMath.clamp(scrollY / maximumScrollPixels, 0, 1);
	}

	public static getFocus(): number {
		const cache = EngineScrollRuntime.get().getCache();
		return this.resolveFocus(
			cache.scrollY,
			cache.documentHeight,
			cache.viewportHeight,
		);
	}

	public static getFocusMode(): EngineScrollViewportFocus {
		return this.focus;
	}

	public static setFocus(value: EngineScrollViewportFocus): void {
		this.focus = typeof value === "number"
			? ViewportMath.clamp(value, 0, 1)
			: value;
	}

	public static getCurrentPoint(): number {
		return EngineScrollRuntime.get().getState().viewport.current;
	}

	public static getTopPoint(): number {
		return EngineScrollRuntime.get().getState().viewport.top;
	}

	public static getBottomPoint(): number {
		return EngineScrollRuntime.get().getState().viewport.bottom;
	}

	public static getMaximumPoint(): number {
		return EngineScrollRuntime.get().getState().page.totalPoints;
	}
}
