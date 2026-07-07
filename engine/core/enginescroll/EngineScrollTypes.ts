// ============================================================================
// EngineScrollTypes.ts
// ============================================================================

/*
 * Engine Scroll
 *
 * Shared runtime types used by every EngineScroll subsystem.
 */

export type EngineScrollPoint = number;

export type EngineScrollSubscriber = (
	state: Readonly<EngineScrollState>,
) => void;

/* ========================================================================== */
/* Viewport                                                                   */
/* ========================================================================== */

export interface EngineViewport {

	/**
	 * First visible point.
	 */
	top: EngineScrollPoint;

	/**
	 * Current viewport point.
	 *
	 * Usually the center of the viewport.
	 */
	current: EngineScrollPoint;

	/**
	 * Last visible point.
	 */
	bottom: EngineScrollPoint;

}

/* ========================================================================== */
/* Page                                                                       */
/* ========================================================================== */

export interface EnginePage {

	/**
	 * Total available points.
	 */
	totalPoints: number;

	/**
	 * Pixels represented by one point.
	 */
	pointSpacing: number;

}

/* ========================================================================== */
/* Animation                                                                  */
/* ========================================================================== */

export interface EngineScrollAnimation {

	active: boolean;

	startPoint: EngineScrollPoint;

	targetPoint: EngineScrollPoint;

	currentPoint: EngineScrollPoint;

	startTime: number;

	duration: number;

}

/* ========================================================================== */
/* Runtime                                                                     */
/* ========================================================================== */

export interface EngineScrollRuntimeCache {

	scrollX: number;

	scrollY: number;

	documentWidth: number;

	documentHeight: number;

	viewportWidth: number;

	viewportHeight: number;

	devicePixelRatio: number;

	lastTimestamp: number;

	lastFrameTime: number;

	frame: number;

	rafId: number | null;

	pending: boolean;

	running: boolean;

    scrollVelocity: number;

    scrollDirection: -1 | 0 | 1;

    isUserScrolling: boolean;

    isAnimating: boolean;

    lastUserScrollTime: number;
}

/* ========================================================================== */
/* Public State                                                               */
/* ========================================================================== */

export interface EngineScrollState {

	initialized: boolean;

	viewport: EngineViewport;

	page: EnginePage;

	animation: EngineScrollAnimation;

}