// ============================================================================
// EngineScrollTypes.ts
// ============================================================================

export type EngineScrollPoint = number;
export type EngineScrollDirection = -1 | 0 | 1;
export type EngineScrollAlignment = "start" | "center" | "end" | "nearest";
export type EngineScrollEasingName =
	| "linear"
	| "easeInQuad"
	| "easeOutQuad"
	| "easeInOutQuad"
	| "easeInCubic"
	| "easeOutCubic"
	| "easeInOutCubic";

export interface EngineScrollMoveOptions {
	offset?: number;
	duration?: number;
	easing?: EngineScrollEasingName;
	align?: EngineScrollAlignment;
	interruptible?: boolean;
	respectReducedMotion?: boolean;
}

export type EngineScrollSubscriber = (
	state: Readonly<EngineScrollState>,
) => void;

export interface EngineViewport {
	top: EngineScrollPoint;
	current: EngineScrollPoint;
	bottom: EngineScrollPoint;
}

export interface EnginePage {
	totalPoints: number;
	pointSpacing: number;
}

export interface EngineScrollAnimation {
	active: boolean;
	startPoint: EngineScrollPoint;
	targetPoint: EngineScrollPoint;
	currentPoint: EngineScrollPoint;
	startTime: number;
	duration: number;
	easing: EngineScrollEasingName;
	interruptible: boolean;
}

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
	scrollDirection: EngineScrollDirection;
	isUserScrolling: boolean;
	isAnimating: boolean;
	lastUserScrollTime: number;
}

export interface EngineScrollState {
	initialized: boolean;
	viewport: EngineViewport;
	page: EnginePage;
	animation: EngineScrollAnimation;
}
