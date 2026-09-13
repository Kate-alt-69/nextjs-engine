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
	type EngineScrollDirector,
	type EngineScrollDirectorConfig,
	type EngineScrollTimelineFrame,
} from "../core/enginescroll";
import { EngineScheduler } from "../core/enginescheduler";
import { EngineBrowser } from "../core/EngineBrowserSafe";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";

export type EngineRevealEffect = "pop" | "fade" | "slide-up" | "none";

export interface EngineRevealProps extends BaseNodeProps {
	children?: ReactNode;
	/** Entrance animation. `pop` scales from the element's own center. */
	effect?: EngineRevealEffect;
	/** Re-arm the reveal after the element returns to the pre-entry side. */
	replay?: boolean;
	/** Distance in CSS pixels used for the EngineScroll render-state window. */
	renderMargin?: number;
	/** Distance in CSS pixels at which the entrance animation becomes active. */
	motionMargin?: number;
	/** Entrance duration in milliseconds. */
	duration?: number;
	/** Optional entrance delay in milliseconds. */
	delay?: number;
	/** Starting scale for the pop effect. */
	scaleFrom?: number;
	/** Pop overshoot scale. */
	overshoot?: number;
	/** Skip animated entrance while NE reports frame pressure. */
	skipUnderFramePressure?: boolean;
	/** Allow browser-managed offscreen paint skipping without changing layout geometry. */
	releaseWhenFar?: boolean;
}

type RevealRegion = "before" | "active" | "after";

type RevealRegistration = {
	id: string;
	element: HTMLElement;
	renderTrack: string;
	motionTrack: string;
	renderMargin: number;
	motionMargin: number;
	onRender(frame: Readonly<EngineScrollTimelineFrame>): void;
	onMotion(frame: Readonly<EngineScrollTimelineFrame>): void;
};

type MeasuredSize = { width: number; height: number };

