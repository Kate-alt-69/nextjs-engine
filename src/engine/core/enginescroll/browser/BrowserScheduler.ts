// ============================================================================
// BrowserScheduler.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";

/**
 * Owns the ONLY requestAnimationFrame used by EngineScroll.
 */
export class BrowserScheduler {

	private static frameRequested = false;

	// -------------------------------------------------------------------------
	// Schedule
	// -------------------------------------------------------------------------

	public static request(update: () => void): void {

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

			cache.lastFrameTime =
				timestamp - cache.lastTimestamp;

			cache.lastTimestamp =
				timestamp;

			cache.frame++;

			update();

			cache.running = false;

			cache.rafId = null;

		});

	}

	// -------------------------------------------------------------------------
	// Cancel
	// -------------------------------------------------------------------------

	public static cancel(): void {

		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();

		if (cache.rafId !== null) {

			cancelAnimationFrame(cache.rafId);

			cache.rafId = null;

		}

		cache.pending = false;

		cache.running = false;

		this.frameRequested = false;

	}

}