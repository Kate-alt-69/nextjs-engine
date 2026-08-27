// ============================================================================
// EngineScrollMovement.ts
// ============================================================================

import { EngineScrollAnimation } from "./EngineScrollAnimation";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export class EngineScrollMovement {
	public static move(
		point: number,
		options?: number | EngineScrollMoveOptions,
	): void {
		if (!Number.isFinite(point)) return;
		const maximum = EngineScrollRuntime.get().getState().page.totalPoints;
		const clampedPoint = Math.max(0, Math.min(point, maximum));
		EngineScrollAnimation.start(clampedPoint, options);
	}

	public static moveBy(
		offset: number,
		options?: number | EngineScrollMoveOptions,
	): void {
		const topPoint = EngineScrollRuntime.get().getState().viewport.top;
		this.move(topPoint + (Number.isFinite(offset) ? offset : 0), options);
	}

	public static movePercent(
		percent: number,
		options?: number | EngineScrollMoveOptions,
	): void {
		if (!Number.isFinite(percent)) return;
		const total = EngineScrollRuntime.get().getState().page.totalPoints;
		this.move(total * (percent / 100), options);
	}

	public static top(options?: number | EngineScrollMoveOptions): void {
		this.move(0, options);
	}

	public static bottom(options?: number | EngineScrollMoveOptions): void {
		this.move(EngineScrollRuntime.get().getState().page.totalPoints, options);
	}

	public static stop(): void {
		EngineScrollAnimation.stop();
	}
}
