"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngineTransitions — native View Transition runtime + legacy browser fallback
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
	isKnownEngineTransition,
	resolveEngineTransition,
	type ResolvedEngineTransition,
} from "./TransitionPresets";
import {
	isExactTransitionLocation,
	safeSharedTransitionName,
	scaleTransitionCssValue,
} from "./TransitionCompatibility";
import type {
	EngineTransitionInput,
	EngineTransitionRunContext,
	EngineTransitionsController,
} from "./TransitionTypes";

interface EngineViewTransition {
	finished: Promise<void>;
	ready: Promise<void>;
	updateCallbackDone: Promise<void>;
	skipTransition?: () => void;
}

type EngineTransitionDocument = Document & {
	startViewTransition?: (updateCallback: () => void | Promise<void>) => EngineViewTransition;
};

type PseudoAnimationOptions = KeyframeAnimationOptions & { pseudoElement: string };

const STYLE_ID = "__engine_transitions__";
const BASE_CSS = `
::view-transition-image-pair(root) { isolation: auto; }
::view-transition-old(root),
::view-transition-new(root) {
	animation: none;
	mix-blend-mode: normal;
	backface-visibility: hidden;
}
::view-transition-old(*),
::view-transition-new(*) { mix-blend-mode: normal; }
@media (prefers-reduced-motion: reduce) {
	::view-transition-old(root),
	::view-transition-new(root) { animation-duration: 1ms !important; }
}
`;

let activeTransition: EngineViewTransition | null = null;
let activeToken = 0;
let activeCleanup: (() => void) | null = null;

function ensureTransitionStyles(): void {
	if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
	const styleElement = document.createElement("style");
	styleElement.id = STYLE_ID;
	styleElement.textContent = BASE_CSS;
	document.head.appendChild(styleElement);
}

