// ============================================================================
// EngineScrollBrowser.ts
// ============================================================================

import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

/** Browser compatibility and measurement helpers used by EngineScroll. */
export class EngineScrollBrowser {
	private static readonly ua = typeof navigator !== "undefined"
		? navigator.userAgent
		: "";

	public static readonly isFirefox = /firefox/i.test(this.ua);
	public static readonly isChromium = /chrome|chromium|crios|edg/i.test(this.ua);
	public static readonly isSafari = /safari/i.test(this.ua)
		&& !/chrome|chromium|crios|edg/i.test(this.ua);

	public static initialize(): void {
		if (typeof window === "undefined") return;
		// Keep browser/Next.js history restoration ownership intact. EngineScroll
		// only controls scroll position for explicit Engine movement operations.
	}

	public static update(): void {
		const cache = EngineScrollRuntime.get().getCache();
		const previousDocumentHeight = cache.documentHeight;
		const previousDocumentWidth = cache.documentWidth;
		const previousViewportHeight = cache.viewportHeight;
		const previousViewportWidth = cache.viewportWidth;

		cache.scrollX = window.scrollX;
		cache.scrollY = window.scrollY;
		cache.viewportWidth = window.innerWidth;
		cache.viewportHeight = window.innerHeight;
		cache.documentWidth = document.documentElement.scrollWidth;
		cache.documentHeight = document.documentElement.scrollHeight;
		cache.devicePixelRatio = window.devicePixelRatio;

		if (
			previousDocumentHeight !== cache.documentHeight
			|| previousDocumentWidth !== cache.documentWidth
			|| previousViewportHeight !== cache.viewportHeight
			|| previousViewportWidth !== cache.viewportWidth
		) {
			EngineScrollPointManager.invalidateAll();
		}
	}

	public static scrollTo(top: number, left = window.scrollX): void {
		window.scrollTo({ top, left, behavior: "instant" });
	}

	public static getTimestamp(): number {
		return performance.now();
	}
}
