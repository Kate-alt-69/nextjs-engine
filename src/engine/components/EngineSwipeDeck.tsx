"use client";

import React, {
	Children,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { EngineScheduler } from "../core/enginescheduler";
import type { BaseNodeProps } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";

export interface EngineSwipeDeckProps extends BaseNodeProps {
	children?: ReactNode;
	/** Number of cards visibly stacked behind the active card. */
	depth?: number;
	/** Horizontal distance in px before a swipe commits. */
	swipeThreshold?: number;
	/** Optional automatic advance interval. 0 disables autoplay. */
	autoplayMs?: number;
	/** Pause autoplay after direct interaction. */
	resumeDelay?: number;
	/** Accessible label for the deck. */
	ariaLabel?: string;
	onIndexChange?: (index: number) => void;
}

let deckCssInjected = false;
const DECK_CSS = `
.e-swipe-deck{position:relative;min-width:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;isolation:isolate}
.e-swipe-deck__stage{position:relative;width:100%;height:100%;min-height:inherit;perspective:1000px}
.e-swipe-deck__card{position:absolute;inset:0;transform-origin:50% 86%;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform,opacity;transition:transform .34s cubic-bezier(.16,1,.3,1),opacity .25s ease,filter .25s ease;pointer-events:none}
.e-swipe-deck__card[data-depth='0']{z-index:4;opacity:1;transform:translate3d(var(--e-deck-drag-x,0px),var(--e-deck-drag-y,0px),0) rotate(var(--e-deck-drag-r,0deg)) scale(1);pointer-events:auto;cursor:grab}
.e-swipe-deck[data-dragging='true'] .e-swipe-deck__card[data-depth='0']{transition:none;cursor:grabbing}
.e-swipe-deck__card[data-depth='1']{z-index:3;opacity:.82;transform:translate3d(0,12px,-1px) scale(.955) rotate(-1.1deg);filter:saturate(.88)}
.e-swipe-deck__card[data-depth='2']{z-index:2;opacity:.56;transform:translate3d(0,25px,-2px) scale(.91) rotate(1.2deg);filter:saturate(.72)}
.e-swipe-deck__card[data-depth='3']{z-index:1;opacity:.32;transform:translate3d(0,38px,-3px) scale(.87);filter:saturate(.6)}
.e-swipe-deck__card[data-hidden='true']{opacity:0;transform:translate3d(0,46px,-4px) scale(.84);visibility:hidden}
.e-swipe-deck:focus-visible{outline:3px solid var(--e-accent,#205f4a);outline-offset:5px;border-radius:inherit}
@media(prefers-reduced-motion:reduce){.e-swipe-deck__card{transition:none!important}.e-swipe-deck__card[data-depth='0']{transform:none!important}}
`.trim();

function injectDeckCss(): void {
	if (typeof document === "undefined" || deckCssInjected) return;
	deckCssInjected = true;
	const style = document.createElement("style");
	style.id = "__engine_swipe_deck__";
	style.textContent = DECK_CSS;
	document.head.appendChild(style);
}

function normalizedIndex(index: number, length: number): number {
	if (length <= 0) return 0;
	return ((index % length) + length) % length;
}

export const EngineSwipeDeck = memo(function EngineSwipeDeck({
	children,
	depth = 3,
	swipeThreshold = 58,
	autoplayMs = 0,
	resumeDelay = 1800,
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
	const resolvedStyle = usePrimitiveStyles(props as Record<string, unknown>, {
		defaults: { minHeight: "320px" },
		style,
	});
	const resolvedId = id ?? point;
	const visibleDepth = Math.max(1, Math.min(4, Math.floor(depth)));
	const threshold = Math.max(24, Math.min(180, swipeThreshold));

	const clearAutoplay = useCallback(() => {
		if (autoplayTimerRef.current !== null) window.clearInterval(autoplayTimerRef.current);
		autoplayTimerRef.current = null;
	}, []);

	const resetDragVars = useCallback(() => {
		const root = rootRef.current;
		if (!root) return;
		root.style.removeProperty("--e-deck-drag-x");
		root.style.removeProperty("--e-deck-drag-y");
		root.style.removeProperty("--e-deck-drag-r");
		delete root.dataset.dragging;
	}, []);

	const advance = useCallback(async (direction: 1 | -1) => {
		if (items.length < 2 || animatingRef.current) return;
		const root = rootRef.current;
		const activeCard = root?.querySelector<HTMLElement>(".e-swipe-deck__card[data-depth='0']");
		animatingRef.current = true;
		resetDragVars();

		if (activeCard && typeof activeCard.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			const sign = direction > 0 ? -1 : 1;
			const animation = activeCard.animate([
				{ opacity: 1, transform: "translate3d(0,0,0) rotate(0deg) scale(1)" },
				{ opacity: 0, transform: `translate3d(${sign * 118}%,8px,0) rotate(${sign * 8}deg) scale(.96)` },
			], { duration: 240, easing: "cubic-bezier(.22,.8,.24,1)", fill: "forwards" });
			await animation.finished.catch(() => undefined);
			animation.cancel();
		}

		setActive((current) => {
			const next = normalizedIndex(current + direction, items.length);
			onIndexChange?.(next);
			return next;
		});
		animatingRef.current = false;
	}, [items.length, onIndexChange, resetDragVars]);

	const scheduleAutoplay = useCallback(() => {
		clearAutoplay();
		if (autoplayMs <= 0 || items.length < 2 || !viewportActiveRef.current || typeof window === "undefined") return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		autoplayTimerRef.current = window.setInterval(() => {
			if (!draggingRef.current && !animatingRef.current && viewportActiveRef.current) void advance(1);
		}, Math.max(1600, autoplayMs));
	}, [advance, autoplayMs, clearAutoplay, items.length]);

	const pauseThenResume = useCallback(() => {
		clearAutoplay();
		if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		resumeTimerRef.current = window.setTimeout(scheduleAutoplay, Math.max(300, resumeDelay));
	}, [clearAutoplay, resumeDelay, scheduleAutoplay]);

	useEffect(() => {
		injectDeckCss();
		const root = rootRef.current;
		if (!root) return;
		const stop = EngineScheduler.observe(root, (snapshot) => {
			viewportActiveRef.current = snapshot.visible || snapshot.near;
			if (viewportActiveRef.current) scheduleAutoplay();
			else clearAutoplay();
		}, { nearMargin: "240px 0px", visibleThreshold: 0.01, releaseWhenFar: true });
		return () => stop();
	}, [clearAutoplay, scheduleAutoplay]);

	useEffect(() => {
		scheduleAutoplay();
		return () => {
			clearAutoplay();
			if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
		};
	}, [clearAutoplay, scheduleAutoplay]);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || items.length < 2 || animatingRef.current) return;
		pointerRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startedAt: performance.now(), moved: false };
		draggingRef.current = true;
		try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* capture is optional */ }
		pauseThenResume();
	};

	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const pointer = pointerRef.current;
		const root = rootRef.current;
		if (!pointer || !draggingRef.current || pointer.id !== event.pointerId || !root) return;
		const dx = event.clientX - pointer.startX;
		const dy = event.clientY - pointer.startY;
		if (Math.abs(dy) > Math.abs(dx) * 1.35 && Math.abs(dy) > 10) return;
		if (Math.abs(dx) > 6) pointer.moved = true;
		root.dataset.dragging = "true";
		root.style.setProperty("--e-deck-drag-x", `${dx}px`);
		root.style.setProperty("--e-deck-drag-y", `${Math.min(10, Math.abs(dx) * .025)}px`);
		root.style.setProperty("--e-deck-drag-r", `${Math.max(-8, Math.min(8, dx * .018))}deg`);
	};

	const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const pointer = pointerRef.current;
		if (!pointer || pointer.id !== event.pointerId) return;
		const dx = event.clientX - pointer.startX;
		const elapsed = Math.max(1, performance.now() - pointer.startedAt);
		const velocity = Math.abs(dx) / elapsed;
		const moved = pointer.moved || Math.abs(dx) > 6;
		pointerRef.current = null;
		draggingRef.current = false;
		try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* browser may already release */ }
		resetDragVars();
		if (moved) suppressClickUntilRef.current = performance.now() + 220;
		if (Math.abs(dx) >= threshold || (Math.abs(dx) >= 24 && velocity > .55)) {
			void advance(dx < 0 ? 1 : -1);
		}
		pauseThenResume();
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "ArrowRight") { event.preventDefault(); void advance(1); pauseThenResume(); }
		if (event.key === "ArrowLeft") { event.preventDefault(); void advance(-1); pauseThenResume(); }
	};

	const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
		if (performance.now() >= suppressClickUntilRef.current) return;
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<div
			ref={rootRef}
			id={resolvedId}
			className={mergedClass}
			style={resolvedStyle}
			role="group"
			aria-roledescription="carousel"
			aria-label={ariaLabel}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={finishPointer}
			onPointerCancel={finishPointer}
			onKeyDown={onKeyDown}
			onClickCapture={onClickCapture}
			onMouseEnter={clearAutoplay}
			onMouseLeave={pauseThenResume}
		>
			<div className="e-swipe-deck__stage">
				{items.map((child, index) => {
					const cardDepth = normalizedIndex(index - active, items.length);
					const hidden = cardDepth > visibleDepth;
					return (
						<div
							key={index}
							className="e-swipe-deck__card"
							data-depth={hidden ? visibleDepth + 1 : cardDepth}
							data-hidden={hidden ? "true" : "false"}
							aria-hidden={cardDepth === 0 ? undefined : true}
						>
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
