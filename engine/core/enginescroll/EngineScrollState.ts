// ============================================================================
// EngineScrollState.ts
// ============================================================================

import type {
	EngineScrollRuntimeCache,
	EngineScrollState,
} from "./EngineScrollTypes";

/* ========================================================================== */
/* Public Runtime State                                                       */
/* ========================================================================== */

export const DefaultEngineScrollState: EngineScrollState = {

	initialized: false,

	viewport: {

		top: 0,

		current: 0,

		bottom: 0,

	},

	page: {

		totalPoints: 0,

		pointSpacing: 7,

	},

	animation: {

		active: false,

		startPoint: 0,

		targetPoint: 0,

		currentPoint: 0,

		startTime: 0,

		duration: 0,

	},

};

/* ========================================================================== */
/* Private Runtime Cache                                                      */
/* ========================================================================== */

export const DefaultEngineScrollCache: EngineScrollRuntimeCache = {

	scrollY: 0,

	scrollX: 0,

	viewportHeight: 0,

	documentHeight: 0,

	lastTimestamp: 0,

	lastFrameTime: 0,

	frame: 0,

	rafId: null,

	pending: false,

	running: false,

    documentWidth: 0,

    viewportWidth: 0,

    devicePixelRatio: 1,

    scrollVelocity: 0,

    scrollDirection: 0,

    isUserScrolling: false,

    isAnimating: false,

    lastUserScrollTime: 0,
};