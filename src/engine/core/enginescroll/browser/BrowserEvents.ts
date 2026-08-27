// ============================================================================
// BrowserEvents.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { BrowserScheduler } from "./BrowserScheduler";

export class BrowserEvents {
	private static initialized = false;
	private static hiddenAt: number | null = null;

	public static initialize(update: () => void): void {
		BrowserScheduler.setUpdate(update);
		if (this.initialized) return;
		this.initialized = true;

		window.addEventListener(
			"scroll",
			() => this.onScroll(update),
			{ passive: true },
		);
		window.addEventListener(
			"resize",
			() => this.onResize(update),
			{ passive: true },
		);
		window.addEventListener(
			"orientationchange",
			() => this.onResize(update),
			{ passive: true },
		);
		document.addEventListener(
			"visibilitychange",
			() => this.onVisibility(update),
		);
	}

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

		// Do not turn a long hidden interval into one enormous frame delta.
		cache.lastTimestamp = 0;
		cache.scrollX = window.scrollX;
		cache.scrollY = window.scrollY;
		BrowserScheduler.request(update);
	}
}
