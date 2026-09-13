// ============================================================================
// BrowserEvents.ts
// ============================================================================

import { EngineScrollAnimation } from "../EngineScrollAnimation";
import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { BrowserScheduler } from "./BrowserScheduler";

const SCROLL_KEYS = new Set([
	"ArrowDown",
	"ArrowUp",
	"End",
	"Home",
	"PageDown",
	"PageUp",
	" ",
]);

export class BrowserEvents {
	private static readonly USER_SCROLL_IDLE_MS = 130;
	private static readonly TOUCH_SCROLL_IDLE_MS = 280;
	private static readonly TOUCH_MOMENTUM_GRACE_MS = 1200;
	private static initialized = false;
	private static hiddenAt: number | null = null;
	private static scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;
	private static touchActive = false;
	private static lastTouchEndTime = Number.NEGATIVE_INFINITY;

	public static initialize(update: () => void): void {
		BrowserScheduler.setUpdate(update);
		if (this.initialized) return;
		this.initialized = true;

		window.addEventListener("scroll", () => this.onScroll(update), { passive: true });
		window.addEventListener("resize", () => this.onResize(update), { passive: true });
		window.addEventListener("orientationchange", () => this.onResize(update), { passive: true });
		window.addEventListener("wheel", this.onUserScrollIntent, { passive: true });
		window.addEventListener("touchstart", () => this.onTouchStart(update), { passive: true });
		window.addEventListener("touchend", () => this.onTouchEnd(update), { passive: true });
		window.addEventListener("touchcancel", () => this.onTouchEnd(update), { passive: true });
		window.addEventListener("keydown", this.onKeyDown);
		document.addEventListener("visibilitychange", () => this.onVisibility(update));
	}

	private static onUserScrollIntent = (): void => {
		EngineScrollAnimation.interrupt();
	};

	private static onTouchStart(update: () => void): void {
		EngineScrollAnimation.interrupt();
		this.touchActive = true;
		if (this.scrollIdleTimer !== null) {
			clearTimeout(this.scrollIdleTimer);
			this.scrollIdleTimer = null;
		}

		const cache = EngineScrollRuntime.get().getCache();
		if (cache.isUserScrolling) {
			cache.userScrollIdleUntil = Number.POSITIVE_INFINITY;
			BrowserScheduler.request(update);
		}
	}

	private static onTouchEnd(update: () => void): void {
		this.touchActive = false;
		const now = performance.now();
		this.lastTouchEndTime = now;
		const cache = EngineScrollRuntime.get().getCache();
		if (!cache.isUserScrolling) return;

		cache.userScrollIdleUntil = now + this.TOUCH_SCROLL_IDLE_MS;
		this.scheduleScrollIdleCheck(update, this.TOUCH_SCROLL_IDLE_MS);
	}

	private static onKeyDown = (event: KeyboardEvent): void => {
		const target = event.target;
		if (target instanceof HTMLElement) {
			const tagName = target.tagName;
			if (
				target.isContentEditable
				|| tagName === "INPUT"
				|| tagName === "TEXTAREA"
				|| tagName === "SELECT"
			) {
				return;
			}
		}
		if (SCROLL_KEYS.has(event.key)) EngineScrollAnimation.interrupt();
	};

	private static scrollIdleDelay(now: number): number {
		return this.touchActive
			|| now - this.lastTouchEndTime <= this.TOUCH_MOMENTUM_GRACE_MS
			? this.TOUCH_SCROLL_IDLE_MS
			: this.USER_SCROLL_IDLE_MS;
	}

	private static scheduleScrollIdleCheck(update: () => void, delay: number): void {
		if (this.scrollIdleTimer !== null) clearTimeout(this.scrollIdleTimer);
		this.scrollIdleTimer = setTimeout(() => {
			this.scrollIdleTimer = null;
			BrowserScheduler.request(update);
		}, Math.max(0, delay));
	}

	private static onScroll(update: () => void): void {
		const cache = EngineScrollRuntime.get().getCache();
		const now = performance.now();
		cache.scrollY = window.scrollY;
		cache.scrollX = window.scrollX;

		const programmatic = cache.isAnimating || now <= cache.programmaticScrollUntil;
		if (!programmatic) {
			const idleDelay = this.scrollIdleDelay(now);
			cache.lastUserScrollTime = now;
			cache.userScrollIdleUntil = this.touchActive
				? Number.POSITIVE_INFINITY
				: now + idleDelay;
			cache.isUserScrolling = true;
			if (!this.touchActive) this.scheduleScrollIdleCheck(update, idleDelay);
		}
		BrowserScheduler.request(update);
	}

	private static onResize(update: () => void): void {
		// EngineScrollBrowser.update() owns browser measurement. Do not pre-write
		// the cache here or it loses the old dimensions needed to detect a layout
		// change and invalidate registered point geometry.
		BrowserScheduler.request(update);
	}

	private static onVisibility(update: () => void): void {
		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();

		if (document.hidden) {
			if (this.hiddenAt === null) this.hiddenAt = performance.now();
			if (this.scrollIdleTimer !== null) {
				clearTimeout(this.scrollIdleTimer);
				this.scrollIdleTimer = null;
			}
			BrowserScheduler.cancel();
			return;
		}

		const now = performance.now();
		if (this.hiddenAt !== null) {
			const hiddenDuration = Math.max(0, now - this.hiddenAt);
			const animation = runtime.getMutableState().animation;
			if (animation.active) animation.startTime += hiddenDuration;
			if (Number.isFinite(cache.userScrollIdleUntil)) {
				cache.userScrollIdleUntil += hiddenDuration;
			}
			this.hiddenAt = null;
		}

		cache.lastTimestamp = 0;
		cache.scrollX = window.scrollX;
		cache.scrollY = window.scrollY;
		if (cache.isUserScrolling && !this.touchActive) {
			this.scheduleScrollIdleCheck(
				update,
				Math.max(0, cache.userScrollIdleUntil - now),
			);
		}
		BrowserScheduler.request(update);
	}
}
