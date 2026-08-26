// ============================================================================
// BrowserEvents.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { BrowserScheduler } from "./BrowserScheduler";

export class BrowserEvents {
	private static initialized = false;

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
		cache.documentHeight = document.documentElement.scrollHeight;
		BrowserScheduler.request(update);
	}

	private static onVisibility(update: () => void): void {
		if (document.hidden) {
			BrowserScheduler.cancel();
			return;
		}
		// Refresh once on resume. If an EngineScroll animation is still active,
		// BrowserScheduler will continue scheduling until it finishes.
		BrowserScheduler.request(update);
	}
}
