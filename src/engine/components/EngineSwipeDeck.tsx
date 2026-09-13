"use client";

import React, { Children, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EngineScheduler } from "../core/enginescheduler";
import type { BaseNodeProps } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";

export interface EngineSwipeDeckProps extends BaseNodeProps {
	children?: ReactNode;
	/** Number of cards kept visibly stacked behind the active card. */
	depth?: number;
	/** Swipe axis. `y` makes upward/downward gestures drive the deck. */
	axis?: "x" | "y";
	/** Mount only the active card plus the configured stack depth. */
	virtualize?: boolean;
	/** Distance in px before a swipe commits. */
	swipeThreshold?: number;
	/** Optional automatic advance interval. 0 disables autoplay. */
	autoplayMs?: number;
	/** Pause autoplay after direct interaction. */
	resumeDelay?: number;
	/** Respect the OS/browser reduced-motion preference. Defaults to true. */
	respectReducedMotion?: boolean;
	ariaLabel?: string;
	onIndexChange?: (index: number) => void;
}

let deckCssInjected = false;
const DECK_CSS = `
.e-swipe-deck{position:relative;min-width:0;user-select:none;-webkit-user-select:none;isolation:isolate}
.e-swipe-deck[data-axis='x']{touch-action:pan-y}.e-swipe-deck[data-axis='y']{touch-action:pan-x}
.e-swipe-deck__stage{position:relative;width:100%;height:100%;min-height:inherit;perspective:1000px}
.e-swipe-deck__card{position:absolute;inset:0;transform-origin:50% 86%;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform,opacity;transition:transform .34s cubic-bezier(.16,1,.3,1),opacity .25s ease,filter .25s ease;pointer-events:none}
.e-swipe-deck__card[data-depth='0']{z-index:4;opacity:1;transform:translate3d(var(--e-deck-drag-x,0px),var(--e-deck-drag-y,0px),0) rotate(var(--e-deck-drag-r,0deg)) scale(1);pointer-events:auto;cursor:grab}
.e-swipe-deck[data-dragging='true'] .e-swipe-deck__card[data-depth='0']{transition:none;cursor:grabbing}
.e-swipe-deck__card[data-depth='1']{z-index:3;opacity:.82;transform:translate3d(0,12px,-1px) scale(.955) rotate(-1.1deg);filter:saturate(.88)}
.e-swipe-deck__card[data-depth='2']{z-index:2;opacity:.56;transform:translate3d(0,25px,-2px) scale(.91) rotate(1.2deg);filter:saturate(.72)}
.e-swipe-deck__card[data-depth='3']{z-index:1;opacity:.32;transform:translate3d(0,38px,-3px) scale(.87);filter:saturate(.6)}
.e-swipe-deck__card[data-depth='4']{z-index:0;opacity:.2;transform:translate3d(0,50px,-4px) scale(.84);filter:saturate(.5)}
.e-swipe-deck__card[data-hidden='true']{opacity:0;visibility:hidden}
.e-swipe-deck:focus-visible{outline:3px solid var(--e-accent,#205f4a);outline-offset:5px;border-radius:inherit}
@media(prefers-reduced-motion:reduce){.e-swipe-deck[data-respect-reduced-motion='true'] .e-swipe-deck__card{transition:none!important}.e-swipe-deck[data-respect-reduced-motion='true'] .e-swipe-deck__card[data-depth='0']{transform:none!important}}
`.trim();

function injectDeckCss() {
	if (typeof document === "undefined" || deckCssInjected) return;
	deckCssInjected = true;
	const tag = document.createElement("style");
	tag.id = "__engine_swipe_deck__";
	tag.textContent = DECK_CSS;
	document.head.appendChild(tag);
}

function loop(index: number, length: number) { return length <= 0 ? 0 : ((index % length) + length) % length; }

