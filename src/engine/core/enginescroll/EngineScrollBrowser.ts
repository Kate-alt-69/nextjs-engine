// ============================================================================
// EngineScrollBrowser.ts
// ============================================================================

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

	/**
	 * Historical opt-in hook for applications that intentionally want to own
	 * browser scroll restoration. Core EngineScroll does not call this for you.
	 */
	public static initialize(): void {
		if (typeof window === "undefined") return;
		if ("scrollRestoration" in history) history.scrollRestoration = "manual";
	}

	public static update(): void {
		const cache = EngineScrollRuntime.get().getCache();
		cache.scrollX = window.scrollX;
		cache.scrollY = window.scrollY;
		cache.viewportWidth = window.innerWidth;
		cache.viewportHeight = window.innerHeight;
		cache.documentWidth = document.documentElement.scrollWidth;
		cache.documentHeight = document.documentElement.scrollHeight;
		cache.devicePixelRatio = window.devicePixelRatio;
	}

	public static scrollTo(top: number, left = window.scrollX): void {
		window.scrollTo({ top, left, behavior: "instant" });
	}

	public static getTimestamp(): number {
		return performance.now();
	}
}