function reducedMotionEnabled(): boolean {
	return typeof window !== "undefined"
		&& typeof window.matchMedia === "function"
		&& window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createSharedManager(ids: string[]) {
	const touched = new Set<HTMLElement>();
	const restoreActions: Array<() => void> = [];

	const apply = (): void => {
		for (const id of ids) {
			const element = document.getElementById(id);
			if (!(element instanceof HTMLElement) || touched.has(element)) continue;
			touched.add(element);
			const previous = element.style.getPropertyValue("view-transition-name");
			element.style.setProperty("view-transition-name", safeSharedTransitionName(id));
			restoreActions.push(() => {
				if (previous) element.style.setProperty("view-transition-name", previous);
				else element.style.removeProperty("view-transition-name");
			});
		}
	};

	const restore = (): void => {
		for (const restoreAction of restoreActions.splice(0)) restoreAction();
		touched.clear();
	};

	return { apply, restore };
}

function warnUnknownTransition(resolved: ResolvedEngineTransition): void {
	if (process.env.NODE_ENV === "production" || isKnownEngineTransition(resolved.requestedType)) return;
	console.warn(`[EngineTransitions] Unknown transition "${resolved.requestedType}". Falling back to "fade".`);
}

function variable(resolved: ResolvedEngineTransition, name: string, fallback: string): string {
	return resolved.cssVariables[name] ?? fallback;
}

interface TransitionFrames {
	old: Keyframe[];
	fresh: Keyframe[];
}

function buildTransitionFrames(resolved: ResolvedEngineTransition): TransitionFrames {
	const oldX = variable(resolved, "--e-vt-old-x", "-84px");
	const oldY = variable(resolved, "--e-vt-old-y", "0px");
	const newX = variable(resolved, "--e-vt-new-x", "84px");
	const newY = variable(resolved, "--e-vt-new-y", "0px");
	const blur = variable(resolved, "--e-vt-blur", "10px");
	const scale = variable(resolved, "--e-vt-scale", ".92");
	const rotation = variable(resolved, "--e-vt-rotation", "10deg");
	const depth = variable(resolved, "--e-vt-depth", "180px");
	const perspective = variable(resolved, "--e-vt-perspective", "1000px");
	const wipeStart = variable(resolved, "--e-vt-wipe-start", "inset(0 100% 0 0)");
	const splitStart = variable(resolved, "--e-vt-split-start", "inset(0 50% 0 50%)");
	const curtainStart = variable(resolved, "--e-vt-curtain-start", "inset(50% 0 50% 0)");
	const flipAngle = variable(resolved, "--e-vt-flip-angle", "90deg");
	const pageAngle = variable(resolved, "--e-vt-page-angle", "105deg");
	const smearX = variable(resolved, "--e-vt-smear-x", "1.18");
	const smearY = variable(resolved, "--e-vt-smear-y", ".94");
	const rgbOffset = variable(resolved, "--e-vt-rgb-offset", "7px");
	const scatter = variable(resolved, "--e-vt-scatter-distance", "36px");
	const origin = variable(resolved, "--e-vt-origin", "50% 50%");
	const axisX = variable(resolved, "--e-vt-old-y", "0px") !== "0px";
	const inverseRotation = scaleTransitionCssValue(rotation, -1, "-10deg");
	const inverseDepth = scaleTransitionCssValue(depth, -1, "-180px");
	const inverseFlip = scaleTransitionCssValue(flipAngle, -1, "-90deg");
	const inversePage = scaleTransitionCssValue(pageAngle, -1, "-105deg");
	const inverseRgb = scaleTransitionCssValue(rgbOffset, -1, "-7px");
	const halfRgb = scaleTransitionCssValue(rgbOffset, 0.5, "3.5px");
	const inverseHalfRgb = scaleTransitionCssValue(rgbOffset, -0.5, "-3.5px");
	const scatterNeg = scaleTransitionCssValue(scatter, -1, "-36px");
	const scatterNeg35 = scaleTransitionCssValue(scatter, -0.35, "-12.6px");
	const scatter20 = scaleTransitionCssValue(scatter, 0.2, "7.2px");
	const scatterNeg15 = scaleTransitionCssValue(scatter, -0.15, "-5.4px");

	switch (resolved.type) {
		case "slide": return {
			old: [{ opacity: 1, transform: "translate3d(0,0,0)" }, { opacity: .12, transform: `translate3d(${oldX},${oldY},0)` }],
			fresh: [{ opacity: .12, transform: `translate3d(${newX},${newY},0)` }, { opacity: 1, transform: "translate3d(0,0,0)" }],
		};
		case "zoom": return {
			old: [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: `scale(${scale})` }],
			fresh: [{ opacity: 0, transform: `scale(${scale})` }, { opacity: 1, transform: "scale(1)" }],
		};
		case "morph": return {
			old: [{ opacity: 1, filter: "blur(0)", transform: "scale(1)" }, { opacity: .32, filter: "blur(2px)", transform: "scale(.985)" }],
			fresh: [{ opacity: .32, filter: "blur(2px)", transform: "scale(1.015)" }, { opacity: 1, filter: "blur(0)", transform: "scale(1)" }],
		};
		case "layout": return { old: [{ opacity: 1 }, { opacity: .94 }], fresh: [{ opacity: .94 }, { opacity: 1 }] };
		case "reveal": return {
			old: [{ opacity: 1 }, { opacity: .45 }],
			fresh: [{ opacity: .9, clipPath: `circle(0% at ${origin})` }, { opacity: 1, clipPath: `circle(150% at ${origin})` }],
		};
		case "wipe": return { old: [{ opacity: 1 }, { opacity: .2 }], fresh: [{ clipPath: wipeStart }, { clipPath: "inset(0 0 0 0)" }] };
		case "split": return {
			old: [{ filter: "brightness(1)" }, { filter: "brightness(.7)" }],
			fresh: [{ clipPath: splitStart, transform: "scale(.985)" }, { clipPath: "inset(0 0 0 0)", transform: "scale(1)" }],
		};
		case "curtain": return {
			old: [{ clipPath: "inset(0 0 0 0)", opacity: 1 }, { clipPath: curtainStart, opacity: .3 }],
			fresh: [{ clipPath: curtainStart, opacity: .3 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }],
		};
		case "pixel": return {
			old: [{ opacity: 1, transform: "scale(1)", filter: "contrast(1) saturate(1)" }, { opacity: 0, transform: "scale(.94)", filter: "contrast(1.7) saturate(.4)" }],
			fresh: [{ opacity: 0, transform: "scale(1.06)", filter: "contrast(1.7) saturate(.4)" }, { opacity: 1, transform: "scale(1)", filter: "contrast(1) saturate(1)" }],
		};
		case "dissolve": return {
			old: [{ opacity: 1, filter: "blur(0) contrast(1)", transform: "scale(1)" }, { opacity: 0, filter: `blur(${blur}) contrast(1.7)`, transform: "scale(.97)" }],
			fresh: [{ opacity: 0, filter: `blur(${blur}) contrast(1.7)`, transform: "scale(1.03)" }, { opacity: 1, filter: "blur(0) contrast(1)", transform: "scale(1)" }],
		};
		case "liquid": return {
			old: [{ opacity: 1, transform: "scale(1) skewX(0deg)", filter: "blur(0)" }, { opacity: 0, transform: `scale(1.12,.9) skewX(${rotation})`, filter: `blur(${blur})` }],
			fresh: [{ opacity: 0, transform: `scale(.88,1.1) skewX(${inverseRotation})`, filter: `blur(${blur})` }, { opacity: 1, transform: "scale(1) skewX(0deg)", filter: "blur(0)" }],
		};
		case "smear": return {
			old: [{ opacity: 1, transform: "translate3d(0,0,0) scale(1)", filter: "blur(0)" }, { opacity: 0, transform: `translate3d(${oldX},${oldY},0) scale(${smearX},${smearY})`, filter: `blur(${blur})` }],
			fresh: [{ opacity: 0, transform: `translate3d(${newX},${newY},0) scale(${smearX},${smearY})`, filter: `blur(${blur})` }, { opacity: 1, transform: "translate3d(0,0,0) scale(1)", filter: "blur(0)" }],
		};
		case "depth": return {
			old: [{ opacity: 1, transform: `perspective(${perspective}) translateZ(0) scale(1)`, filter: "blur(0)" }, { opacity: .08, transform: `perspective(${perspective}) translateZ(${inverseDepth}) scale(.9)`, filter: `blur(${blur})` }],
			fresh: [{ opacity: .08, transform: `perspective(${perspective}) translateZ(${depth}) scale(1.06)`, filter: `blur(${blur})` }, { opacity: 1, transform: `perspective(${perspective}) translateZ(0) scale(1)`, filter: "blur(0)" }],
		};
		case "flip": {
			const oldTransform = axisX ? `perspective(${perspective}) rotateX(${flipAngle})` : `perspective(${perspective}) rotateY(${flipAngle})`;
			const newTransform = axisX ? `perspective(${perspective}) rotateX(${inverseFlip})` : `perspective(${perspective}) rotateY(${inverseFlip})`;
			return { old: [{ opacity: 1, transform: `perspective(${perspective}) rotateX(0deg) rotateY(0deg)` }, { opacity: 0, transform: oldTransform }], fresh: [{ opacity: 0, transform: newTransform }, { opacity: 1, transform: `perspective(${perspective}) rotateX(0deg) rotateY(0deg)` }] };
		}
		case "page-turn": {
			const pageOrigin = axisX ? "center top" : "left center";
			const oldTransform = axisX ? `perspective(${perspective}) rotateX(${pageAngle})` : `perspective(${perspective}) rotateY(${pageAngle})`;
			const newTransform = axisX ? `perspective(${perspective}) rotateX(${inversePage})` : `perspective(${perspective}) rotateY(${inversePage})`;
			return { old: [{ opacity: 1, transformOrigin: pageOrigin, transform: `perspective(${perspective}) rotateX(0deg) rotateY(0deg)` }, { opacity: 0, transformOrigin: pageOrigin, transform: oldTransform, filter: "drop-shadow(18px 18px 18px rgb(0 0 0 / .35))" }], fresh: [{ opacity: .2, transformOrigin: pageOrigin, transform: newTransform }, { opacity: 1, transformOrigin: pageOrigin, transform: `perspective(${perspective}) rotateX(0deg) rotateY(0deg)` }] };
		}
		case "spring": return { old: [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.94)" }], fresh: [{ opacity: 0, transform: "scale(.72)" }, { opacity: 1, transform: "scale(1.08)", offset: .48 }, { transform: "scale(.975)", offset: .68 }, { transform: "scale(1.015)", offset: .84 }, { opacity: 1, transform: "scale(1)" }] };
		case "scatter": return {
			old: [{ opacity: 1, transform: "translate(0,0) rotate(0deg) scale(1)", filter: "blur(0)" }, { opacity: .5, transform: `translate(${scatterNeg35},${scatter20}) rotate(-3deg) scale(.95)`, offset: .55 }, { opacity: 0, transform: `translate(${scatter},${scatter}) rotate(9deg) scale(.82)`, filter: `blur(${blur})` }],
			fresh: [{ opacity: 0, transform: `translate(${scatterNeg},${scatter}) rotate(-9deg) scale(.82)`, filter: `blur(${blur})` }, { opacity: .72, transform: `translate(${scatter20},${scatterNeg15}) rotate(2deg) scale(1.04)`, offset: .55 }, { opacity: 1, transform: "translate(0,0) rotate(0deg) scale(1)", filter: "blur(0)" }],
		};
		case "rgb": return {
			old: [{ opacity: 1, filter: "drop-shadow(0 0 0 transparent)" }, { opacity: 0, transform: `translateX(${inverseHalfRgb})`, filter: `drop-shadow(${rgbOffset} 0 0 rgb(255 0 70 / .9)) drop-shadow(${inverseRgb} 0 0 rgb(0 180 255 / .9))` }],
			fresh: [{ opacity: 0, transform: `translateX(${halfRgb})`, filter: `drop-shadow(${rgbOffset} 0 0 rgb(255 0 70 / .9)) drop-shadow(${inverseRgb} 0 0 rgb(0 180 255 / .9))` }, { opacity: 1, transform: "translateX(0)", filter: "drop-shadow(0 0 0 transparent)" }],
		};
		case "portal": return {
			old: [{ opacity: 1, clipPath: `circle(150% at ${origin})`, transform: "scale(1) rotate(0deg)", filter: "blur(0)" }, { opacity: .04, clipPath: `circle(0% at ${origin})`, transform: `scale(.72) rotate(${rotation})`, filter: `blur(${blur})` }],
			fresh: [{ opacity: .04, clipPath: `circle(0% at ${origin})`, transform: `scale(1.28) rotate(${inverseRotation})`, filter: `blur(${blur})` }, { opacity: 1, clipPath: `circle(150% at ${origin})`, transform: "scale(1) rotate(0deg)", filter: "blur(0)" }],
		};
		case "fade":
		default: return { old: [{ opacity: 1 }, { opacity: 0 }], fresh: [{ opacity: 0 }, { opacity: 1 }] };
	}
}

function animatePseudo(root: HTMLElement, frames: TransitionFrames, resolved: ResolvedEngineTransition, easing: string): Animation[] {
	const common = { duration: resolved.duration, easing, fill: "both" as FillMode };
	return [
		root.animate(frames.old, { ...common, pseudoElement: "::view-transition-old(root)" } as PseudoAnimationOptions),
		root.animate(frames.fresh, { ...common, pseudoElement: "::view-transition-new(root)" } as PseudoAnimationOptions),
	];
}

function playRootAnimations(resolved: ResolvedEngineTransition): boolean {
	if (resolved.type === "instant") return true;
	const root = document.documentElement;
	let animations: Animation[] = [];
	try {
		animations = animatePseudo(root, buildTransitionFrames(resolved), resolved, resolved.easing);
		return true;
	} catch {
		for (const animation of animations) animation.cancel();
	}
	try {
		animations = animatePseudo(root, { old: [{ opacity: 1 }, { opacity: 0 }], fresh: [{ opacity: 0 }, { opacity: 1 }] }, resolved, "ease-out");
		return true;
	} catch {
		for (const animation of animations) animation.cancel();
		return false;
	}
}

async function runLegacyTransition(
	resolved: ResolvedEngineTransition,
	update: () => void | Promise<void>,
): Promise<void> {
	const root = document.documentElement;
	if (typeof root.animate !== "function") {
		await update();
		return;
	}
	const phaseDuration = Math.max(70, Math.min(180, resolved.duration / 2));
	const previousOpacity = root.style.opacity;
	try {
		const exit = root.animate([{ opacity: 1 }, { opacity: .9 }], { duration: phaseDuration, easing: "ease-out", fill: "forwards" });
		await exit.finished.catch(() => undefined);
		root.style.opacity = ".9";
		exit.cancel();
		await update();
		const enter = root.animate([{ opacity: .9 }, { opacity: 1 }], { duration: phaseDuration, easing: "ease-out", fill: "both" });
		await enter.finished.catch(() => undefined);
		enter.cancel();
	} finally {
		root.style.opacity = previousOpacity;
	}
}

function waitForNavigationRender(navigate: () => void, beforeHref: string, duration: number): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let finished = false;
		let urlChangedAt = 0;
		let pollTimer = 0;
		const cleanup = (): void => {
			observer.disconnect();
			window.clearTimeout(timeout);
			window.clearInterval(pollTimer);
		};
		const finish = (): void => {
			if (finished) return;
			finished = true;
			cleanup();
			resolve();
		};
		const observer = new MutationObserver(() => {
			if (window.location.href !== beforeHref) finish();
		});
		observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
		pollTimer = window.setInterval(() => {
			if (finished || window.location.href === beforeHref) return;
			if (!urlChangedAt) urlChangedAt = performance.now();
			if (performance.now() - urlChangedAt > 120) finish();
		}, 24);
		const timeout = window.setTimeout(finish, Math.min(2200, Math.max(650, duration * 3)));
		try {
			navigate();
		} catch (error) {
			finished = true;
			cleanup();
			reject(error);
		}
	});
}

