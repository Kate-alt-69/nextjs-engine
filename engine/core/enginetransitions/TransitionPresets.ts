// ─────────────────────────────────────────────────────────────────────────────
// EngineTransitions — preset normalization and render values
// ─────────────────────────────────────────────────────────────────────────────

import {
	ENGINE_TRANSITIONS,
	type EngineTransitionInput,
	type EngineTransitionName,
	type EngineTransitionOptions,
	type EngineTransitionRunContext,
} from "./TransitionTypes";

const PRESET_SET = new Set<string>(ENGINE_TRANSITIONS);

const ALIASES: Record<string, EngineTransitionName> = {
	"page-to-page": "fade",
	scale: "zoom",
	"shared-morph": "morph",
	"flip-layout": "layout",
	"reveal-mask": "reveal",
	"pixel-dissolve": "pixel",
	"noise-dissolve": "dissolve",
	"liquid-warp": "liquid",
	"motion-smear": "smear",
	"depth-push": "depth",
	"card-flip": "flip",
	"elastic-spring": "spring",
	"scatter-assemble": "scatter",
	"chromatic-shift": "rgb",
};

const DEFAULT_DURATION: Record<EngineTransitionName, number> = {
	fade: 320,
	slide: 420,
	zoom: 380,
	morph: 480,
	layout: 420,
	reveal: 520,
	wipe: 460,
	split: 520,
	curtain: 560,
	pixel: 500,
	dissolve: 520,
	liquid: 620,
	smear: 440,
	depth: 520,
	flip: 560,
	"page-turn": 680,
	spring: 620,
	scatter: 560,
	rgb: 420,
	portal: 620,
};

export interface ResolvedEngineTransition {
	type: EngineTransitionName | "instant";
	requestedType: string;
	duration: number;
	easing: string;
	shared: string[];
	cssVariables: Record<string, string>;
	pixelated: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function finite(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOptions(input: EngineTransitionInput | undefined): EngineTransitionOptions {
	if (!input) return { type: "fade" };
	if (typeof input === "string") return { type: input };
	return input;
}

export function normalizeEngineTransitionType(type: string): EngineTransitionName | "instant" {
	if (type === "instant") return "instant";
	if (PRESET_SET.has(type)) return type as EngineTransitionName;
	return ALIASES[type] ?? "fade";
}

function normalizeEasing(value: EngineTransitionOptions["easing"], type: EngineTransitionName): string {
	if (value === "spring" || (!value && type === "spring")) {
		return "linear(0, 0.009 1%, 0.035 2.1%, 0.141 4.6%, 0.723 12.9%, 0.938 16.7%, 1.017 20.4%, 1.077 24.8%, 1.089 27.8%, 1.085 31.6%, 1.022 43.1%, 0.997 51%, 0.99 59.7%, 1.001 81.4%, 1)";
	}
	return value ?? "cubic-bezier(.22, .61, .36, 1)";
}

function normalizeShared(value: EngineTransitionOptions["shared"]): string[] {
	if (!value) return [];
	const entries = Array.isArray(value) ? value : [value];
	return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))];
}

function resolveOrigin(
	options: EngineTransitionOptions,
	context: EngineTransitionRunContext,
): string {
	if (options.origin === "pointer" && context.pointer) {
		return `${Math.round(context.pointer.x)}px ${Math.round(context.pointer.y)}px`;
	}
	if (!options.origin && context.pointer && (options.type === "portal" || options.type === "reveal")) {
		return `${Math.round(context.pointer.x)}px ${Math.round(context.pointer.y)}px`;
	}
	if (!options.origin || options.origin === "center" || options.origin === "pointer") return "50% 50%";
	return options.origin;
}

function directionValues(direction: EngineTransitionOptions["direction"], distance: number) {
	switch (direction ?? "right") {
		case "left":
			return { oldX: `${distance}px`, oldY: "0px", newX: `${-distance}px`, newY: "0px" };
		case "up":
			return { oldX: "0px", oldY: `${distance}px`, newX: "0px", newY: `${-distance}px` };
		case "down":
			return { oldX: "0px", oldY: `${-distance}px`, newX: "0px", newY: `${distance}px` };
		case "right":
		default:
			return { oldX: `${-distance}px`, oldY: "0px", newX: `${distance}px`, newY: "0px" };
	}
}

function wipeStart(direction: EngineTransitionOptions["direction"]): string {
	switch (direction ?? "right") {
		case "left": return "inset(0 0 0 100%)";
		case "up": return "inset(100% 0 0 0)";
		case "down": return "inset(0 0 100% 0)";
		case "right":
		default: return "inset(0 100% 0 0)";
	}
}

function pageTurnOrigin(direction: EngineTransitionOptions["direction"]): string {
	switch (direction ?? "right") {
		case "left": return "right center";
		case "up": return "center bottom";
		case "down": return "center top";
		case "right":
		default: return "left center";
	}
}

function isVertical(direction: EngineTransitionOptions["direction"]): boolean {
	return direction === "up" || direction === "down";
}

