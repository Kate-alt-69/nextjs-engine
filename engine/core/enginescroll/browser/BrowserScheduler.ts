// ============================================================================
// BrowserScheduler.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";

/** Owns the single requestAnimationFrame used by EngineScroll. */
export class BrowserScheduler {
	private static frameRequested = false;
	private static updateCallback: (() => void) | null = null;

	public static setUpdate(update: () => void): void {
		this.updateCallback = update;
	}

	public static request(update?: () => void): void {
		if (update) this.updateCallback = update;
		const callback = this.updateCallback;
		if (!callback || typeof requestAnimationFrame === "undefined") return;

		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();
		if (this.frameRequested) {
			cache.pending = true;
			return;
		}

		this.frameRequested = true;
		cache.pending = true;
		cache.rafId = requestAnimationFrame((timestamp) => {
			this.frameRequested = false;
			cache.pending = false;
			cache.running = true;
			cache.lastFrameTime = cache.lastTimestamp === 0
				? 16
				: timestamp - cache.lastTimestamp;
			cache.lastTimestamp = timestamp;
			cache.frame++;

			callback();

			cache.running = false;
			cache.rafId = null;

			// Smooth animation owns its continuation. Native scroll/resize events
			// still coalesce into this same RAF instead of creating another loop.
			if (cache.isAnimating) this.request();
		});
	}

	public static cancel(): void {
		const cache = EngineScrollRuntime.get().getCache();
		if (cache.rafId !== null) {
			cancelAnimationFrame(cache.rafId);
			cache.rafId = null;
		}
		cache.pending = false;
		cache.running = false;
		this.frameRequested = false;
	}
}
