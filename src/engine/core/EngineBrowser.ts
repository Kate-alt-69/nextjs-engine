"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineBrowser
//
//  Browser detection, feature detection, and browser-conditional execution.
//
//  EngineBrowser is purely client-side. It returns safe server-side defaults
//  when called during SSR (window is undefined). Components that need browser
//  info should call it inside a useEffect or use the useBrowser() React hook.
//
//  DETECTION APPROACH:
//  We combine UA string parsing (for browser name) with CSS / JS feature
//  detection (for capability checks). UA is sufficient for basic branching;
//  feature detection is used for anything that actually matters for rendering.
//
//  WHY RAF OVER CSS scroll-behavior: smooth?
//  Our EngineScroll uses requestAnimationFrame + easing functions rather than
//  CSS scroll-behavior. This is intentional and correct:
//    · CSS smooth scroll gives you zero control over duration or easing curve.
//    · RAF gives you configurable duration, easing (ease-in-out / spring / etc.)
//    · Safari has historically had bugs with CSS scroll-behavior on <body>.
//    · RAF works identically across all browsers including Chromium builds.
//    · prefers-reduced-motion is respected by EngineScroll's RAF path.
//  There is no "Chromium inshittification" that affects RAF — it is a core
//  primitive guaranteed by every browser specification since 2012.
//
//  SUPPORTED BROWSERS:
//    Chrome, Chromium, Edge, Brave, Opera GX, Osmium,
//    Firefox, Safari, Samsung Internet, WebView, and unknowns.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

// ── Browser name union ────────────────────────────────────────────────────────

export type BrowserName =
	| "chrome"
	| "edge"
	| "opera"
	| "brave"
	| "osmium"
	| "samsung"
	| "webview"
	| "firefox"
	| "safari"
	| "unknown"
	| "server";  // SSR context — no window

// ── Rendering engine ──────────────────────────────────────────────────────────

export type RenderingEngine = "blink" | "gecko" | "webkit" | "unknown" | "server";

// ── Browser detection result ──────────────────────────────────────────────────

export interface BrowserIs {
	/** Any Chromium-based browser (Chrome, Edge, Brave, Opera, Osmium, Samsung, WebView) */
	chromium:   boolean;
	chrome:     boolean;
	edge:       boolean;
	opera:      boolean;
	brave:      boolean;
	osmium:     boolean;
	samsung:    boolean;
	webview:    boolean;
	firefox:    boolean;
	safari:     boolean;
	webkit:     boolean;
	gecko:      boolean;
	mobile:     boolean;
	tablet:     boolean;
	desktop:    boolean;
	/** macOS or iOS */
	apple:      boolean;
	android:    boolean;
	windows:    boolean;
	linux:      boolean;
}

// ── Feature detection result ──────────────────────────────────────────────────

export interface BrowserSupports {
	// Scroll & animation
	/** CSS scroll-behavior: smooth — native */
	nativeSmoothScroll:   boolean;
	/** View Transitions API (Chrome 111+, Edge 111+) */
	viewTransitions:      boolean;
	/** Scroll-driven animations via ScrollTimeline */
	scrollTimeline:       boolean;
	/** CSS scroll-snap */
	scrollSnap:           boolean;

	// CSS features
	/** CSS @container queries */
	containerQueries:     boolean;
	/** CSS :has() selector */
	cssHas:               boolean;
	/** CSS nesting */
	cssNesting:           boolean;
	/** CSS @layer */
	cssLayer:             boolean;
	/** CSS color-mix() */
	colorMix:             boolean;

	// Layout
	/** CSS subgrid */
	subgrid:              boolean;
	/** CSS masonry layout */
	masonry:              boolean;

	// Canvas & GPU
	webgl:                boolean;
	webgl2:               boolean;
	offscreenCanvas:      boolean;

	// Media & input
	/** pointer: coarse → touch-primary device */
	touchPrimary:         boolean;
	/** pointer: fine → mouse/stylus */
	mousePrimary:         boolean;
	/** Prefer reduced motion OS setting is active */
	reducedMotion:        boolean;
	/** Prefer color-scheme: dark */
	prefersDark:          boolean;
	/** High dynamic range display */
	hdr:                  boolean;

