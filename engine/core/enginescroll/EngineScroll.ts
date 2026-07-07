// ============================================================================
// EngineScroll.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

import { BrowserEvents } from "./browser/BrowserEvents";

import { Viewport } from "./viewport/Viewport";

import { EngineScrollAnimation } from "./EngineScrollAnimation";

import { EngineScrollMovement } from "./EngineScrollMovement";

import { EngineScrollHash } from "./EngineScrollHash";

import { EngineScrollBrowser } from "./EngineScrollBrowser";

import { EngineScrollPhysics } from "./EngineScrollPhysics";

import { EngineScrollObserver } from "./EngineScrollObserver";

import { EngineScrollNavigator } from "./EngineScrollNavigator";

const EngineScrollViewport = Viewport;

export class EngineScroll {

	private static initialized = false;

	// -------------------------------------------------------------------------

	public static initialize(): void {

		if (
			this.initialized ||
			typeof window === "undefined"
		) {
			return;
		}

		this.initialized = true;

		const runtime =
			EngineScrollRuntime.get();

		runtime.initialize();

		BrowserEvents.initialize(
			this.update,
		);

		this.update();

	}

	// -------------------------------------------------------------------------

private static update = (): void => {

	const runtime =
		EngineScrollRuntime.get();

	const cache =
		runtime.getCache();

	EngineScrollBrowser.update();

	EngineScrollViewport.update();

	EngineScrollPhysics.update(
		cache.lastFrameTime,
	);
	EngineScrollAnimation.update(
		cache.lastTimestamp,
	);
	EngineScrollObserver.update();
	runtime.notify();
};

	// -------------------------------------------------------------------------

	public static runtime(): EngineScrollRuntime {

		return EngineScrollRuntime.get();

	}

	// -------------------------------------------------------------------------

	public static state() {

		return this.runtime().getState();

	}

	// -------------------------------------------------------------------------

	public static subscribe =(callback: Parameters<EngineScrollRuntime["subscribe"]>[0]) =>this.runtime().subscribe(callback);

    // -------------------------------------------------------------------------

    public static move(
    	target: Parameters<
    		typeof EngineScrollNavigator.move
    	>[0],
    	offset?: number,
    	duration?: number,
    ): boolean {
    
    	return EngineScrollNavigator.move(
        
    		target,
        
    		offset,
        
    		duration,
        
    	);
    
    }

    public static moveBy =
    	EngineScrollMovement.moveBy;

    public static movePercent =
    	EngineScrollMovement.movePercent;

    public static top =
    	EngineScrollMovement.top;

    public static bottom =
    	EngineScrollMovement.bottom;

    public static stop =
    	EngineScrollMovement.stop;

    public static moveToHash =
    	EngineScrollHash.moveToHash;

    // -------------------------------------------------------------------------

    public static currentPoint(): number {

    	return this.state()
    		.viewport
    		.current;

    }

    // -------------------------------------------------------------------------

    public static totalPoints(): number {

    	return this.state()
    		.page
    		.totalPoints;

    }

    // -------------------------------------------------------------------------

    public static viewport() {

    	return this.state()
    		.viewport;

    }

    // -------------------------------------------------------------------------

    public static animation() {

    	return this.state()
    		.animation;

    }
    // -------------------------------------------------------------------------

    public static velocity(): number {

    	return this.runtime()
    		.getCache()
    		.scrollVelocity;

    }

    // -------------------------------------------------------------------------

    public static direction(): -1 | 0 | 1 {

    	return this.runtime()
    		.getCache()
    		.scrollDirection;

    }

    // -------------------------------------------------------------------------

    public static isAnimating(): boolean {

    	return this.runtime()
    		.getCache()
    		.isAnimating;

    }

    // -------------------------------------------------------------------------
}