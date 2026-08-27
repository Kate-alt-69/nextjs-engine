// ============================================================================
// EngineScroll.ts
// ============================================================================

import { EngineScrollAnimation } from "./EngineScrollAnimation";
import { EngineScrollBrowser } from "./EngineScrollBrowser";
import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollObserver } from "./EngineScrollObserver";
import { EngineScrollPhysics } from "./EngineScrollPhysics";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import { EngineScrollTimeline } from "./EngineScrollTimeline";
import { BrowserEvents } from "./browser/BrowserEvents";
import { Viewport } from "./viewport/Viewport";
import type { EngineScrollTimelineConfig } from "./EngineScrollTimeline";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export class EngineScroll {
	private static initialized = false;

	public static initialize(): void {
		if (this.initialized || typeof window === "undefined") return;
		this.initialized = true;
		const runtime = EngineScrollRuntime.get();
		runtime.initialize();
		BrowserEvents.initialize(this.update);
		this.update();
	}

	private static update = (): void => {
		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();
		EngineScrollBrowser.update();
		Viewport.update();
		EngineScrollPhysics.update(cache.lastFrameTime);
		EngineScrollAnimation.update(cache.lastTimestamp);
		EngineScrollObserver.update();
		runtime.notify();
	};

	public static runtime(): EngineScrollRuntime {
		return EngineScrollRuntime.get();
	}

	public static state() {
		return this.runtime().getState();
	}

	public static subscribe = (
		callback: Parameters<EngineScrollRuntime["subscribe"]>[0],
	) => this.runtime().subscribe(callback);

	public static timeline(config: EngineScrollTimelineConfig): EngineScrollTimeline {
		this.initialize();
		return new EngineScrollTimeline(config);
	}

	public static move(
		target: Parameters<typeof EngineScrollNavigator.move>[0],
		offsetOrOptions?: number | EngineScrollMoveOptions,
		duration?: number,
	): boolean {
		return EngineScrollNavigator.move(target, offsetOrOptions, duration);
	}

	public static nearest(options?: EngineScrollMoveOptions): boolean {
		return EngineScrollNavigator.nearest(options);
	}

	public static next(options?: EngineScrollMoveOptions & { wrap?: boolean }): boolean {
		return EngineScrollNavigator.next(options);
	}

	public static previous(options?: EngineScrollMoveOptions & { wrap?: boolean }): boolean {
		return EngineScrollNavigator.previous(options);
	}

	public static moveBy(offset: number, options?: number | EngineScrollMoveOptions): void {
		EngineScrollMovement.moveBy(offset, options);
	}

	public static movePercent(percent: number, options?: number | EngineScrollMoveOptions): void {
		EngineScrollMovement.movePercent(percent, options);
	}

	public static top(options?: number | EngineScrollMoveOptions): void {
		EngineScrollMovement.top(options);
	}

	public static bottom(options?: number | EngineScrollMoveOptions): void {
		EngineScrollMovement.bottom(options);
	}

	public static stop(): void {
		EngineScrollMovement.stop();
	}

	public static moveToHash(hash: string, duration?: number, offset?: number): boolean {
		return EngineScrollHash.moveToHash(hash, duration, offset);
	}

	public static currentPoint(): number {
		return this.state().viewport.current;
	}

	public static totalPoints(): number {
		return this.state().page.totalPoints;
	}

	public static viewport() {
		return this.state().viewport;
	}

	public static animation() {
		return this.state().animation;
	}

	public static velocity(): number {
		return this.runtime().getCache().scrollVelocity;
	}

	public static direction(): -1 | 0 | 1 {
		return this.runtime().getCache().scrollDirection;
	}

	public static isAnimating(): boolean {
		return this.runtime().getCache().isAnimating;
	}

	public static points(): typeof EngineScrollPointManager {
		return EngineScrollPointManager;
	}
}
