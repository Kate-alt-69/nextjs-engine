// ============================================================================
// EngineScrollAnimation.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import { BrowserScheduler } from "./browser/BrowserScheduler";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export class EngineScrollAnimation {
	private static readonly DEFAULT_DURATION = 550;

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
		const safeTargetPoint = Number.isFinite(targetPoint)
			? targetPoint
			: state.viewport.top;
		const requestedDuration = Number.isFinite(resolvedOptions.duration)
			? Math.max(0, resolvedOptions.duration!)
			: this.DEFAULT_DURATION;
		const reducedMotion = resolvedOptions.respectReducedMotion !== false
			&& typeof window !== "undefined"
			&& typeof window.matchMedia === "function"
			&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const safeDuration = reducedMotion ? 0 : requestedDuration;

		animation.startPoint = state.viewport.top;
		animation.currentPoint = state.viewport.top;
		animation.targetPoint = safeTargetPoint;
		animation.duration = safeDuration;
		animation.startTime = performance.now();
		animation.easing = resolvedOptions.easing ?? "easeInOutCubic";
		animation.interruptible = resolvedOptions.interruptible !== false;

		if (safeDuration <= 0 || Math.abs(safeTargetPoint - state.viewport.top) < 0.0001) {
			const spacing = state.page.pointSpacing > 0 ? state.page.pointSpacing : 1;
			window.scrollTo({
				top: safeTargetPoint * spacing,
				left: window.scrollX,
				behavior: "auto",
			});
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
		this.stop();
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
		window.scrollTo({
			top: animation.currentPoint * spacing,
			left: window.scrollX,
			behavior: "auto",
		});

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