	// Misc
	webWorkers:           boolean;
	serviceWorker:        boolean;
	/** Persistent storage (localStorage / indexedDB) */
	storage:              boolean;
	clipboard:            boolean;
	/** Vibration API (mobile) */
	vibration:            boolean;
	/** Geolocation API */
	geolocation:          boolean;
	/** Web Share API */
	webShare:             boolean;
}

// ── Full browser info ─────────────────────────────────────────────────────────

export interface BrowserInfo {
	name:       BrowserName;
	engine:     RenderingEngine;
	version:    string;
	is:         BrowserIs;
	supports:   BrowserSupports;
}

// ── Server-side defaults ──────────────────────────────────────────────────────

const SERVER_IS: BrowserIs = {
	chromium: false, chrome: false, edge: false, opera: false,
	brave: false, osmium: false, samsung: false, webview: false,
	firefox: false, safari: false, webkit: false, gecko: false,
	mobile: false, tablet: false, desktop: false,
	apple: false, android: false, windows: false, linux: false,
};

const SERVER_SUPPORTS: BrowserSupports = {
	nativeSmoothScroll: false, viewTransitions: false,
	scrollTimeline: false, scrollSnap: true,
	containerQueries: false, cssHas: false, cssNesting: false,
	cssLayer: false, colorMix: false, subgrid: false, masonry: false,
	webgl: false, webgl2: false, offscreenCanvas: false,
	touchPrimary: false, mousePrimary: true,
	reducedMotion: false, prefersDark: false, hdr: false,
	webWorkers: false, serviceWorker: false, storage: false,
	clipboard: false, vibration: false, geolocation: false, webShare: false,
};

const SERVER_INFO: BrowserInfo = {
	name:     "server",
	engine:   "server",
	version:  "0",
	is:       SERVER_IS,
	supports: SERVER_SUPPORTS,
};

// ── UA detection ──────────────────────────────────────────────────────────────

