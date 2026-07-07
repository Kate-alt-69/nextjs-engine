"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineScroll
//
//  The smooth-scroll + anchor-point + page-transition system.
//
//  What it does:
//
//    ANCHOR POINTS ("point" prop)
//      Any engine node can declare itself as a scroll point by adding
//      `point: "name"` to its props. This sets the element's HTML id so it
//      is reachable via `#name` in the URL bar.
//      EngineMarkdown h1/h2 headings become points automatically (opt-out
//      with disablepointformarkdownhash / disablepointformarkdownhashhash).
//
//    SAME-PAGE NAVIGATION  (e.g. /about → /about#team)
//      Click on any <a href="#name"> inside EngineScroll and the page
//      scrolls to the matching point smoothly, using the configured method.
//
//    CROSS-PAGE NAVIGATION  (e.g. /about#team → /pricing#enterprise)
//      1. Current page fades out (opacity 1 → 0, configurable duration)
//      2. Next.js router.push() fires — new route loads
//      3. New page's EngineScrollProvider mounts invisible (opacity 0)
//      4. New page fades in (opacity 0 → 1)
//      5. After fade, smooth-scrolls to the anchor point
//
//    SMOOTH SCROLL ENGINE
//      "ease"    — JS requestAnimationFrame with configurable easing curve
//                  (Google-style: ease-in-out by default)
//      "smooth"  — Delegates to native CSS scroll-behavior: smooth
//      "snap"    — CSS scroll-snap-type on the container; points get
//                  scroll-snap-align: start. No JS needed.
//      "instant" — No animation, instant jump.
//
//    EASING FUNCTIONS  (method: "ease" only)
//      "ease-in-out"  — cubic: slow start, fast middle, slow end (default)
//      "ease-in"      — quadratic: slow start, fast end
//      "ease-out"     — quadratic: fast start, slow end
//      "linear"       — constant speed
//      "spring"       — slight overshoot and settle (physically based)
//
//  Usage:
//
//    Schema (recommended):
//      {
//        type: "scroll",
//        props: { method: "ease", pageTransition: true },
//        children: [...]
//      }
//
//    Direct JSX:
//      <EngineScrollProvider method="ease" pageTransition>
//        <YourPageContent />
//      </EngineScrollProvider>
//
//  Scroll points in schema:
//      { type: "section", props: { point: "features", ... } }
//      → <section id="features"> accessible at /page#features
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	memo,
	type ReactNode,
	type CSSProperties,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { EngineBrowser } from "../core/EngineBrowser";
import type { EngineScrollProps } from "../schema/types";

// ── Context ───────────────────────────────────────────────────────────────────

interface ScrollContextValue {
	/** Navigate to href, applying smooth scroll + page transition as needed. */
	navigateTo: (href: string) => void;
	/** Smooth-scroll to an element by its id on the current page. */
	smoothScrollTo: (elementId: string, offsetPx?: number) => void;
}

const EngineScrollContext = createContext<ScrollContextValue | null>(null);

export function useEngineScroll(): ScrollContextValue | null {
	return useContext(EngineScrollContext);
}

// ── Easing functions ──────────────────────────────────────────────────────────
//  Each takes a progress value t ∈ [0, 1] and returns an eased t ∈ [0, 1].

type EasingFn = (t: number) => number;

const EASING: Record<NonNullable<EngineScrollProps["easing"]>, EasingFn> = {
	"ease-in-out": (t) =>
		t < 0.5
			? 4 * t * t * t
			: 1 - Math.pow(-2 * t + 2, 3) / 2,

	"ease-in": (t) => t * t * t,

	"ease-out": (t) => 1 - Math.pow(1 - t, 3),

	linear: (t) => t,

	spring: (t) => {
		// Damped spring: overshoots slightly then settles
		const c4 = (2 * Math.PI) / 3;
		if (t === 0) return 0;
		if (t === 1) return 1;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	},
};

// ── RAF smooth-scroll utility ─────────────────────────────────────────────────

function rafScrollTo(
	targetY: number,
	durationMs: number,
	easingFn: EasingFn,
): void {
	// Respect prefers-reduced-motion: reduce — instant jump, no animation.
	// This is an accessibility requirement; some users experience motion sickness.
	if (EngineBrowser.supports.reducedMotion) {
		window.scrollTo(0, targetY);
		return;
	}

	// If the browser natively handles scrollTimeline and the user explicitly
	// chose method:"smooth", we'd skip RAF. But for "ease" (our default) we
	// always use RAF — it gives precise control over easing curve and duration
	// that CSS scroll-behavior: smooth can never provide.

	const startY    = window.scrollY;
	const delta     = targetY - startY;
	const startTime = performance.now();

	// Safari has a quirk where calling window.scrollTo() inside a RAF frame
	// while the page is already mid-momentum-scroll can cause jitter.
	// We cancel any pending native scroll first via scrollTo with exact current.
	if (EngineBrowser.is.safari) window.scrollTo(window.scrollX, window.scrollY);

	let rafId: number;

	const step = (now: number): void => {
		const elapsed  = now - startTime;
		const progress = Math.min(elapsed / durationMs, 1);
		const eased    = easingFn(progress);
		window.scrollTo(0, startY + delta * eased);
		if (progress < 1) { rafId = requestAnimationFrame(step); }
	};

	rafId = requestAnimationFrame(step);
	// rafId exposed on window so EngineScroll can cancel it on unmount if needed
	(window as any).__e_scrollRaf = rafId;
}

// ── EngineScrollProvider ──────────────────────────────────────────────────────

export interface EngineScrollProviderProps extends EngineScrollProps {
	children?: ReactNode;
}