async function beginTransition(resolved: ResolvedEngineTransition, update: () => void | Promise<void>): Promise<void> {
	warnUnknownTransition(resolved);
	if (resolved.type === "instant" || resolved.duration === 0 || reducedMotionEnabled() || typeof document === "undefined") {
		await update();
		return;
	}
	const transitionDocument = document as EngineTransitionDocument;
	if (typeof transitionDocument.startViewTransition !== "function") {
		await runLegacyTransition(resolved, update);
		return;
	}

	ensureTransitionStyles();
	activeTransition?.skipTransition?.();
	activeCleanup?.();
	const token = ++activeToken;
	const sharedManager = createSharedManager(resolved.shared);
	sharedManager.apply();
	activeCleanup = () => sharedManager.restore();

	let transition: EngineViewTransition;
	try {
		transition = transitionDocument.startViewTransition(async () => {
			await update();
			sharedManager.apply();
		});
	} catch {
		sharedManager.restore();
		activeCleanup = null;
		await runLegacyTransition(resolved, update);
		return;
	}
	activeTransition = transition;
	transition.ready.then(() => {
		if (token === activeToken && !playRootAnimations(resolved)) transition.skipTransition?.();
	}).catch(() => transition.skipTransition?.());

	let updateError: unknown;
	try {
		await transition.updateCallbackDone;
	} catch (reason) {
		updateError = reason;
	}
	try {
		await transition.finished;
	} catch {
		// A newer transition may intentionally skip this one.
	} finally {
		if (token === activeToken) {
			activeCleanup?.();
			activeCleanup = null;
			activeTransition = null;
		}
	}
	if (updateError !== undefined) throw updateError;
}