export const EngineSwipeDeck = memo(function EngineSwipeDeck({
	children,
	depth = 3,
	axis = "x",
	virtualize = false,
	swipeThreshold = 58,
	autoplayMs = 0,
	resumeDelay = 1800,
	respectReducedMotion = true,
	ariaLabel = "Swipeable card deck",
	onIndexChange,
	className,
	style,
	cprop,
	id,
	point,
	...props
}: EngineSwipeDeckProps) {
	const items = useMemo(() => Children.toArray(children), [children]);
	const [active, setActive] = useState(0);
	const activeRef = useRef(0);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const draggingRef = useRef(false);
	const animatingRef = useRef(false);
	const pointerRef = useRef<{ id: number; startX: number; startY: number; startedAt: number; moved: boolean } | null>(null);
	const suppressClickUntilRef = useRef(0);
	const resumeTimerRef = useRef<number | null>(null);
	const autoplayTimerRef = useRef<number | null>(null);
	const viewportActiveRef = useRef(true);
	const stateClass = useCpropClass(cprop);
	const mergedClass = ["e-swipe-deck", className, stateClass].filter(Boolean).join(" ");
	const resolvedStyle = usePrimitiveStyles(props as Record<string, unknown>, { defaults: { minHeight: "320px" }, style });
	const resolvedId = id ?? point;
	const visibleDepth = Math.max(1, Math.min(4, Math.floor(depth)));
	const threshold = Math.max(24, Math.min(180, swipeThreshold));

	const renderedCards = useMemo(() => {
		if (!virtualize || items.length <= visibleDepth + 1) {
			return items.map((child, index) => ({ child, index, cardDepth: loop(index - active, items.length) }));
		}
		return Array.from({ length: Math.min(items.length, visibleDepth + 1) }, (_, cardDepth) => {
			const index = loop(active + cardDepth, items.length);
			return { child: items[index], index, cardDepth };
		});
	}, [active, items, virtualize, visibleDepth]);

	const clearAutoplay = useCallback(() => {
		if (autoplayTimerRef.current !== null && typeof window !== "undefined") window.clearInterval(autoplayTimerRef.current);
		autoplayTimerRef.current = null;
	}, []);

	const resetDrag = useCallback(() => {
		const root = rootRef.current;
		if (!root) return;
		root.style.removeProperty("--e-deck-drag-x");
		root.style.removeProperty("--e-deck-drag-y");
		root.style.removeProperty("--e-deck-drag-r");
		delete root.dataset.dragging;
	}, []);

	const motionReduced = useCallback(() => {
		return respectReducedMotion && typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}, [respectReducedMotion]);

	const commitIndex = useCallback((next: number) => {
		activeRef.current = next;
		setActive(next);
		// Important: parent callbacks must not run from inside a React state updater.
		onIndexChange?.(next);
	}, [onIndexChange]);

	const advance = useCallback(async (direction: 1 | -1) => {
		if (items.length < 2 || animatingRef.current) return;
		const next = loop(activeRef.current + direction, items.length);
		const activeCard = rootRef.current?.querySelector<HTMLElement>(".e-swipe-deck__card[data-depth='0']");
		animatingRef.current = true;

		try {
			if (activeCard?.animate && !motionReduced()) {
				const sign = direction > 0 ? -1 : 1;
				const exit = axis === "y"
					? `translate3d(0,${sign * 118}%,0) rotate(${sign * 2.5}deg) scale(.96)`
					: `translate3d(${sign * 118}%,8px,0) rotate(${sign * 8}deg) scale(.96)`;
				const computed = window.getComputedStyle(activeCard);
				const startTransform = computed.transform === "none" ? "translate3d(0,0,0) rotate(0deg) scale(1)" : computed.transform;
				const startOpacity = Number.parseFloat(computed.opacity) || 1;
				const animation = activeCard.animate([
					{ opacity: startOpacity, transform: startTransform },
					{ opacity: 0, transform: exit },
				], { duration: 260, easing: "cubic-bezier(.22,.8,.24,1)", fill: "forwards" });
				await animation.finished.catch(() => undefined);
				animation.cancel();
			}
		} finally {
			resetDrag();
			commitIndex(next);
			animatingRef.current = false;
		}
	}, [axis, commitIndex, items.length, motionReduced, resetDrag]);

	const scheduleAutoplay = useCallback(() => {
		clearAutoplay();
		if (autoplayMs <= 0 || items.length < 2 || !viewportActiveRef.current || typeof window === "undefined") return;
		if (motionReduced()) return;
		autoplayTimerRef.current = window.setInterval(() => {
			if (!draggingRef.current && !animatingRef.current && viewportActiveRef.current) void advance(1);
		}, Math.max(1600, autoplayMs));
	}, [advance, autoplayMs, clearAutoplay, items.length, motionReduced]);

	const pauseThenResume = useCallback(() => {
		clearAutoplay();
		if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		resumeTimerRef.current = window.setTimeout(scheduleAutoplay, Math.max(300, resumeDelay));
	}, [clearAutoplay, resumeDelay, scheduleAutoplay]);

	useEffect(() => {
		activeRef.current = active;
	}, [active]);

	useEffect(() => {
		injectDeckCss();
		const root = rootRef.current;
		if (!root) return;
		return EngineScheduler.observe(root, (snapshot) => {
			viewportActiveRef.current = snapshot.visible || snapshot.near;
			if (viewportActiveRef.current) scheduleAutoplay(); else clearAutoplay();
		}, { nearMargin: "240px 0px", visibleThreshold: 0.01, releaseWhenFar: true });
	}, [clearAutoplay, scheduleAutoplay]);

	useEffect(() => {
		scheduleAutoplay();
		return () => {
			clearAutoplay();
			if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		};
	}, [clearAutoplay, scheduleAutoplay]);

	useEffect(() => {
		if (active < items.length || items.length === 0) return;
		commitIndex(0);
	}, [active, commitIndex, items.length]);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || items.length < 2 || animatingRef.current) return;
		pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startedAt: performance.now(), moved: false };
		draggingRef.current = true;
		try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
		pauseThenResume();
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const pointer = pointerRef.current;
		const root = rootRef.current;
		if (!pointer || !draggingRef.current || pointer.id !== event.pointerId || !root) return;
		const dx = event.clientX - pointer.startX;
		const dy = event.clientY - pointer.startY;
		const primary = axis === "y" ? dy : dx;
		const cross = axis === "y" ? dx : dy;
		if (Math.abs(cross) > Math.abs(primary) * 1.35 && Math.abs(cross) > 10) return;
		if (Math.abs(primary) > 6) pointer.moved = true;
		root.dataset.dragging = "true";
		root.style.setProperty("--e-deck-drag-x", `${axis === "y" ? Math.max(-12, Math.min(12, dx * .18)) : dx}px`);
		root.style.setProperty("--e-deck-drag-y", `${axis === "y" ? dy : Math.min(10, Math.abs(dx) * .025)}px`);
		root.style.setProperty("--e-deck-drag-r", `${axis === "y" ? Math.max(-2.5, Math.min(2.5, dx * .04)) : Math.max(-8, Math.min(8, dx * .018))}deg`);
	};

	const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const pointer = pointerRef.current;
		if (!pointer || pointer.id !== event.pointerId) return;
		const delta = axis === "y" ? event.clientY - pointer.startY : event.clientX - pointer.startX;
		const elapsed = Math.max(1, performance.now() - pointer.startedAt);
		const moved = pointer.moved || Math.abs(delta) > 6;
		const shouldAdvance = Math.abs(delta) >= threshold || (Math.abs(delta) >= 24 && Math.abs(delta) / elapsed > .55);
		pointerRef.current = null;
		draggingRef.current = false;
		try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* optional */ }
		if (moved) suppressClickUntilRef.current = performance.now() + 220;
		if (shouldAdvance) {
			void advance(delta < 0 ? 1 : -1);
		} else {
			resetDrag();
		}
		pauseThenResume();
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (axis === "y") {
			if (event.key === "ArrowDown") { event.preventDefault(); void advance(1); pauseThenResume(); }
			if (event.key === "ArrowUp") { event.preventDefault(); void advance(-1); pauseThenResume(); }
		} else {
			if (event.key === "ArrowRight") { event.preventDefault(); void advance(1); pauseThenResume(); }
			if (event.key === "ArrowLeft") { event.preventDefault(); void advance(-1); pauseThenResume(); }
		}
	};

	return (
		<div
			ref={rootRef}
			id={resolvedId}
			className={mergedClass}
			style={resolvedStyle}
			data-axis={axis}
			data-respect-reduced-motion={respectReducedMotion ? "true" : "false"}
			role="group"
			aria-roledescription="carousel"
			aria-orientation={axis === "y" ? "vertical" : "horizontal"}
			aria-label={ariaLabel}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={finishPointer}
			onPointerCancel={finishPointer}
			onKeyDown={onKeyDown}
			onClickCapture={(event) => {
				if (performance.now() < suppressClickUntilRef.current) { event.preventDefault(); event.stopPropagation(); }
			}}
			onDragStart={(event) => event.preventDefault()}
			onMouseEnter={clearAutoplay}
			onMouseLeave={pauseThenResume}
		>
			<div className="e-swipe-deck__stage">
				{renderedCards.map(({ child, index, cardDepth }) => {
					const hidden = !virtualize && cardDepth > visibleDepth;
					const key = React.isValidElement(child) && child.key != null ? String(child.key) : String(index);
					return (
						<div key={key} className="e-swipe-deck__card" data-depth={hidden ? visibleDepth + 1 : cardDepth} data-hidden={hidden ? "true" : "false"} aria-hidden={cardDepth === 0 ? undefined : true}>
							{child}
						</div>
					);
				})}
			</div>
		</div>
	);
});

EngineSwipeDeck.displayName = "EngineSwipeDeck";
export default EngineSwipeDeck;
