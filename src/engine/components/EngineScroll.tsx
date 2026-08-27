"use client";

import React, {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { EngineBrowser } from "../core/EngineBrowser";
import type { EngineScrollProps } from "../schema/types";

interface ScrollContextValue {
	navigateTo: (href: string) => void;
	smoothScrollTo: (elementId: string, offsetPx?: number) => void;
}

const EngineScrollContext = createContext<ScrollContextValue | null>(null);

export function useEngineScroll(): ScrollContextValue | null {
	return useContext(EngineScrollContext);
}

type EasingFn = (t: number) => number;

const EASING: Record<NonNullable<EngineScrollProps["easing"]>, EasingFn> = {
	"ease-in-out": (t) => t < 0.5
		? 4 * t * t * t
		: 1 - Math.pow(-2 * t + 2, 3) / 2,
	"ease-in": (t) => t * t * t,
	"ease-out": (t) => 1 - Math.pow(1 - t, 3),
	linear: (t) => t,
	spring: (t) => {
		const c4 = (2 * Math.PI) / 3;
		if (t === 0) return 0;
		if (t === 1) return 1;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	},
};

function decodeAnchorId(value: string): string {
	const raw = value.startsWith("#") ? value.slice(1) : value;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

export interface EngineScrollProviderProps extends EngineScrollProps {
	children?: ReactNode;
}

export const EngineScrollProvider = memo(function EngineScrollProvider({
	children,
	method = "ease",
	scrollDuration = 600,
	easing = "ease-in-out",
	pageTransition = true,
	transitionDuration = 350,
	transitionColor = "var(--e-bg, #ffffff)",
	scrollOffset = 80,
}: EngineScrollProviderProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [visible, setVisible] = useState(!pageTransition);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const activeRafRef = useRef<number | null>(null);
	const pendingAnchorRef = useRef<string | null>(null);
	const navigatingRef = useRef(false);
	const mountedRef = useRef(false);

	const easingFn = EASING[easing] ?? EASING["ease-in-out"];
	const parsedOffset = typeof scrollOffset === "number"
		? scrollOffset
		: Number.parseFloat(scrollOffset);
	const offsetPx = Number.isFinite(parsedOffset) ? parsedOffset : 80;
	const safeScrollDuration = Number.isFinite(scrollDuration)
		? Math.max(0, scrollDuration)
		: 600;
	const safeTransitionDuration = Number.isFinite(transitionDuration)
		? Math.max(0, transitionDuration)
		: 350;

	const cancelEaseScroll = useCallback((): void => {
		if (activeRafRef.current === null) return;
		cancelAnimationFrame(activeRafRef.current);
		activeRafRef.current = null;
	}, []);

	const easeScrollTo = useCallback((targetY: number): void => {
		cancelEaseScroll();
		if (EngineBrowser.supports.reducedMotion || safeScrollDuration === 0) {
			window.scrollTo(0, targetY);
			return;
		}

		const startY = window.scrollY;
		const delta = targetY - startY;
		const startTime = performance.now();
		if (EngineBrowser.is.safari) window.scrollTo(window.scrollX, window.scrollY);

		const step = (now: number): void => {
			const progress = Math.min(Math.max((now - startTime) / safeScrollDuration, 0), 1);
			window.scrollTo(0, startY + delta * easingFn(progress));
			if (progress < 1) {
				activeRafRef.current = requestAnimationFrame(step);
			} else {
				activeRafRef.current = null;
			}
		};

		activeRafRef.current = requestAnimationFrame(step);
	}, [cancelEaseScroll, easingFn, safeScrollDuration]);

	const smoothScrollTo = useCallback((elementId: string, customOffset?: number): void => {
		const element = document.getElementById(decodeAnchorId(elementId));
		if (!element) return;

		const offset = customOffset ?? offsetPx;
		const targetY = element.getBoundingClientRect().top + window.scrollY - offset;

		if (method === "instant") {
			cancelEaseScroll();
			window.scrollTo(0, targetY);
			return;
		}

		if (method === "smooth") {
			cancelEaseScroll();
			window.scrollTo({
				top: targetY,
				left: window.scrollX,
				behavior: EngineBrowser.supports.reducedMotion ? "auto" : "smooth",
			});
			return;
		}

		if (method === "snap") {
			cancelEaseScroll();
			element.scrollIntoView({
				behavior: EngineBrowser.supports.reducedMotion ? "auto" : "smooth",
				block: "start",
			});
			return;
		}

		easeScrollTo(targetY);
	}, [cancelEaseScroll, easeScrollTo, method, offsetPx]);

	const navigateTo = useCallback(async (href: string): Promise<void> => {
		let url: URL;
		try {
			url = new URL(href, window.location.href);
		} catch {
			return;
		}

		if ((url.protocol !== "http:" && url.protocol !== "https:")
			|| url.origin !== window.location.origin) {
			window.location.assign(url.href);
			return;
		}

		const targetPath = url.pathname + url.search;
		const currentPath = window.location.pathname + window.location.search;
		const anchor = url.hash.slice(1);

		if (targetPath === currentPath) {
			if (!anchor) return;
			if (window.location.hash !== url.hash) {
				window.history.pushState(null, "", targetPath + url.hash);
			}
			smoothScrollTo(anchor);
			return;
		}

		const animateTransition = pageTransition && !EngineBrowser.supports.reducedMotion;
		if (animateTransition && navigatingRef.current) return;
		pendingAnchorRef.current = anchor || null;

		if (animateTransition) {
			navigatingRef.current = true;
			setVisible(false);
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, safeTransitionDuration);
			});
			if (!mountedRef.current) return;
		}

		router.push(targetPath + url.hash);
		navigatingRef.current = false;
	}, [pageTransition, router, safeTransitionDuration, smoothScrollTo]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			cancelEaseScroll();
		};
	}, [cancelEaseScroll]);

	useEffect(() => {
		navigatingRef.current = false;
		if (!pageTransition || EngineBrowser.supports.reducedMotion) {
			setVisible(true);
			return;
		}

		const fadeFrame = requestAnimationFrame(() => setVisible(true));
		return () => cancelAnimationFrame(fadeFrame);
	}, [pageTransition, pathname]);

	useEffect(() => {
		const anchor = pendingAnchorRef.current ?? window.location.hash.slice(1);
		pendingAnchorRef.current = null;
		if (!anchor || anchor.startsWith("-es?")) return;

		const delay = pageTransition && !EngineBrowser.supports.reducedMotion
			? safeTransitionDuration + 50
			: 0;
		const timer = window.setTimeout(() => smoothScrollTo(anchor), delay);
		return () => window.clearTimeout(timer);
	}, [pageTransition, pathname, safeTransitionDuration, smoothScrollTo]);

	useEffect(() => {
		const handleHistoryAnchor = (): void => {
			const hash = window.location.hash;
			if (!hash || hash.startsWith("#-es?")) return;
			smoothScrollTo(hash.slice(1));
		};

		window.addEventListener("hashchange", handleHistoryAnchor);
		window.addEventListener("popstate", handleHistoryAnchor);
		return () => {
			window.removeEventListener("hashchange", handleHistoryAnchor);
			window.removeEventListener("popstate", handleHistoryAnchor);
		};
	}, [smoothScrollTo]);

	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;

		const handleAnchorClick = (event: MouseEvent): void => {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			if (!(event.target instanceof Element)) return;

			const anchor = event.target.closest("a[href]");
			if (!(anchor instanceof HTMLAnchorElement) || !root.contains(anchor)) return;
			if (anchor.hasAttribute("download")) return;

			const target = anchor.getAttribute("target");
			if (target && target.toLowerCase() !== "_self") return;

			let url: URL;
			try {
				url = new URL(anchor.href, window.location.href);
			} catch {
				return;
			}

			if (!url.hash || url.origin !== window.location.origin) return;
			event.preventDefault();
			void navigateTo(url.href);
		};

		root.addEventListener("click", handleAnchorClick, { capture: true });
		return () => root.removeEventListener("click", handleAnchorClick, { capture: true });
	}, [navigateTo]);

	const containerStyle: CSSProperties = {
		...(pageTransition ? { background: transitionColor } : {}),
		...(method === "snap"
			? {
				height: "100vh",
				overflowY: "scroll",
				scrollSnapType: "y mandatory",
				scrollBehavior: EngineBrowser.supports.reducedMotion ? "auto" : "smooth",
				scrollPaddingTop: `${offsetPx}px`,
			}
			: {}),
	};
	const contentStyle: CSSProperties = {
		opacity: pageTransition ? (visible ? 1 : 0) : 1,
		transition: pageTransition && !EngineBrowser.supports.reducedMotion
			? `opacity ${safeTransitionDuration}ms ease`
			: undefined,
	};
	const contextValue = useMemo<ScrollContextValue>(
		() => ({ navigateTo, smoothScrollTo }),
		[navigateTo, smoothScrollTo],
	);

	return (
		<EngineScrollContext.Provider value={contextValue}>
			<div ref={containerRef} style={containerStyle}>
				<div style={contentStyle}>{children}</div>
			</div>
		</EngineScrollContext.Provider>
	);
});

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
