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
		const safeTargetPoint = Number.isFinite(targetPoint)
			? targetPoint
			: state.viewport.top;
		const safeDuration = Number.isFinite(duration)
			? Math.max(duration, 0)
			: this.DEFAULT_DURATION;

		animation.active = true;
		cache.isAnimating = true;
		// Animation coordinates represent the page's top scroll edge. The
		// viewport.current value is normally the viewport center and must not be
		// written directly to window.scrollY.
		animation.startPoint = state.viewport.top;
		animation.currentPoint = state.viewport.top;
		animation.targetPoint = safeTargetPoint;
		animation.duration = safeDuration;
		animation.startTime = performance.now();

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
		const spacing = state.page.pointSpacing > 0 ? state.page.pointSpacing : 1;

		animation.currentPoint = animation.startPoint
			+ (animation.targetPoint - animation.startPoint) * eased;

		window.scrollTo({
			top: animation.currentPoint * spacing,
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
		const topPoint = EngineScrollRuntime.get().getState().viewport.top;
		this.start(topPoint + (Number.isFinite(offset) ? offset : 0), duration);
	}
}
