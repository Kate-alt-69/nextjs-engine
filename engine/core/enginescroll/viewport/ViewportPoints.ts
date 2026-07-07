// ============================================================================
// ViewportPoints.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { ViewportMath } from "./ViewportMath";

export class ViewportPoints {

	private static focus = 0.5;

	// -------------------------------------------------------------------------

	public static getFocus(): number {

		return this.focus;

	}

	// -------------------------------------------------------------------------

	public static setFocus(
		value: number,
	): void {

		this.focus = ViewportMath.clamp(
			value,
			0,
			1,
		);

	}

	// -------------------------------------------------------------------------

	public static getCurrentPoint(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.viewport
			.current;

	}

	// -------------------------------------------------------------------------

	public static getTopPoint(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.viewport
			.top;

	}

	// -------------------------------------------------------------------------

	public static getBottomPoint(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.viewport
			.bottom;

	}

	// -------------------------------------------------------------------------

	public static getMaximumPoint(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.page
			.totalPoints;

	}

}