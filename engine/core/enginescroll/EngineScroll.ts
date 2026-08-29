// ============================================================================
// EngineScroll.ts
// ============================================================================

import { EngineScrollAnimation } from "./EngineScrollAnimation";
import { EngineScrollBrowser } from "./EngineScrollBrowser";
import {
	EngineScrollDirector,
	type EngineScrollDirectorConfig,
} from "./EngineScrollDirector";
import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollObserver } from "./EngineScrollObserver";
import { EngineScrollPhysics } from "./EngineScrollPhysics";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollPointTracker } from "./EngineScrollPointTracker";
import { EngineScrollRange } from "./EngineScrollRange";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import { EngineScrollSnap } from "./EngineScrollSnap";
import { EngineScrollTimeline } from "./EngineScrollTimeline";
import { BrowserEvents } from "./browser/BrowserEvents";
import { BrowserScheduler } from "./browser/BrowserScheduler";
import { Viewport } from "./viewport/Viewport";
import {
	ViewportPoints,
	type EngineScrollViewportFocus,
} from "./viewport/ViewportPoints";
import type {
	EngineScrollNavigationOptions,
} from "./EngineScrollNavigator";
import type { EngineScrollPointTrackerConfig } from "./EngineScrollPointTracker";
import type { EngineScrollRangeConfig } from "./EngineScrollRange";
import type { EngineScrollSnapOptions } from "./EngineScrollSnap";
import type { EngineScrollTimelineConfig } from "./EngineScrollTimeline";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export class EngineScroll {
	private static initialized = false;

	public static initialize(): void {
		if (this.initialized || typeof window === "undefined") return;
		this.initialized = true;
		const runtime = EngineScrollRuntime.get();
		runtime.initialize();
		EngineScrollBrowser.initialize();
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

	public static range(config: EngineScrollRangeConfig): EngineScrollRange {
		this.initialize();
		return new EngineScrollRange(config);
	}

	public static timeline(config: EngineScrollTimelineConfig): EngineScrollTimeline {
		this.initialize();
		return new EngineScrollTimeline(config);
	}

	public static direct<const TConfig extends EngineScrollDirectorConfig>(
		config: TConfig,
	): EngineScrollDirector<TConfig> {
		this.initialize();
		return new EngineScrollDirector(config);
	}

	public static trackPoints(
		config: EngineScrollPointTrackerConfig = {},
	): EngineScrollPointTracker {
		this.initialize();
		return new EngineScrollPointTracker(config);
	}

	public static move(
		target: Parameters<typeof EngineScrollNavigator.move>[0],
		offsetOrOptions?: number | EngineScrollNavigationOptions,
		duration?: number,
	): boolean {
		this.initialize();
		return EngineScrollNavigator.move(target, offsetOrOptions, duration);
	}

	public static nearest(options?: EngineScrollNavigationOptions): boolean {
		this.initialize();
		return EngineScrollNavigator.nearest(options);
	}

	public static next(
		options?: EngineScrollNavigationOptions & { wrap?: boolean },
	): boolean {
		this.initialize();
		return EngineScrollNavigator.next(options);
	}

	public static previous(
		options?: EngineScrollNavigationOptions & { wrap?: boolean },
	): boolean {
		this.initialize();
		return EngineScrollNavigator.previous(options);
	}

	public static snap(options?: EngineScrollSnapOptions): boolean {
		this.initialize();
		return EngineScrollSnap.now(options);
	}

	public static enableSnap(options?: EngineScrollSnapOptions): () => void {
		this.initialize();
		return EngineScrollSnap.enable(options);
	}

	public static disableSnap(): void {
		EngineScrollSnap.disable();
	}

	public static isSnapEnabled(): boolean {
		return EngineScrollSnap.isEnabled();
	}

	public static setFocus(focus: EngineScrollViewportFocus): void {
		ViewportPoints.setFocus(focus);
		this.initialize();
		BrowserScheduler.request(this.update);
	}

	public static getFocus(): number {
		return ViewportPoints.getFocus();
	}

	public static getFocusMode(): EngineScrollViewportFocus {
		return ViewportPoints.getFocusMode();
	}

	public static moveBy(offset: number, options?: number | EngineScrollMoveOptions): void {
		this.initialize();
		EngineScrollMovement.moveBy(offset, options);
	}

	public static movePercent(percent: number, options?: number | EngineScrollMoveOptions): void {
		this.initialize();
		EngineScrollMovement.movePercent(percent, options);
	}

	public static top(options?: number | EngineScrollMoveOptions): void {
		this.initialize();
		EngineScrollMovement.top(options);
	}

	public static bottom(options?: number | EngineScrollMoveOptions): void {
		this.initialize();
		EngineScrollMovement.bottom(options);
	}

	public static stop(): void {
		EngineScrollMovement.stop();
	}

	public static moveToHash(hash: string, duration?: number, offset?: number): boolean {
		this.initialize();
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
