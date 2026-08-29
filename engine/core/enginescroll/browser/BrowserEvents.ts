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
	private static initialized = false;
	private static hiddenAt: number | null = null;
	private static scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

	public static initialize(update: () => void): void {
		BrowserScheduler.setUpdate(update);
		if (this.initialized) return;
		this.initialized = true;

		window.addEventListener("scroll", () => this.onScroll(update), { passive: true });
		window.addEventListener("resize", () => this.onResize(update), { passive: true });
		window.addEventListener("orientationchange", () => this.onResize(update), { passive: true });
		window.addEventListener("wheel", this.onUserScrollIntent, { passive: true });
		window.addEventListener("touchstart", this.onUserScrollIntent, { passive: true });
		window.addEventListener("keydown", this.onKeyDown);
		document.addEventListener("visibilitychange", () => this.onVisibility(update));
	}

	private static onUserScrollIntent = (): void => {
		EngineScrollAnimation.interrupt();
	};

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

	private static scheduleScrollIdleCheck(update: () => void): void {
		if (this.scrollIdleTimer !== null) clearTimeout(this.scrollIdleTimer);
		this.scrollIdleTimer = setTimeout(() => {
			this.scrollIdleTimer = null;
			BrowserScheduler.request(update);
		}, this.USER_SCROLL_IDLE_MS);
	}

	private static onScroll(update: () => void): void {
		const cache = EngineScrollRuntime.get().getCache();
		const now = performance.now();
		cache.scrollY = window.scrollY;
		cache.scrollX = window.scrollX;

		const programmatic = cache.isAnimating || now <= cache.programmaticScrollUntil;
		if (!programmatic) {
			cache.lastUserScrollTime = now;
			cache.isUserScrolling = true;
			this.scheduleScrollIdleCheck(update);
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
			this.hiddenAt = null;
		}

		cache.lastTimestamp = 0;
		cache.scrollX = window.scrollX;
		cache.scrollY = window.scrollY;
		if (cache.isUserScrolling) this.scheduleScrollIdleCheck(update);
		BrowserScheduler.request(update);
	}
}
