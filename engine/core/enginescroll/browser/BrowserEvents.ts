// ============================================================================
// BrowserEvents.ts
// ============================================================================

import { EngineScrollRuntime } from "../EngineScrollRuntime";
import { BrowserScheduler } from "./BrowserScheduler";

export class BrowserEvents {

	private static initialized = false;

	// -------------------------------------------------------------------------

	public static initialize(
		update: () => void,
	): void {

		if (this.initialized) {
			return;
		}

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
			this.onVisibility,
		);

	}

	// -------------------------------------------------------------------------

	private static onScroll(
		update: () => void,
	): void {
	
		const cache =
			EngineScrollRuntime
				.get()
				.getCache();
	
		cache.scrollY =
			window.scrollY;
	
		cache.scrollX =
			window.scrollX;
	
		cache.lastUserScrollTime =
			performance.now();
	
		cache.isUserScrolling = true;
	
		BrowserScheduler.request(
			update,
		);
	
	}

	// -------------------------------------------------------------------------

	private static onResize(
		update: () => void,
	): void {

		const cache =
			EngineScrollRuntime
				.get()
				.getCache();

		cache.viewportHeight =
			window.innerHeight;

		cache.documentHeight =
			document.documentElement.scrollHeight;

		BrowserScheduler.request(update);

	}

	// -------------------------------------------------------------------------

	private static onVisibility(): void {

		if (!document.hidden) {
			return;
		}

		BrowserScheduler.cancel();

	}

}