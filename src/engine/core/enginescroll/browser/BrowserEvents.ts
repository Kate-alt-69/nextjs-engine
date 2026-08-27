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
	private static initialized = false;
	private static hiddenAt: number | null = null;

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
		if (SCROLL_KEYS.has(event.key)) EngineScrollAnimation.interrupt();
	};

	private static onScroll(update: () => void): void {
		const cache = EngineScrollRuntime.get().getCache();
		cache.scrollY = window.scrollY;
		cache.scrollX = window.scrollX;
		cache.lastUserScrollTime = performance.now();
		cache.isUserScrolling = true;
		BrowserScheduler.request(update);
	}

	private static onResize(update: () => void): void {
		const cache = EngineScrollRuntime.get().getCache();
		cache.viewportHeight = window.innerHeight;
		cache.viewportWidth = window.innerWidth;
		cache.documentHeight = document.documentElement.scrollHeight;
		cache.documentWidth = document.documentElement.scrollWidth;
		BrowserScheduler.request(update);
	}

	private static onVisibility(update: () => void): void {
		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();

		if (document.hidden) {
			if (this.hiddenAt === null) this.hiddenAt = performance.now();
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
		BrowserScheduler.request(update);
	}
}
