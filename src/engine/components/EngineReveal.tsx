"use client";

import React, {
	memo,
	useEffect,
	useId,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import type { BaseNodeProps } from "../schema/types";
import {
	EngineScroll,
	type EngineScrollTimeline,
	type EngineScrollTimelineFrame,
} from "../core/enginescroll";
import { EngineScheduler } from "../core/enginescheduler";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";

export type EngineRevealEffect = "pop" | "fade" | "slide-up" | "none";

export interface EngineRevealProps extends BaseNodeProps {
	children?: ReactNode;
	/** Entrance animation. Pop scales from the element's own center. */
	effect?: EngineRevealEffect;
	/** Re-arm after the element leaves the motion range. */
	replay?: boolean;
	/** Distance in CSS pixels where the subtree is considered render-near. */
	renderMargin?: number;
	/** Distance in CSS pixels outside the viewport where entrance motion becomes active. */
	motionMargin?: number;
	/** Entrance duration in milliseconds. */
	duration?: number;
	/** Optional entrance delay in milliseconds. */
	delay?: number;
	/** Starting scale for pop. */
	scaleFrom?: number;
	/** Pop overshoot scale. */
	overshoot?: number;
	/** Explicit opt-in to settling instantly while NE reports frame pressure. */
	skipUnderFramePressure?: boolean;
	/** Allow desktop paint virtualization while preserving geometry. */
	releaseWhenFar?: boolean;
}

type RevealRegion = "before" | "active" | "after";
type RevealState = "sleeping" | "armed" | "animating" | "settled" | "instant";

function finite(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function regionOf(frame: Readonly<EngineScrollTimelineFrame>): RevealRegion {
	if (frame.active) return "active";
	return frame.after ? "after" : "before";
}

function pointSpacing(): number {
	const spacing = EngineScroll.state().page.pointSpacing;
	return Number.isFinite(spacing) && spacing > 0 ? spacing : 1;
}

/**
 * Build a viewport-intersection timeline in EngineScroll points.
 *
 * `startAlign: "end"` resolves where the element BOTTOM meets the viewport
 * bottom. To begin while the element TOP is still `marginPx` below the
 * viewport, the start offset must subtract the element height as well as the
 * margin. The old `-margin` formula delayed tall mobile cards until most of
 * them were already onscreen, causing blank gaps and late/no-looking reveals.
 */
function timelineFor(
	id: string,
	heightPx: number,
	marginPx: number,
): EngineScrollTimeline {
	const spacing = pointSpacing();
	const target = `#${id}` as `#${string}`;
	const height = Math.max(1, heightPx);
	const margin = Math.max(0, marginPx);

	return EngineScroll.timeline({
		start: target,
		end: target,
		source: "top",
		startAlign: "end",
		endAlign: "start",
		startOffset: -(height + margin) / spacing,
		endOffset: (height + margin) / spacing,
		easing: "linear",
	});
}

let revealCssInjected = false;

const REVEAL_CSS = `
.e-reveal{
  --e-reveal-duration:380ms;
  --e-reveal-delay:0ms;
  --e-reveal-scale-from:.8;
  --e-reveal-overshoot:1.028;
  --e-reveal-intrinsic-height:320px;
  min-width:0;
  overflow-anchor:none;
}
.e-reveal[data-engine-release="true"]{
  contain-intrinsic-size:auto var(--e-reveal-intrinsic-height);
}
/* Forced content-visibility changes during mobile momentum scrolling can make
   Chrome adjust scroll anchoring while the address bar/viewport is also moving.
   Keep the mobile layout shell fully real. Expensive descendants such as
   EngineImage still release themselves independently through EngineScheduler. */
@media(min-width:820px){
  .e-reveal[data-engine-release="true"][data-engine-render-near="false"]{
    content-visibility:auto;
  }
  .e-reveal[data-engine-release="true"][data-engine-render-near="true"]{
    content-visibility:visible;
  }
}
.e-reveal__content{
  width:100%;
  min-width:0;
  transform-origin:center center;
  backface-visibility:hidden;
  -webkit-backface-visibility:hidden;
}
.e-reveal__content[data-engine-reveal-state="sleeping"],
.e-reveal__content[data-engine-reveal-state="armed"]{
  opacity:0;
  pointer-events:none;
  animation:none!important;
  transition:none!important;
}
.e-reveal__content[data-engine-reveal-effect="pop"][data-engine-reveal-state="sleeping"],
.e-reveal__content[data-engine-reveal-effect="pop"][data-engine-reveal-state="armed"]{
  transform:translateZ(0) scale(var(--e-reveal-scale-from));
}
.e-reveal__content[data-engine-reveal-effect="slide-up"][data-engine-reveal-state="sleeping"],
.e-reveal__content[data-engine-reveal-effect="slide-up"][data-engine-reveal-state="armed"]{
  transform:translate3d(0,28px,0);
}
.e-reveal__content[data-engine-reveal-effect="fade"][data-engine-reveal-state="sleeping"],
.e-reveal__content[data-engine-reveal-effect="fade"][data-engine-reveal-state="armed"]{
  transform:translateZ(0);
}
.e-reveal__content[data-engine-reveal-state="animating"]{
  pointer-events:none;
  will-change:transform,opacity;
}
.e-reveal__content[data-engine-reveal-effect="pop"][data-engine-reveal-state="animating"]{
  animation:e-reveal-pop var(--e-reveal-duration) cubic-bezier(.16,1,.3,1) var(--e-reveal-delay) both!important;
}
.e-reveal__content[data-engine-reveal-effect="slide-up"][data-engine-reveal-state="animating"]{
  animation:e-reveal-slide var(--e-reveal-duration) cubic-bezier(.16,1,.3,1) var(--e-reveal-delay) both!important;
}
.e-reveal__content[data-engine-reveal-effect="fade"][data-engine-reveal-state="animating"]{
  animation:e-reveal-fade var(--e-reveal-duration) ease-out var(--e-reveal-delay) both!important;
}
.e-reveal__content[data-engine-reveal-effect="none"],
.e-reveal__content[data-engine-reveal-state="instant"],
.e-reveal__content[data-engine-reveal-state="settled"]{
  opacity:1;
  transform:translateZ(0) scale(1);
  pointer-events:auto;
  animation:none!important;
  will-change:auto;
}
@keyframes e-reveal-pop{
  0%{opacity:0;transform:translateZ(0) scale(var(--e-reveal-scale-from))}
  68%{opacity:1;transform:translateZ(0) scale(var(--e-reveal-overshoot))}
  100%{opacity:1;transform:translateZ(0) scale(1)}
}
@keyframes e-reveal-slide{
  0%{opacity:0;transform:translate3d(0,28px,0)}
  100%{opacity:1;transform:translate3d(0,0,0)}
}
@keyframes e-reveal-fade{
  0%{opacity:0}
  100%{opacity:1}
}
@supports(-moz-appearance:none){
  .e-reveal__content{transform-style:flat}
}
@media(prefers-reduced-motion:reduce){
  .e-reveal__content{
    opacity:1!important;
    transform:none!important;
    animation:none!important;
    transition:none!important;
    pointer-events:auto!important;
  }
}
`.trim();

function injectRevealCss(): void {
	if (typeof document === "undefined" || revealCssInjected) return;
	revealCssInjected = true;
	const style = document.createElement("style");
	style.id = "__engine_reveal__";
	style.textContent = REVEAL_CSS;
	document.head.appendChild(style);
}

export const EngineReveal = memo(function EngineReveal({
	children,
	id,
	point,
	className,
	style,
	cprop,
	priority = false,
	effect = "pop",
	replay = true,
	renderMargin = 1600,
	motionMargin = 150,
	duration = 380,
	delay = 0,
	scaleFrom = 0.8,
	overshoot = 1.028,
	skipUnderFramePressure = false,
	releaseWhenFar = true,
	...props
}: EngineRevealProps) {
	const generatedId = useId().replace(/:/g, "");
	const resolvedId = id ?? point ?? `e-reveal-${generatedId}`;
	const elementRef = useRef<HTMLDivElement | null>(null);
	const settleTimerRef = useRef<number | null>(null);
	const enterRafRef = useRef<number | null>(null);
	const revealedRef = useRef(false);
	const motionRegionRef = useRef<RevealRegion | null>(null);
	const renderRegionRef = useRef<RevealRegion | null>(null);
	const [motionState, setMotionState] = useState<RevealState>("settled");
	const [renderNear, setRenderNear] = useState(true);
	const stateClass = useCpropClass(cprop);
	const mergedClass = ["e-reveal", className, stateClass].filter(Boolean).join(" ");
	const safeDuration = finite(duration, 380);
	const safeDelay = finite(delay, 0);
	const timingStyle = {
		"--e-reveal-duration": `${safeDuration}ms`,
		"--e-reveal-delay": `${safeDelay}ms`,
		"--e-reveal-scale-from": String(Math.min(1, Math.max(0.4, scaleFrom))),
		"--e-reveal-overshoot": String(Math.max(1, overshoot)),
	} as CSSProperties;
	const resolvedStyle = usePrimitiveStyles(props as Record<string, unknown>, {
		derived: timingStyle,
		style,
	});

	useEffect(() => {
		injectRevealCss();
	}, []);

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;
		let mounted = true;
		let renderTimeline: EngineScrollTimeline | null = null;
		let motionTimeline: EngineScrollTimeline | null = null;
		let stopRender: (() => void) | null = null;
		let stopMotion: (() => void) | null = null;
		let rebuildRaf = 0;

		const clearPending = () => {
			if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
			if (enterRafRef.current !== null) window.cancelAnimationFrame(enterRafRef.current);
			settleTimerRef.current = null;
			enterRafRef.current = null;
		};

		const settle = (instant = false) => {
			if (!mounted) return;
			clearPending();
			revealedRef.current = true;
			setMotionState(instant ? "instant" : "settled");
		};

		const animateIn = () => {
			if (!mounted) return;
			clearPending();
			const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			if (
				effect === "none"
				|| reducedMotion
				|| (skipUnderFramePressure && EngineScheduler.isUnderFramePressure())
			) {
				settle(true);
				return;
			}

			setMotionState("armed");
			enterRafRef.current = window.requestAnimationFrame(() => {
				enterRafRef.current = null;
				if (!mounted) return;
				setMotionState("animating");
				settleTimerRef.current = window.setTimeout(
					() => settle(false),
					safeDuration + safeDelay + 90,
				);
			});
		};

		const handleRender = (frame: Readonly<EngineScrollTimelineFrame>) => {
			const region = regionOf(frame);
			if (region === renderRegionRef.current) return;
			renderRegionRef.current = region;
			setRenderNear(region === "active" || priority);
		};

		const handleMotion = (frame: Readonly<EngineScrollTimelineFrame>) => {
			const region = regionOf(frame);
			if (region === motionRegionRef.current) return;
			motionRegionRef.current = region;

			if (region === "active") {
				if (!revealedRef.current || replay) animateIn();
				else settle(false);
				return;
			}

			clearPending();
			if (replay || !revealedRef.current) setMotionState("sleeping");
		};

		const disposeTimelines = () => {
			stopRender?.();
			stopMotion?.();
			stopRender = null;
			stopMotion = null;
			renderTimeline?.dispose();
			motionTimeline?.dispose();
			renderTimeline = null;
			motionTimeline = null;
		};

		const buildTimelines = () => {
			if (!mounted) return;
			disposeTimelines();
			EngineScroll.initialize();
			const height = Math.max(1, element.offsetHeight || element.getBoundingClientRect().height || 1);
			element.style.setProperty("--e-reveal-intrinsic-height", `${Math.ceil(height)}px`);
			renderTimeline = timelineFor(resolvedId, height, finite(renderMargin, 1600));
			motionTimeline = timelineFor(resolvedId, height, finite(motionMargin, 150));
			stopRender = renderTimeline.subscribe(handleRender, true);
			stopMotion = motionTimeline.subscribe(handleMotion, true);
		};

		const scheduleRebuild = () => {
			if (rebuildRaf) return;
			rebuildRaf = window.requestAnimationFrame(() => {
				rebuildRaf = 0;
				buildTimelines();
			});
		};

		buildTimelines();
		const resizeObserver = typeof ResizeObserver === "undefined"
			? null
			: new ResizeObserver(scheduleRebuild);
		resizeObserver?.observe(element);

		return () => {
			mounted = false;
			clearPending();
			if (rebuildRaf) window.cancelAnimationFrame(rebuildRaf);
			resizeObserver?.disconnect();
			disposeTimelines();
		};
	}, [
		effect,
		motionMargin,
		priority,
		renderMargin,
		replay,
		resolvedId,
		safeDelay,
		safeDuration,
		skipUnderFramePressure,
	]);

	return (
		<div
			ref={elementRef}
			id={resolvedId}
			className={mergedClass}
			style={resolvedStyle}
			data-engine-release={releaseWhenFar ? "true" : "false"}
			data-engine-render-near={renderNear ? "true" : "false"}
		>
			<div
				className="e-reveal__content"
				data-engine-reveal-effect={effect}
				data-engine-reveal-state={motionState}
			>
				{children}
			</div>
		</div>
	);
});

EngineReveal.displayName = "EngineReveal";

export default EngineReveal;
