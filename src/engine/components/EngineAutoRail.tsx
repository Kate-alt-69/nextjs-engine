"use client";

import React, { Children, memo, useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { EngineScheduler } from "../core/enginescheduler";
import type { BaseNodeProps } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";

export interface EngineAutoRailProps extends BaseNodeProps {
	children?: ReactNode;
	/** Automatic horizontal travel speed in CSS pixels per second. */
	speed?: number;
	/** Gap between rail items. */
	gap?: string | number;
	/** Delay before automatic motion resumes after direct interaction. */
	resumeDelay?: number;
	/** Scroll direction. `right` increases scrollLeft, so card content travels right-to-left. */
	motionDirection?: "right" | "left";
	/** Bounce at the ends instead of wrapping. */
	bounce?: boolean;
	/** Disable automatic movement while keeping the interactive native rail. */
	autoplay?: boolean;
	/** Pause automatic movement merely because the pointer is hovering the rail. */
	pauseOnHover?: boolean;
	ariaLabel?: string;
}

let railCssInjected = false;
const RAIL_CSS = `
.e-auto-rail{position:relative;min-width:0;overflow:hidden}
.e-auto-rail::before,.e-auto-rail::after{content:'';position:absolute;top:0;bottom:0;width:clamp(16px,4vw,58px);z-index:3;pointer-events:none}
.e-auto-rail::before{left:0;background:linear-gradient(90deg,var(--e-rail-edge,transparent),transparent)}
.e-auto-rail::after{right:0;background:linear-gradient(270deg,var(--e-rail-edge,transparent),transparent)}
.e-auto-rail__viewport{display:flex;gap:var(--e-rail-gap,16px);overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-ms-overflow-style:none;overscroll-behavior-x:contain;touch-action:pan-x pan-y;padding:8px 2px 18px;cursor:grab;scroll-behavior:auto}
.e-auto-rail__viewport::-webkit-scrollbar{display:none}
.e-auto-rail[data-dragging='true'] .e-auto-rail__viewport{cursor:grabbing;scroll-snap-type:none}
.e-auto-rail__item{flex:0 0 auto;min-width:0}
.e-auto-rail:focus-within::before,.e-auto-rail:focus-within::after{opacity:.7}
@media(prefers-reduced-motion:reduce){.e-auto-rail__viewport{scroll-behavior:auto}}
`.trim();

function injectRailCss() {
	if (typeof document === "undefined" || railCssInjected) return;
	railCssInjected = true;
	const style = document.createElement("style");
	style.id = "__engine_auto_rail__";
	style.textContent = RAIL_CSS;
	document.head.appendChild(style);
}

function cssGap(value: string | number) { return typeof value === "number" ? `${value}px` : value; }

export const EngineAutoRail = memo(function EngineAutoRail({
	children,
	speed = 26,
	gap = 16,
	resumeDelay = 1600,
	motionDirection = "right",
	bounce = false,
	autoplay = true,
	pauseOnHover = true,
	ariaLabel = "Scrollable cards",
	className,
	style,
	cprop,
	id,
	point,
	...props
}: EngineAutoRailProps) {
	const items = useMemo(() => Children.toArray(children), [children]);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const rafRef = useRef(0);
	const frameStepRef = useRef<(now: number) => void>(() => undefined);
	const lastFrameRef = useRef(0);
	const visibleRef = useRef(true);
	const pausedRef = useRef(false);
	const reducedRef = useRef(false);
	const directionRef = useRef(motionDirection === "right" ? 1 : -1);
	const resumeTimerRef = useRef<number | null>(null);
	const dragRef = useRef<{ id: number; startX: number; startScroll: number; moved: boolean } | null>(null);
	const suppressClickUntilRef = useRef(0);
	const stateClass = useCpropClass(cprop);
	const mergedClass = ["e-auto-rail", className, stateClass].filter(Boolean).join(" ");
	const resolvedStyle = usePrimitiveStyles(props as Record<string, unknown>, { style });
	const resolvedId = id ?? point;
	const safeSpeed = Math.max(0, Math.min(180, Number.isFinite(speed) ? speed : 26));

	const stopFrame = useCallback(() => {
		if (rafRef.current && typeof window !== "undefined") window.cancelAnimationFrame(rafRef.current);
		rafRef.current = 0;
		lastFrameRef.current = 0;
	}, []);

	const requestNextFrame = useCallback(() => {
		if (typeof window === "undefined" || rafRef.current || !autoplay || reducedRef.current || pausedRef.current || !visibleRef.current || document.hidden || safeSpeed <= 0) return;
		rafRef.current = window.requestAnimationFrame((now) => frameStepRef.current(now));
	}, [autoplay, safeSpeed]);

	useEffect(() => {
		frameStepRef.current = (now: number) => {
			rafRef.current = 0;
			const viewport = viewportRef.current;
			if (!viewport || reducedRef.current || pausedRef.current || !visibleRef.current || document.hidden || !autoplay || safeSpeed <= 0) {
				lastFrameRef.current = 0;
				return;
			}
			const previous = lastFrameRef.current || now;
			const dt = Math.min(34, Math.max(0, now - previous));
			lastFrameRef.current = now;
			const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
			if (maxScroll <= 1) { lastFrameRef.current = 0; return; }
			viewport.scrollLeft += directionRef.current * safeSpeed * (dt / 1000);
			if (directionRef.current > 0 && viewport.scrollLeft >= maxScroll - 1) {
				if (bounce) directionRef.current = -1;
				else viewport.scrollLeft = 0;
			} else if (directionRef.current < 0 && viewport.scrollLeft <= 1) {
				if (bounce) directionRef.current = 1;
				else viewport.scrollLeft = maxScroll;
			}
			requestNextFrame();
		};
	}, [autoplay, bounce, requestNextFrame, safeSpeed]);

	const pause = useCallback((resume = true) => {
		pausedRef.current = true;
		stopFrame();
		if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		resumeTimerRef.current = null;
		if (!resume) return;
		resumeTimerRef.current = window.setTimeout(() => {
			pausedRef.current = false;
			requestNextFrame();
		}, Math.max(250, resumeDelay));
	}, [requestNextFrame, resumeDelay, stopFrame]);

	useEffect(() => {
		injectRailCss();
		reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		directionRef.current = motionDirection === "right" ? 1 : -1;
		const root = rootRef.current;
		if (!root) return;
		const releaseFrameMonitor = autoplay && !reducedRef.current ? EngineScheduler.acquireFrameMonitor() : () => undefined;
		const stopObserve = EngineScheduler.observe(root, (snapshot) => {
			visibleRef.current = snapshot.visible || snapshot.near;
			if (visibleRef.current) requestNextFrame(); else stopFrame();
		}, { nearMargin: "180px 0px", visibleThreshold: 0.01, releaseWhenFar: true });
		const onVisibility = () => document.hidden ? stopFrame() : requestNextFrame();
		document.addEventListener("visibilitychange", onVisibility);
		requestNextFrame();
		return () => {
			stopObserve();
			releaseFrameMonitor();
			document.removeEventListener("visibilitychange", onVisibility);
			stopFrame();
			if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		};
	}, [autoplay, motionDirection, requestNextFrame, stopFrame]);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		const viewport = viewportRef.current;
		if (!viewport) return;
		dragRef.current = { id: event.pointerId, startX: event.clientX, startScroll: viewport.scrollLeft, moved: false };
		rootRef.current?.setAttribute("data-dragging", "true");
		try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
		pause(false);
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		const viewport = viewportRef.current;
		if (!drag || drag.id !== event.pointerId || !viewport) return;
		const dx = event.clientX - drag.startX;
		if (Math.abs(dx) > 5) drag.moved = true;
		viewport.scrollLeft = drag.startScroll - dx;
	};

	const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = dragRef.current;
		if (!drag || drag.id !== event.pointerId) return;
		dragRef.current = null;
		rootRef.current?.removeAttribute("data-dragging");
		try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* optional */ }
		if (drag.moved) suppressClickUntilRef.current = performance.now() + 180;
		pause(true);
	};

	return (
		<div
			ref={rootRef}
			id={resolvedId}
			className={mergedClass}
			style={{ ...resolvedStyle, "--e-rail-gap": cssGap(gap) } as CSSProperties}
			role="region"
			aria-label={ariaLabel}
			onMouseEnter={pauseOnHover ? () => pause(false) : undefined}
			onMouseLeave={pauseOnHover ? () => pause(true) : undefined}
			onFocusCapture={() => pause(false)}
			onBlurCapture={() => pause(true)}
			onWheel={() => pause(true)}
			onClickCapture={(event) => {
				if (performance.now() < suppressClickUntilRef.current) { event.preventDefault(); event.stopPropagation(); }
			}}
		>
			<div
				ref={viewportRef}
				className="e-auto-rail__viewport"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={finishDrag}
				onPointerCancel={finishDrag}
				onDragStart={(event) => event.preventDefault()}
			>
				{items.map((child, index) => <div className="e-auto-rail__item" key={index}>{child}</div>)}
			</div>
		</div>
	);
});

EngineAutoRail.displayName = "EngineAutoRail";
export default EngineAutoRail;