export const EngineScrollProvider = memo(function EngineScrollProvider({
	children,
	method           = "ease",
	scrollDuration   = 600,
	easing           = "ease-in-out",
	pageTransition   = true,
	transitionDuration = 350,
	transitionColor  = "var(--e-bg, #ffffff)",
	scrollOffset     = 80,
}: EngineScrollProviderProps) {
	const router    = useRouter();
	const pathname  = usePathname();

	// ── Page fade state ───────────────────────────────────────────────────────
	// Starts invisible so we can fade in cleanly on every mount.
	const [visible, setVisible]               = useState(false);
	const pendingAnchorRef                    = useRef<string | null>(null);
	const isMountedRef                        = useRef(false);
	const navigatingRef                       = useRef(false);

	const easingFn   = EASING[easing] ?? EASING["ease-in-out"];
	const offsetPx   = typeof scrollOffset === "number"
		? scrollOffset
		: parseInt(scrollOffset as string, 10) || 80;

	// ── smoothScrollTo ────────────────────────────────────────────────────────

	const smoothScrollTo = useCallback((elementId: string, customOffset?: number): void => {
		const el = document.getElementById(elementId);
		if (!el) return;

		const offset = customOffset ?? offsetPx;

		if (method === "instant") {
			window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - offset);
			return;
		}

		if (method === "smooth" || method === "snap") {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}

		// "ease" — JS RAF
		const targetY = el.getBoundingClientRect().top + window.scrollY - offset;
		rafScrollTo(targetY, scrollDuration, easingFn);
	}, [method, scrollDuration, easingFn, offsetPx]);

	// ── navigateTo ────────────────────────────────────────────────────────────

	const navigateTo = useCallback(async (href: string): Promise<void> => {
		// Resolve the href against the current origin
		let url: URL;
		try {
			url = new URL(href, window.location.origin);
		} catch {
			return;
		}

		const anchor      = url.hash.slice(1);  // without "#"
		const targetPath  = url.pathname + url.search;
		const currentPath = window.location.pathname + window.location.search;
		const samePage    = targetPath === currentPath || (!url.pathname && url.hash);

		if (samePage) {
			// ── Same page: just smooth-scroll ─────────────────────────────────
			if (anchor) smoothScrollTo(anchor);
			return;
		}

		// ── Different page: fade out → navigate → (new page fades in + scrolls)

		if (pageTransition) {
			navigatingRef.current = true;
			setVisible(false);
			// Wait for the fade-out transition to complete
			await new Promise((r) => setTimeout(r, transitionDuration));
		}

		// Store the anchor so the new page knows where to scroll on mount
		pendingAnchorRef.current = anchor || null;

		router.push(targetPath + (anchor ? `#${anchor}` : ""));
	}, [router, pageTransition, transitionDuration, smoothScrollTo]);

	// ── On mount: fade in + scroll to URL hash ────────────────────────────────

	useEffect(() => {
		isMountedRef.current = true;

		// Fade in
		const fadeTimer = requestAnimationFrame(() => setVisible(true));

		// Scroll to hash in URL if present (also handles the "pending anchor"
		// set by the previous page's navigateTo call)
		const hashFromUrl = window.location.hash.slice(1);
		const anchor      = pendingAnchorRef.current ?? hashFromUrl;

		if (anchor) {
			// Wait for layout to settle, then scroll after fade begins
			const scrollTimer = setTimeout(() => {
				smoothScrollTo(anchor);
				pendingAnchorRef.current = null;
			}, transitionDuration + 50);

			return () => {
				cancelAnimationFrame(fadeTimer);
				clearTimeout(scrollTimer);
				isMountedRef.current = false;
			};
		}

		return () => {
			cancelAnimationFrame(fadeTimer);
			isMountedRef.current = false;
		};
		// Only runs on mount (pathname change would re-mount in Next.js anyway)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// ── Global anchor-link click interception ─────────────────────────────────
	// Capture phase so we see the click before any inner handlers.

	useEffect(() => {
		const handler = (e: MouseEvent): void => {
			const anchor = (e.target as HTMLElement).closest("a");
			if (!anchor?.href) return;

			// Only intercept same-origin links with a hash
			let url: URL;
			try {
				url = new URL(anchor.href);
			} catch {
				return;
			}

			if (!url.hash) return;
			if (url.origin !== window.location.origin) return;

			e.preventDefault();
			navigateTo(anchor.href);
		};

		document.addEventListener("click", handler, { capture: true });
		return () => document.removeEventListener("click", handler, { capture: true });
	}, [navigateTo]);

	// ── Container styles ──────────────────────────────────────────────────────
	// Opacity + transition for page fade. When method is "snap" we also set up
	// the CSS scroll-snap container on the page.

	const containerStyle: CSSProperties = {
		opacity: pageTransition ? (visible ? 1 : 0) : 1,
		transition: pageTransition
			? `opacity ${transitionDuration}ms ease`
			: undefined,
		...(method === "snap"
			? {
					height:         "100vh",
					overflowY:      "scroll",
					scrollSnapType: "y mandatory",
					scrollBehavior: "smooth",
			  }
			: {}),
	};

	return (
		<EngineScrollContext.Provider value={{ navigateTo, smoothScrollTo }}>
			<div style={containerStyle}>
				{children}
			</div>
		</EngineScrollContext.Provider>
	);
});

// ── Default export — what the registry maps "scroll" to ──────────────────────

export const EngineScroll = memo(function EngineScroll({
	children,
	...props
}: EngineScrollProviderProps) {
	return (
		<EngineScrollProvider {...props}>
			{children}
		</EngineScrollProvider>
	);
});