export async function runEngineTransition(update: () => void | Promise<void>, transition: EngineTransitionInput = "fade", context: EngineTransitionRunContext = {}): Promise<void> {
	await beginTransition(resolveEngineTransition(transition, context), update);
}

export async function navigateWithEngineTransition(
	navigate: () => void,
	transition: EngineTransitionInput = "fade",
	context: EngineTransitionRunContext = {},
	expectedHref?: string,
): Promise<void> {
	const resolved = resolveEngineTransition(transition, context);
	const beforeHref = typeof window !== "undefined" ? window.location.href : "";
	if (expectedHref && beforeHref && isExactTransitionLocation(expectedHref, beforeHref)) {
		navigate();
		return;
	}
	await beginTransition(resolved, () => {
		if (typeof window === "undefined") {
			navigate();
			return;
		}
		return waitForNavigationRender(navigate, beforeHref, resolved.duration);
	});
}

export function useEngineTransitions(): EngineTransitionsController {
	const router = useRouter();
	const run = useCallback(async (update: () => void | Promise<void>, transition: EngineTransitionInput = "layout"): Promise<void> => {
		// `run()` can be driven by effects, observers, timers, stores, or events. Yield
		// once so React has left its current render/commit stack before `flushSync()`.
		await Promise.resolve();
		await runEngineTransition(() => {
			let result: void | Promise<void>;
			flushSync(() => { result = update(); });
			return result!;
		}, transition);
	}, []);
	const push = useCallback(async (href: string, transition: EngineTransitionInput = "fade", context: EngineTransitionRunContext = {}): Promise<void> => {
		await navigateWithEngineTransition(() => router.push(href), transition, context, href);
	}, [router]);
	const replace = useCallback(async (href: string, transition: EngineTransitionInput = "fade", context: EngineTransitionRunContext = {}): Promise<void> => {
		await navigateWithEngineTransition(() => router.replace(href), transition, context, href);
	}, [router]);
	return useMemo(() => ({ run, push, replace }), [push, replace, run]);
}