export function resolveEngineTransition(
	input: EngineTransitionInput | undefined,
	context: EngineTransitionRunContext = {},
): ResolvedEngineTransition {
	const options = normalizeOptions(input);
	const requestedType = String(options.type || "fade");
	const type = normalizeEngineTransitionType(requestedType);

	if (type === "instant") {
		return {
			type,
			requestedType,
			duration: 0,
			easing: "linear",
			shared: normalizeShared(options.shared),
			cssVariables: {},
			pixelated: false,
		};
	}

	const config = options.config ?? {};
	const strength = clamp(finite(options.strength, 1), 0, 4);
	const duration = clamp(finite(options.duration, DEFAULT_DURATION[type]), 0, 5000);
	const distance = clamp(finite(config.distance, 84) * Math.max(strength, 0.01), 0, 2000);
	const blur = clamp(finite(config.blur, 10) * strength, 0, 80);
	const scale = clamp(finite(config.scale, 0.92), 0.1, 3);
	const rotation = clamp(finite(config.rotation, 10) * strength, -360, 360);
	const depth = clamp(finite(config.depth, 180) * strength, 0, 2000);
	const perspective = clamp(finite(config.perspective, 1000), 100, 5000);
	const pixelSize = clamp(finite(config.pixelSize, 8), 1, 64);
	const pixelSteps = clamp(Math.round(48 / pixelSize), 3, 16);
	const direction = directionValues(options.direction, distance);
	const axis = config.axis ?? (isVertical(options.direction) ? "x" : "y");
	const flipSign = options.direction === "left" || options.direction === "up" ? -1 : 1;
	const splitStart = axis === "x" ? "inset(50% 0 50% 0)" : "inset(0 50% 0 50%)";
	const curtainStart = axis === "x" ? "inset(0 50% 0 50%)" : "inset(50% 0 50% 0)";
	const smearX = isVertical(options.direction) ? 0.94 : 1 + 0.18 * strength;
	const smearY = isVertical(options.direction) ? 1 + 0.18 * strength : 0.94;

	const animationNames: Record<EngineTransitionName, [string, string]> = {
		fade: ["e-vt-fade-old", "e-vt-fade-new"],
		slide: ["e-vt-slide-old", "e-vt-slide-new"],
		zoom: ["e-vt-zoom-old", "e-vt-zoom-new"],
		morph: ["e-vt-morph-old", "e-vt-morph-new"],
		layout: ["e-vt-hold", "e-vt-hold"],
		reveal: ["e-vt-hold", "e-vt-reveal-new"],
		wipe: ["e-vt-wipe-old", "e-vt-wipe-new"],
		split: ["e-vt-split-old", "e-vt-split-new"],
		curtain: ["e-vt-curtain-old", "e-vt-curtain-new"],
		pixel: ["e-vt-pixel-old", "e-vt-pixel-new"],
		dissolve: ["e-vt-dissolve-old", "e-vt-dissolve-new"],
		liquid: ["e-vt-liquid-old", "e-vt-liquid-new"],
		smear: ["e-vt-smear-old", "e-vt-smear-new"],
		depth: ["e-vt-depth-old", "e-vt-depth-new"],
		flip: axis === "x"
			? ["e-vt-flip-x-old", "e-vt-flip-x-new"]
			: ["e-vt-flip-y-old", "e-vt-flip-y-new"],
		"page-turn": axis === "x"
			? ["e-vt-page-x-old", "e-vt-page-x-new"]
			: ["e-vt-page-y-old", "e-vt-page-y-new"],
		spring: ["e-vt-spring-old", "e-vt-spring-new"],
		scatter: ["e-vt-scatter-old", "e-vt-scatter-new"],
		rgb: ["e-vt-rgb-old", "e-vt-rgb-new"],
		portal: ["e-vt-portal-old", "e-vt-portal-new"],
	};

	const [oldAnimation, newAnimation] = animationNames[type];
	const origin = type === "page-turn" ? pageTurnOrigin(options.direction) : resolveOrigin(options, context);
	const easing = type === "pixel" ? `steps(${pixelSteps}, end)` : normalizeEasing(options.easing, type);

	return {
		type,
		requestedType,
		duration,
		easing,
		shared: normalizeShared(options.shared),
		pixelated: type === "pixel",
		cssVariables: {
			"--e-vt-duration": `${duration}ms`,
			"--e-vt-easing": easing,
			"--e-vt-old-animation": oldAnimation,
			"--e-vt-new-animation": newAnimation,
			"--e-vt-origin": origin,
			"--e-vt-old-x": direction.oldX,
			"--e-vt-old-y": direction.oldY,
			"--e-vt-new-x": direction.newX,
			"--e-vt-new-y": direction.newY,
			"--e-vt-blur": `${blur}px`,
			"--e-vt-scale": String(scale),
			"--e-vt-rotation": `${rotation}deg`,
			"--e-vt-depth": `${depth}px`,
			"--e-vt-perspective": `${perspective}px`,
			"--e-vt-wipe-start": wipeStart(options.direction),
			"--e-vt-split-start": splitStart,
			"--e-vt-curtain-start": curtainStart,
			"--e-vt-flip-angle": `${90 * flipSign}deg`,
			"--e-vt-page-angle": `${105 * flipSign}deg`,
			"--e-vt-smear-x": String(smearX),
			"--e-vt-smear-y": String(smearY),
			"--e-vt-rgb-offset": `${clamp(finite(config.offset, 7) * strength, 0, 40)}px`,
			"--e-vt-scatter-distance": `${clamp(finite(config.spread, 36) * strength, 0, 240)}px`,
		},
	};
}

export function isKnownEngineTransition(type: string): boolean {
	return type === "instant" || PRESET_SET.has(type) || Object.prototype.hasOwnProperty.call(ALIASES, type);
}