function finite(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function pointSpacing(): number {
	const spacing = EngineScroll.state().page.pointSpacing;
	return Number.isFinite(spacing) && spacing > 0 ? spacing : 1;
}

function layoutSize(element: HTMLElement): MeasuredSize {
	// offsetWidth/offsetHeight are layout dimensions and deliberately ignore CSS
	// transforms. EngineReveal animates a child layer, but keeping this helper
	// transform-independent also protects custom styles on the anchor itself.
	const width = element.offsetWidth;
	const height = element.offsetHeight;
	if (width > 0 || height > 0) return { width, height };
	const rect = element.getBoundingClientRect();
	return { width: rect.width, height: rect.height };
}

function timelineRange(
	id: string,
	heightPx: number,
	marginPx: number,
	spacing: number,
) {
	const target = `#${id}` as `#${string}`;
	const safeHeight = Math.max(1, heightPx);
	const safeSpacing = Math.max(1, spacing);
	return {
		start: target,
		end: target,
		source: "top" as const,
		startAlign: "end" as const,
		endAlign: "start" as const,
		startOffset: -marginPx / safeSpacing,
		endOffset: (safeHeight + marginPx) / safeSpacing,
		easing: "linear" as const,
	};
}

function frameRegion(frame: Readonly<EngineScrollTimelineFrame>): RevealRegion {
	if (frame.active) return "active";
	return frame.after ? "after" : "before";
}

/**
 * One coordinator backs every EngineReveal instance on the page. Components
 * explicitly register themselves; there is no selector scan, MutationObserver,
 * or per-card scroll listener. EngineScrollDirector then multiplexes every
 * render/motion track through one EngineScroll runtime subscription.
 *
 * Important invariant: the registered element is a geometry anchor and is
 * never scaled/faded by the reveal animation. Motion is applied to an inner
 * visual layer so timeline measurement cannot feed back into its own state.
 */
class EngineRevealCoordinator {
	private registrations = new Map<HTMLElement, RevealRegistration>();
	private sizes = new WeakMap<HTMLElement, MeasuredSize>();
	private director: EngineScrollDirector<EngineScrollDirectorConfig> | null = null;
	private rebuildRaf = 0;
	private resizeObserver: ResizeObserver | null = null;

	register(registration: RevealRegistration): () => void {
		this.registrations.set(registration.element, registration);
		this.ensureResizeObserver();
		this.resizeObserver?.observe(registration.element);
		this.measure(registration.element);
		this.scheduleRebuild();

		return () => {
			this.registrations.delete(registration.element);
			this.resizeObserver?.unobserve(registration.element);
			this.scheduleRebuild();
		};
	}

	private ensureResizeObserver(): void {
		if (this.resizeObserver || typeof ResizeObserver === "undefined") return;
		this.resizeObserver = new ResizeObserver((entries) => {
			let changed = false;
			for (const entry of entries) {
				if (!(entry.target instanceof HTMLElement) || !this.registrations.has(entry.target)) continue;
				changed = this.measure(entry.target) || changed;
			}
			if (changed) this.scheduleRebuild();
		});
	}

	private measure(element: HTMLElement): boolean {
		const next = layoutSize(element);
		const previous = this.sizes.get(element);
		this.sizes.set(element, next);
		if (next.height > 0) {
			element.style.setProperty("--e-reveal-intrinsic-height", `${Math.ceil(next.height)}px`);
		}
		return !previous
			|| Math.abs(previous.width - next.width) > 1
			|| Math.abs(previous.height - next.height) > 1;
	}

	private scheduleRebuild = (): void => {
		if (typeof window === "undefined" || this.rebuildRaf) return;
		this.rebuildRaf = window.requestAnimationFrame(this.rebuild);
	};

	private rebuild = (): void => {
		this.rebuildRaf = 0;
		this.director?.dispose();
		this.director = null;
		if (this.registrations.size === 0) return;

		EngineScroll.initialize();
		const spacing = pointSpacing();
		const config: Record<string, ReturnType<typeof timelineRange>> = {};

		for (const registration of this.registrations.values()) {
			const size = layoutSize(registration.element);
			this.sizes.set(registration.element, size);
			if (size.height > 0) {
				registration.element.style.setProperty("--e-reveal-intrinsic-height", `${Math.ceil(size.height)}px`);
			}
			config[registration.renderTrack] = timelineRange(
				registration.id,
				size.height,
				registration.renderMargin,
				spacing,
			);
			config[registration.motionTrack] = timelineRange(
				registration.id,
				size.height,
				registration.motionMargin,
				spacing,
			);
		}

		this.director = EngineScroll.direct(config);
		for (const registration of this.registrations.values()) {
			registration.onRender(this.director.snapshotTrack(registration.renderTrack));
			registration.onMotion(this.director.snapshotTrack(registration.motionTrack));

			// Track snapshots rather than only enter/leave events. A fast mobile
			// fling can jump from `before` to `after` in one frame and never produce
			// an active frame. Snapshot subscribers still observe that region change,
			// so cards cannot remain stuck invisible after the user yeets the page.
			this.director.subscribeTrack(
				registration.renderTrack,
				(frame) => registration.onRender(frame),
				false,
			);
			this.director.subscribeTrack(
				registration.motionTrack,
				(frame) => registration.onMotion(frame),
				false,
			);
		}
	};
}

const revealCoordinator = new EngineRevealCoordinator();
let revealCssInjected = false;

const REVEAL_CSS = `
.e-reveal{
  --e-reveal-duration:380ms;
  --e-reveal-delay:0ms;
  --e-reveal-scale-from:.8;
  --e-reveal-overshoot:1.028;
  min-width:0;
}
/* Never use content-visibility:hidden here. Hiding a scroll-tracked geometry
   anchor changes layout height and lets browser scroll anchoring fight the
   user's fling. `auto` is browser-managed and preserves stable geometry. */
.e-reveal[data-engine-release="true"]{
  content-visibility:auto;
  contain-intrinsic-size:auto var(--e-reveal-intrinsic-height,320px);
}
.e-reveal__content{
  width:100%;
  height:100%;
  min-width:0;
  min-height:0;
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
.e-reveal__content[data-engine-reveal-effect="none"][data-engine-reveal-state="animating"],
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
	skipUnderFramePressure = true,
	releaseWhenFar = true,
	...props
}: EngineRevealProps) {
	const generatedId = useId().replace(/:/g, "");
	const resolvedId = id ?? point ?? `e-reveal-${generatedId}`;
	const elementRef = useRef<HTMLDivElement | null>(null);
	const settleTimerRef = useRef<number | null>(null);
	const enterRafRef = useRef<number | null>(null);
	const motionRegionRef = useRef<RevealRegion | null>(null);
	const revealedRef = useRef(priority);
	const [renderNear, setRenderNear] = useState(true);
	const [motionState, setMotionState] = useState<"sleeping" | "armed" | "animating" | "settled" | "instant">("settled");
	const stateClass = useCpropClass(cprop);
	const mergedClass = ["e-reveal", className, stateClass].filter(Boolean).join(" ");
	const timingStyle = {
		"--e-reveal-duration": `${finite(duration, 380)}ms`,
		"--e-reveal-delay": `${finite(delay, 0)}ms`,
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

		const sleep = () => {
			if (!mounted) return;
			if (!replay && revealedRef.current) {
				settle();
				return;
			}
			clearPending();
			setMotionState("sleeping");
		};

		const enter = () => {
			if (!mounted) return;
			setRenderNear(true);
			clearPending();
			if (
				effect === "none"
				|| EngineBrowser.supports.reducedMotion
				|| (skipUnderFramePressure && EngineScheduler.isUnderFramePressure())
			) {
				settle(true);
				return;
			}
			setMotionState("armed");
			enterRafRef.current = window.requestAnimationFrame(() => {
				enterRafRef.current = null;
				if (!mounted) return;
				revealedRef.current = true;
				setMotionState("animating");
				settleTimerRef.current = window.setTimeout(() => {
					settleTimerRef.current = null;
					if (mounted) setMotionState("settled");
				}, finite(duration, 380) + finite(delay, 0) + 80);
			});
		};

		const stop = revealCoordinator.register({
			id: resolvedId,
			element,
			renderTrack: `${resolvedId}__render`,
			motionTrack: `${resolvedId}__motion`,
			renderMargin: finite(renderMargin, 1600),
			motionMargin: finite(motionMargin, 150),
			onRender(frame) {
				if (!mounted) return;
				// This flag is informational/lifecycle state only. It must never alter
				// the anchor's layout size while the user is scrolling.
				setRenderNear(!releaseWhenFar || frame.active);
			},
			onMotion(frame) {
				if (!mounted) return;
				const nextRegion = frameRegion(frame);
				const previousRegion = motionRegionRef.current;
				motionRegionRef.current = nextRegion;

				// First sampled frame should never hide and then re-show content that is
				// already on screen after hydration. Offscreen-before content can arm.
				if (previousRegion === null) {
					if (nextRegion === "before") sleep();
					else settle();
					return;
				}

				if (nextRegion === "after") {
					// A high-velocity fling may jump straight before -> after. Settling here
					// guarantees the card cannot remain invisible after a skipped range.
					settle();
					return;
				}

				if (nextRegion === "before") {
					sleep();
					return;
				}

				if (previousRegion === "active") return;
				if (!replay && revealedRef.current) {
					settle();
					return;
				}
				enter();
			},
		});

		return () => {
			mounted = false;
			clearPending();
			stop();
		};
	}, [delay, duration, effect, motionMargin, priority, releaseWhenFar, renderMargin, replay, resolvedId, skipUnderFramePressure]);

	return (
		<div
			ref={elementRef}
			id={resolvedId}
			className={mergedClass}
			data-engine-reveal-state={motionState}
			data-engine-reveal-effect={effect}
			data-engine-render-state={renderNear ? "near" : "far"}
			data-engine-release={releaseWhenFar ? "true" : "false"}
			style={resolvedStyle}
		>
			<div
				className="e-reveal__content"
				data-engine-reveal-state={motionState}
				data-engine-reveal-effect={effect}
			>
				{children}
			</div>
		</div>
	);
});
