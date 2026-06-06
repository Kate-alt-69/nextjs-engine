"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — useInView
//
//  SSR-safe IntersectionObserver hook.
//  Returns a [ref, inView, entry] tuple.
//
//  Features:
//    · Configurable rootMargin for pre-loading before viewport entry
//    · threshold array for fine-grained visibility callbacks
//    · once mode — stops observing after first intersection (perfect for lazy mount)
//    · Gracefully degrades when IntersectionObserver is unavailable (old browsers)
//      by treating everything as "in view"
// ─────────────────────────────────────────────────────────────────────────────

import {
	useEffect,
	useRef,
	useState,
	useCallback,
	type RefObject,
} from "react";

export interface UseInViewOptions {
	/**
	 * CSS margin around the root (viewport).
	 * Use positive values to trigger BEFORE the element enters the viewport.
	 * Default: "200px 0px" — start loading 200 px before entering view.
	 */
	rootMargin?: string;
	/** Intersection ratio thresholds. Default: [0] */
	threshold?: number | number[];
	/**
	 * If true, the observer disconnects after the first intersection.
	 * Use this for lazy-mount — no need to keep watching once loaded.
	 * Default: true
	 */
	once?: boolean;
	/** Custom root element (default: browser viewport) */
	root?: Element | null;
	/** Start as in-view — useful for above-fold elements. Default: false */
	initialInView?: boolean;
}

export interface UseInViewReturn<T extends Element = Element> {
	ref: RefObject<T | null>;
	inView: boolean;
	entry: IntersectionObserverEntry | null;
}

export function useInView<T extends Element = Element>({
	rootMargin = "200px 0px",
	threshold = 0,
	once = true,
	root = null,
	initialInView = false,
}: UseInViewOptions = {}): UseInViewReturn<T> {
	const ref = useRef<T | null>(null);
	const [inView, setInView] = useState(initialInView);
	const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
	// Keep a ref to the observer so we can disconnect in cleanup
	const observerRef = useRef<IntersectionObserver | null>(null);

	const disconnect = useCallback(() => {
		if (observerRef.current) {
			observerRef.current.disconnect();
			observerRef.current = null;
		}
	}, []);

	useEffect(() => {
		// SSR guard
		if (typeof window === "undefined") return;
		// Already in view (once mode hit) — nothing to do
		if (once && inView) return;

		// Graceful degradation — treat as in-view if IO not supported
		if (!("IntersectionObserver" in window)) {
			setInView(true);
			return;
		}

		const el = ref.current;
		if (!el) return;

		disconnect();

		observerRef.current = new IntersectionObserver(
			(entries) => {
				const e = entries[0];
				if (!e) return;
				setEntry(e);
				if (e.isIntersecting) {
					setInView(true);
					if (once) disconnect();
				} else if (!once) {
					setInView(false);
				}
			},
			{ rootMargin, threshold, root },
		);

		observerRef.current.observe(el);

		return disconnect;
	}, [rootMargin, threshold, root, once, inView, disconnect]);

	return { ref, inView, entry };
}

// ── Convenience variants ──────────────────────────────────────────────────────

/** Pre-load 400 px before entry — good for images */
export function useImageInView<T extends Element = Element>(priority = false) {
	return useInView<T>({
		rootMargin: "400px 0px",
		once: true,
		initialInView: priority,
	});
}

/** Pre-load 600 px before entry — good for heavy sections */
export function useSectionInView<T extends Element = Element>(eager = false) {
	return useInView<T>({
		rootMargin: "600px 0px",
		once: true,
		initialInView: eager,
	});
}

/** Only trigger when actually visible — good for analytics / animations */
export function useVisibleInView<T extends Element = Element>() {
	return useInView<T>({
		rootMargin: "0px",
		threshold: 0.1,
		once: false,
	});
}
