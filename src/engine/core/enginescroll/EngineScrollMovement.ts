// ============================================================================
// EngineScrollMovement.ts
// ============================================================================

import { EngineScrollAnimation } from "./EngineScrollAnimation";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollMovement {

	// -------------------------------------------------------------------------
	// Absolute
	// -------------------------------------------------------------------------

	public static move(
		point: number,
		duration?: number,
	): void {

		const maximum =
			EngineScrollRuntime
				.get()
				.getState()
				.page
				.totalPoints;

		point =
			Math.max(
				0,
				Math.min(point, maximum),
			);

		EngineScrollAnimation.start(
			point,
			duration,
		);

	}

	// -------------------------------------------------------------------------
	// Relative
	// -------------------------------------------------------------------------

	public static moveBy(
		offset: number,
		duration?: number,
	): void {

		const state =
			EngineScrollRuntime
				.get()
				.getState();

		this.move(
			state.viewport.current + offset,
			duration,
		);

	}

	// -------------------------------------------------------------------------
	// Percentage
	// -------------------------------------------------------------------------

	public static movePercent(
		percent: number,
		duration?: number,
	): void {

		const total =
			EngineScrollRuntime
				.get()
				.getState()
				.page
				.totalPoints;

		this.move(
			total * (percent / 100),
			duration,
		);

	}

	// -------------------------------------------------------------------------
	// Beginning / End
	// -------------------------------------------------------------------------

	public static top(
		duration?: number,
	): void {

		this.move(0, duration);

	}

	public static bottom(
		duration?: number,
	): void {

		this.move(
			EngineScrollRuntime
				.get()
				.getState()
				.page
				.totalPoints,
			duration,
		);

	}

	// -------------------------------------------------------------------------
	// Cancel
	// -------------------------------------------------------------------------

	public static stop(): void {

		EngineScrollAnimation.stop();

	}

}