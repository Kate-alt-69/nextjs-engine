// ─────────────────────────────────────────────────────────────────────────────
// EngineTransitions — public transition types
// ─────────────────────────────────────────────────────────────────────────────

export const ENGINE_TRANSITIONS = [
	"fade",
	"slide",
	"zoom",
	"morph",
	"layout",
	"reveal",
	"wipe",
	"split",
	"curtain",
	"pixel",
	"dissolve",
	"liquid",
	"smear",
	"depth",
	"flip",
	"page-turn",
	"spring",
	"scatter",
	"rgb",
	"portal",
] as const;

export type EngineTransitionName = typeof ENGINE_TRANSITIONS[number];

export type EngineTransitionAlias =
	| "page-to-page"
	| "scale"
	| "shared-morph"
	| "flip-layout"
	| "reveal-mask"
	| "pixel-dissolve"
	| "noise-dissolve"
	| "liquid-warp"
	| "motion-smear"
	| "depth-push"
	| "card-flip"
	| "elastic-spring"
	| "scatter-assemble"
	| "chromatic-shift";

export type EngineTransitionDirection = "left" | "right" | "up" | "down";
export type EngineTransitionAxis = "x" | "y";
export type EngineTransitionShape = "circle" | "rect" | "diagonal";

export type EngineTransitionEasing =
	| "ease"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "linear"
	| "spring"
	| (string & {});

/**
 * Extra knobs used by specific presets. Unknown fields are intentionally not
 * accepted here so editor autocomplete stays useful and mistakes are caught.
 */
export interface EngineTransitionConfig {
	from?: number;
	to?: number;
	distance?: number;
	overshoot?: number;
	scale?: number;
	blur?: number;
	rotation?: number;
	angle?: number;
	axis?: EngineTransitionAxis;
	shape?: EngineTransitionShape;
	softness?: number;
	invert?: boolean;
	pixelSize?: number;
	randomness?: number;
	threshold?: number;
	noiseScale?: number;
	edgeGlow?: number;
	frequency?: number;
	speed?: number;
	samples?: number;
	velocityScale?: number;
	decay?: number;
	depth?: number;
	perspective?: number;
	pieces?: number;
	gap?: number;
	panels?: number;
	overlap?: number;
	delay?: number;
	stiffness?: number;
	damping?: number;
	mass?: number;
	spread?: number;
	gravity?: number;
	offset?: number;
	intensity?: number;
	curl?: number;
	shadow?: number;
	backface?: boolean;
}

export interface EngineTransitionOptions {
	type: EngineTransitionName | EngineTransitionAlias | "instant" | (string & {});
	/** Milliseconds. Values are clamped to 0–5000. */
	duration?: number;
	easing?: EngineTransitionEasing;
	direction?: EngineTransitionDirection;
	/** General 0+ effect multiplier. Individual presets may interpret it differently. */
	strength?: number;
	/** "center", "pointer", or a CSS transform-origin such as "20% 70%". */
	origin?: "center" | "pointer" | (string & {});
	/** DOM ids to keep visually connected across the change. */
	shared?: string | string[];
	config?: EngineTransitionConfig;
}

export type EngineTransitionInput =
	| EngineTransitionName
	| EngineTransitionAlias
	| "instant"
	| (string & {})
	| EngineTransitionOptions;

export interface EngineTransitionPointer {
	x: number;
	y: number;
}

export interface EngineTransitionRunContext {
	pointer?: EngineTransitionPointer;
}

export interface EngineTransitionsController {
	run: (
		update: () => void | Promise<void>,
		transition?: EngineTransitionInput,
	) => Promise<void>;
	push: (
		href: string,
		transition?: EngineTransitionInput,
		context?: EngineTransitionRunContext,
	) => Promise<void>;
	replace: (
		href: string,
		transition?: EngineTransitionInput,
		context?: EngineTransitionRunContext,
	) => Promise<void>;
}
