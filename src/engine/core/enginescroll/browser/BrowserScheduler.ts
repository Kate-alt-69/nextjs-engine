// ============================================================================
// BrowserScheduler.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";

/** Owns the single requestAnimationFrame used by EngineScroll. */
export class BrowserScheduler {
	private static frameRequested = false;
	private static rerunRequested = false;
	private static cancelled = false;
	private static updateCallback: (() => void) | null = null;

	public static setUpdate(update: () => void): void {
		this.updateCallback = update;
	}

	public static request(update?: () => void): void {
		if (update) this.updateCallback = update;
		const callback = this.updateCallback;
		if (!callback || typeof requestAnimationFrame === "undefined") return;

		const cache = EngineScrollRuntime.get().getCache();
		if (this.frameRequested) {
			this.rerunRequested = true;
			cache.pending = true;
			return;
		}

		this.cancelled = false;
		this.frameRequested = true;
		cache.pending = true;

		const rafId = requestAnimationFrame((timestamp) => {
			cache.pending = false;
			cache.running = true;
			cache.lastFrameTime = cache.lastTimestamp === 0
				? 16
				: timestamp - cache.lastTimestamp;
			cache.lastTimestamp = timestamp;
			cache.frame++;

			let completed = false;
			try {
				callback();
				completed = true;
			} finally {
				cache.running = false;
				if (cache.rafId === rafId) cache.rafId = null;
				this.frameRequested = false;

				const shouldContinue = completed
					&& !this.cancelled
					&& (this.rerunRequested || cache.isAnimating);

				this.rerunRequested = false;
				cache.pending = false;
				if (shouldContinue) this.request();
			}
		});

		cache.rafId = rafId;
	}

	public static cancel(): void {
		const cache = EngineScrollRuntime.get().getCache();
		this.cancelled = true;
		this.rerunRequested = false;

		if (cache.rafId !== null && !cache.running) {
			cancelAnimationFrame(cache.rafId);
		}

		cache.rafId = null;
		cache.pending = false;
		if (!cache.running) this.frameRequested = false;
	}
}