function detectName(ua: string): { name: BrowserName; version: string } {
	// Most-specific checks first to avoid false positives.
	// Edge, Brave, Opera all include "Chrome" in their UA — check them first.

	const match = (pattern: RegExp): string =>
		(pattern.exec(ua)?.[1] ?? "0");

	if (/Osmium/i.test(ua))
		return { name: "osmium",  version: match(/Osmium\/([\d.]+)/i) };

	if (/OPR\/|Opera Mini/i.test(ua))
		return { name: "opera",   version: match(/OPR\/([\d.]+)/i) };

	if (/Edg\/|EdgA\//i.test(ua))
		return { name: "edge",    version: match(/Edg\/([\d.]+)/i) };

	// Brave sets navigator.brave
	if (typeof navigator !== "undefined" && (navigator as any).brave)
		return { name: "brave",   version: match(/Chrome\/([\d.]+)/) };

	if (/SamsungBrowser/i.test(ua))
		return { name: "samsung", version: match(/SamsungBrowser\/([\d.]+)/i) };

	// Android WebView: Chrome-like UA but with "wv" token
	if (/\bwv\b/.test(ua) && /Chrome/i.test(ua))
		return { name: "webview", version: match(/Chrome\/([\d.]+)/) };

	if (/Firefox/i.test(ua))
		return { name: "firefox", version: match(/Firefox\/([\d.]+)/i) };

	// Safari must come before Chrome (both appear in some UAs)
	if (/Safari/i.test(ua) && !/Chrome/i.test(ua))
		return { name: "safari",  version: match(/Version\/([\d.]+)/i) };

	if (/Chrome/i.test(ua))
		return { name: "chrome",  version: match(/Chrome\/([\d.]+)/) };

	return { name: "unknown", version: "0" };
}

function detectEngine(name: BrowserName): RenderingEngine {
	const chromiumFamily: BrowserName[] = [
		"chrome", "edge", "opera", "brave", "osmium", "samsung", "webview",
	];
	if (chromiumFamily.includes(name)) return "blink";
	if (name === "firefox")             return "gecko";
	if (name === "safari")              return "webkit";
	return "unknown";
}

// ── Feature detection ─────────────────────────────────────────────────────────

function checkCSSSupport(property: string, value: string): boolean {
	if (typeof CSS === "undefined" || !CSS.supports) return false;
	return CSS.supports(property, value);
}

function detectSupports(): BrowserSupports {
	const win = typeof window  !== "undefined" ? window  : null;
	const nav = typeof navigator !== "undefined" ? navigator : null;

	const mq = (q: string): boolean =>
		win ? win.matchMedia(q).matches : false;

	const hasCanvas = (): boolean => {
		if (!win) return false;
		const el = win.document.createElement("canvas");
		return el instanceof HTMLElement && typeof el.getContext === "function";
	};

	const hasWebGL = (v: "webgl" | "webgl2"): boolean => {
		if (!hasCanvas()) return false;
		try {
			const el  = win!.document.createElement("canvas");
			return !!el.getContext(v);
		} catch { return false; }
	};

	return {
		nativeSmoothScroll: checkCSSSupport("scroll-behavior", "smooth"),
		viewTransitions:    typeof (win?.document as any)?.startViewTransition === "function",
		scrollTimeline:     typeof (win as any)?.ScrollTimeline === "function",
		scrollSnap:         checkCSSSupport("scroll-snap-type", "y mandatory"),

		containerQueries:   checkCSSSupport("container-type",    "inline-size"),
		cssHas:             checkCSSSupport("selector(:has(*))", ""),
		cssNesting:         checkCSSSupport("&", "color: red"),
		cssLayer:           typeof (win?.CSS as any)?.layers !== "undefined" ||
		                    checkCSSSupport("@layer", "base {}"),
		colorMix:           checkCSSSupport("color", "color-mix(in srgb, red, blue)"),

		subgrid:            checkCSSSupport("grid-template-rows", "subgrid"),
		masonry:            checkCSSSupport("grid-template-rows", "masonry"),

		webgl:              hasWebGL("webgl"),
		webgl2:             hasWebGL("webgl2"),
		offscreenCanvas:    typeof (win as any)?.OffscreenCanvas === "function",

		touchPrimary:       mq("(pointer: coarse)"),
		mousePrimary:       mq("(pointer: fine)"),
		reducedMotion:      mq("(prefers-reduced-motion: reduce)"),
		prefersDark:        mq("(prefers-color-scheme: dark)"),
		hdr:                mq("(dynamic-range: high)"),

		webWorkers:    typeof Worker          !== "undefined",
		serviceWorker: typeof (nav as any)?.serviceWorker !== "undefined",
		storage:       typeof localStorage   !== "undefined",
		clipboard:     typeof (nav as any)?.clipboard   !== "undefined",
		vibration:     typeof (nav as any)?.vibrate     === "function",
		geolocation:   typeof (nav as any)?.geolocation !== "undefined",
		webShare:      typeof (nav as any)?.share        === "function",
	};
}

// ── Detect once ───────────────────────────────────────────────────────────────

let _cachedInfo: BrowserInfo | null = null;

function detectBrowser(): BrowserInfo {
	if (typeof window === "undefined") return SERVER_INFO;
	if (_cachedInfo) return _cachedInfo;

	const ua                    = navigator.userAgent;
	const { name, version }     = detectName(ua);
	const engine                = detectEngine(name);
	const chromiumFamily        = ["chrome","edge","opera","brave","osmium","samsung","webview"];
	const s                     = detectSupports();
	const platform              = navigator.platform ?? "";
	const isApple               = /Mac|iPhone|iPad|iPod/i.test(platform);
	const isAndroid             = /Android/i.test(ua);
	const isWindows             = /Win/i.test(platform);
	const isLinux               = /Linux/i.test(platform) && !isAndroid;
	const isMobile              = s.touchPrimary && /Mobi|Android|iPhone/i.test(ua);
	const isTablet              = s.touchPrimary && !isMobile;

	const is: BrowserIs = {
		chromium:  chromiumFamily.includes(name),
		chrome:    name === "chrome",
		edge:      name === "edge",
		opera:     name === "opera",
		brave:     name === "brave",
		osmium:    name === "osmium",
		samsung:   name === "samsung",
		webview:   name === "webview",
		firefox:   name === "firefox",
		safari:    name === "safari",
		webkit:    engine === "webkit",
		gecko:     engine === "gecko",
		mobile:    isMobile,
		tablet:    isTablet,
		desktop:   !isMobile && !isTablet,
		apple:     isApple,
		android:   isAndroid,
		windows:   isWindows,
		linux:     isLinux,
	};

	_cachedInfo = { name, engine, version, is, supports: s };
	return _cachedInfo;
}

// ── Conditional execution ─────────────────────────────────────────────────────

type BrowserConditions<T> = Partial<Record<BrowserName | "chromium" | "webkit" | "gecko" | "mobile" | "desktop" | "default", T>>;

/**
 * Execute different code depending on the browser.
 * The first matching key wins. Use "default" as fallback.
 *
 * @example
 * EngineBrowser.run({
 *   safari:  () => applySafariScrollFix(),
 *   firefox: () => applyFirefoxFix(),
 *   default: () => {},
 * });
 */
function run(conditions: BrowserConditions<() => void>): void {
	if (typeof window === "undefined") return;
	const info = detectBrowser();
	const keys = Object.keys(conditions) as Array<keyof typeof conditions>;

	for (const key of keys) {
		if (key === "default") continue;
		const matches =
			key === "chromium" ? info.is.chromium :
			key === "webkit"   ? info.is.webkit   :
			key === "gecko"    ? info.is.gecko     :
			key === "mobile"   ? info.is.mobile    :
			key === "desktop"  ? info.is.desktop   :
			info.name === key;

		if (matches) {
			conditions[key]?.();
			return;
		}
	}
	conditions.default?.();
}

/**
 * Return a value based on the current browser.
 * Useful for CSS strings, class names, or any per-browser value.
 *
 * @example
 * const scrollClass = EngineBrowser.pick({
 *   safari:  "scroll-ios",
 *   default: "scroll-standard",
 * });
 */
function pick<T>(conditions: BrowserConditions<T>): T | undefined {
	if (typeof window === "undefined") return conditions.default;
	const info = detectBrowser();
	const keys = Object.keys(conditions) as Array<keyof typeof conditions>;

	for (const key of keys) {
		if (key === "default") continue;
		const matches =
			key === "chromium" ? info.is.chromium :
			key === "webkit"   ? info.is.webkit   :
			key === "gecko"    ? info.is.gecko     :
			key === "mobile"   ? info.is.mobile    :
			key === "desktop"  ? info.is.desktop   :
			info.name === key;

		if (matches) return conditions[key] as T;
	}
	return conditions.default;
}

/**
 * Returns CSS for a vendor-prefixed property when needed.
 * In 2026 most prefixes are gone, but Safari still needs -webkit- for some things.
 *
 * @example
 * EngineBrowser.prefixed("backdrop-filter", "blur(8px)")
 * // Safari: "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)"
 * // Others: "backdrop-filter:blur(8px)"
 */
function prefixed(property: string, value: string): string {
	const info = detectBrowser();
	// Safari/WebKit still benefits from -webkit- on some properties
	const needsWebkit = info.is.webkit && (
		property === "backdrop-filter" ||
		property === "mask" ||
		property === "text-stroke"
	);
	return needsWebkit
		? `-webkit-${property}:${value};${property}:${value}`
		: `${property}:${value}`;
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * React hook for browser info inside components.
 * Returns SERVER_INFO during SSR, then updates after mount.
 *
 * @example
 * function MyComponent() {
 *   const browser = useBrowser();
 *   if (browser.is.safari) return <SafariVariant />;
 *   return <StandardVariant />;
 * }
 */
export function useBrowser(): BrowserInfo {
	const [info, setInfo] = useState<BrowserInfo>(SERVER_INFO);

	useEffect(() => {
		setInfo(detectBrowser());
	}, []);

	return info;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const EngineBrowser = {
	/** Current browser detection. Returns server defaults during SSR. */
	get info():     BrowserInfo  { return detectBrowser(); },
	get is():       BrowserIs    { return detectBrowser().is; },
	get supports(): BrowserSupports { return detectBrowser().supports; },
	get name():     BrowserName  { return detectBrowser().name; },
	get engine():   RenderingEngine { return detectBrowser().engine; },
	get version():  string       { return detectBrowser().version; },

	/** Execute different callbacks by browser. First match wins. */
	run,

	/** Return a value by browser. First match wins. */
	pick,

	/** Return a vendor-prefixed CSS declaration string. */
	prefixed,

	/** Invalidate cached detection (useful after user-agent spoofing in tests). */
	invalidate(): void { _cachedInfo = null; },
} as const;

export type { BrowserConditions };
