// ============================================================================
// EngineScrollMovement.ts
// ============================================================================

import { EngineScrollAnimation } from "./EngineScrollAnimation";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollMovement {
	public static move(point: number, duration?: number): void {
		if (!Number.isFinite(point)) return;

		const maximum = EngineScrollRuntime.get().getState().page.totalPoints;
		const clampedPoint = Math.max(0, Math.min(point, maximum));
		EngineScrollAnimation.start(clampedPoint, duration);
	}

	public static moveBy(offset: number, duration?: number): void {
		const topPoint = EngineScrollRuntime.get().getState().viewport.top;
		this.move(topPoint + (Number.isFinite(offset) ? offset : 0), duration);
	}

	public static movePercent(percent: number, duration?: number): void {
		if (!Number.isFinite(percent)) return;
		const total = EngineScrollRuntime.get().getState().page.totalPoints;
		this.move(total * (percent / 100), duration);
	}

	public static top(duration?: number): void {
		this.move(0, duration);
	}

	public static bottom(duration?: number): void {
		this.move(EngineScrollRuntime.get().getState().page.totalPoints, duration);
	}

	public static stop(): void {
		EngineScrollAnimation.stop();
	}
}
