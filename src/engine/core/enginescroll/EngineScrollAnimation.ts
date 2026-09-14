// ============================================================================
// EngineScrollAnimation.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import { EngineScrollBehavior } from "./EngineScrollBehavior";
import { EngineScrollBrowser } from "./EngineScrollBrowser";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import { BrowserScheduler } from "./browser/BrowserScheduler";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export class EngineScrollAnimation {
	private static readonly PROGRAMMATIC_SCROLL_GUARD_MS = 100;

	private static markProgrammaticScroll(duration = 0): void {
		const cache = EngineScrollRuntime.get().getCache();
		cache.programmaticScrollUntil = performance.now()
			+ Math.max(this.PROGRAMMATIC_SCROLL_GUARD_MS, duration);
	}

	public static isAnimating(): boolean {
		return EngineScrollRuntime.get().getState().animation.active;
	}

	public static isInterruptible(): boolean {
		const animation = EngineScrollRuntime.get().getState().animation;
		return animation.active && animation.interruptible;
	}

	public static start(
		targetPoint: number,
		options: number | EngineScrollMoveOptions = {},
	): void {
		const runtime = EngineScrollRuntime.get();
		const state = runtime.getMutableState();
		const animation = state.animation;
		const cache = runtime.getCache();
		const resolvedOptions: EngineScrollMoveOptions = typeof options === "number"
			? { duration: options }
			: options;
		const behaviorPolicy = EngineScrollBehavior.resolve(resolvedOptions);
		const safeTargetPoint = Number.isFinite(targetPoint)
			? targetPoint
			: state.viewport.top;
		const reducedMotion = EngineScrollBehavior.shouldReduce(behaviorPolicy);
		const safeDuration = reducedMotion || behaviorPolicy.behavior === "instant"
			? 0
			: behaviorPolicy.duration;

		animation.startPoint = state.viewport.top;
		animation.currentPoint = state.viewport.top;
		animation.targetPoint = safeTargetPoint;
		animation.duration = safeDuration;
		animation.startTime = performance.now();
		animation.easing = behaviorPolicy.easing;
		animation.interruptible = behaviorPolicy.interruptible;

		const spacing = state.page.pointSpacing > 0 ? state.page.pointSpacing : 1;

		if (safeDuration <= 0 || Math.abs(safeTargetPoint - state.viewport.top) < 0.0001) {
			this.markProgrammaticScroll();
			EngineScrollBrowser.scrollTo(safeTargetPoint * spacing);
			animation.currentPoint = safeTargetPoint;
			animation.active = false;
			cache.isAnimating = false;
			BrowserScheduler.request();
			return;
		}

		if (behaviorPolicy.behavior === "native") {
			this.markProgrammaticScroll(safeDuration);
			EngineScrollBrowser.scrollTo(
				safeTargetPoint * spacing,
				window.scrollX,
				"smooth",
			);
			animation.currentPoint = safeTargetPoint;
			animation.active = false;
			cache.isAnimating = false;
			BrowserScheduler.request();
			return;
		}

		animation.active = true;
		cache.isAnimating = true;
		BrowserScheduler.request();
	}

	public static stop(): void {
		const runtime = EngineScrollRuntime.get();
		runtime.getMutableState().animation.active = false;
		runtime.getCache().isAnimating = false;
	}

	public static interrupt(): boolean {
		if (!this.isInterruptible()) return false;
		const cache = EngineScrollRuntime.get().getCache();
		this.stop();
		cache.programmaticScrollUntil = 0;
		return true;
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
		const eased = EngineScrollEasing.resolve(animation.easing)(progress);
		const cache = runtime.getCache();
		const spacing = state.page.pointSpacing > 0 ? state.page.pointSpacing : 1;

		animation.currentPoint = animation.startPoint
			+ (animation.targetPoint - animation.startPoint) * eased;
		this.markProgrammaticScroll();
		EngineScrollBrowser.scrollTo(animation.currentPoint * spacing);

		if (progress < 1) return;
		animation.currentPoint = animation.targetPoint;
		animation.active = false;
		cache.isAnimating = false;
	}

	public static moveToCurrent(
		offset: number,
		options: number | EngineScrollMoveOptions = {},
	): void {
		const topPoint = EngineScrollRuntime.get().getState().viewport.top;
		this.start(topPoint + (Number.isFinite(offset) ? offset : 0), options);
	}
}
