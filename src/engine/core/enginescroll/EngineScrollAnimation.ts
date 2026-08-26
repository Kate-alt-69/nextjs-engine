// ============================================================================
// EngineScrollAnimation.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import { BrowserScheduler } from "./browser/BrowserScheduler";

export class EngineScrollAnimation {
	private static readonly DEFAULT_DURATION = 550;

	public static isAnimating(): boolean {
		return EngineScrollRuntime.get().getState().animation.active;
	}

	public static start(targetPoint: number, duration = this.DEFAULT_DURATION): void {
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const animation = state.animation;
		const cache = runtime.getCache();

		animation.active = true;
		cache.isAnimating = true;
		animation.startPoint = state.viewport.current;
		animation.currentPoint = state.viewport.current;
		animation.targetPoint = targetPoint;
		animation.duration = Math.max(duration, 0);
		animation.startTime = performance.now();

		// Programmatic/URL movement must wake the scheduler itself. Waiting for a
		// native scroll event means the first animation frame may never happen.
		BrowserScheduler.request();
	}

	public static stop(): void {
		const runtime = EngineScrollRuntime.get();
		runtime.getMutableState().animation.active = false;
		runtime.getCache().isAnimating = false;
	}

	public static update(timestamp: number): void {
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const animation = state.animation;
		if (!animation.active) return;

		const elapsed = timestamp - animation.startTime;
		const progress = animation.duration <= 0
			? 1
			: Math.min(Math.max(elapsed / animation.duration, 0), 1);
		const eased = EngineScrollEasing.easeInOutCubic(progress);
		const cache = runtime.getCache();

		animation.currentPoint = animation.startPoint
			+ (animation.targetPoint - animation.startPoint) * eased;

		window.scrollTo({
			top: animation.currentPoint * state.page.pointSpacing,
			left: window.scrollX,
			behavior: "auto",
		});

		if (progress >= 1) {
			animation.currentPoint = animation.targetPoint;
			animation.active = false;
			cache.isAnimating = false;
		}
	}

	public static moveToCurrent(offset: number, duration = this.DEFAULT_DURATION): void {
		this.start(
			EngineScrollRuntime.get().getState().viewport.current + offset,
			duration,
		);
	}
}
