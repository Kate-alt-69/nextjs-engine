"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — useInView
//
//  SSR-safe IntersectionObserver hook. Native observers are pooled by matching
//  root/rootMargin/threshold options so large lazy pages do not allocate one
//  IntersectionObserver instance per element.
// ─────────────────────────────────────────────────────────────────────────────

import {
	useEffect,
	useRef,
	useState,
	type RefObject,
} from "react";

export interface UseInViewOptions {
	/** CSS margin around the root. Default: "200px 0px". */
	rootMargin?: string;
	/** Intersection ratio thresholds. Default: 0. */
	threshold?: number | number[];
	/** Disconnect this element after its first intersection. Default: true. */
	once?: boolean;
	/** Custom root element (default: browser viewport). */
	root?: Element | null;
	/** Start as in-view — useful for above-fold elements. Default: false. */
	initialInView?: boolean;
}

export interface UseInViewReturn<T extends Element = Element> {
	ref: RefObject<T | null>;
	inView: boolean;
	entry: IntersectionObserverEntry | null;
}

type IntersectionListener = (entry: IntersectionObserverEntry) => void;

interface ObserverPool {
	observer: IntersectionObserver;
	listeners: Map<Element, Set<IntersectionListener>>;
}

const viewportObserverPools = new Map<string, ObserverPool>();
const rootedObserverPools = new WeakMap<Element, Map<string, ObserverPool>>();

function thresholdKey(threshold: number | number[]): string {
	return Array.isArray(threshold) ? threshold.join(",") : String(threshold);
}

function getPoolMap(root: Element | null): Map<string, ObserverPool> {
	if (!root) return viewportObserverPools;
	let pools = rootedObserverPools.get(root);
	if (!pools) {
		pools = new Map();
		rootedObserverPools.set(root, pools);
	}
	return pools;
}

function observePooled(
	element: Element,
	root: Element | null,
	rootMargin: string,
	threshold: number | number[],
	listener: IntersectionListener,
): () => void {
	const pools = getPoolMap(root);
	const poolKey = `${rootMargin}|${thresholdKey(threshold)}`;
	let pool = pools.get(poolKey);

	if (!pool) {
		const listeners = new Map<Element, Set<IntersectionListener>>();
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				const targetListeners = listeners.get(entry.target);
				if (!targetListeners) continue;
				for (const targetListener of [...targetListeners]) {
					targetListener(entry);
				}
			}
		}, { root, rootMargin, threshold });
		pool = { observer, listeners };
		pools.set(poolKey, pool);
	}

	let targetListeners = pool.listeners.get(element);
	if (!targetListeners) {
		targetListeners = new Set();
		pool.listeners.set(element, targetListeners);
		pool.observer.observe(element);
	}
	targetListeners.add(listener);

	let active = true;
	return () => {
		if (!active) return;
		active = false;

		const listeners = pool!.listeners.get(element);
		if (listeners) {
			listeners.delete(listener);
			if (listeners.size === 0) {
				pool!.listeners.delete(element);
				pool!.observer.unobserve(element);
			}
		}

		if (pool!.listeners.size === 0) {
			pool!.observer.disconnect();
			pools.delete(poolKey);
		}
	};
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
	const hasIntersectedRef = useRef(initialInView);
	const thresholdSignature = thresholdKey(threshold);

	useEffect(() => {
		if (typeof window === "undefined") return;
		if (once && hasIntersectedRef.current) return;

		if (!("IntersectionObserver" in window)) {
			hasIntersectedRef.current = true;
			setInView(true);
			return;
		}

		const element = ref.current;
		if (!element) return;

		let unsubscribe = () => undefined;
		unsubscribe = observePooled(
			element,
			root,
			rootMargin,
			threshold,
			(nextEntry) => {
				setEntry(nextEntry);
				if (nextEntry.isIntersecting) {
					hasIntersectedRef.current = true;
					setInView(true);
					if (once) unsubscribe();
				} else if (!once) {
					setInView(false);
				}
			},
		);

		return unsubscribe;
	}, [once, root, rootMargin, thresholdSignature]);

	return { ref, inView, entry };
}

/** Pre-load 400 px before entry — good for images. */
export function useImageInView<T extends Element = Element>(priority = false) {
	return useInView<T>({
		rootMargin: "400px 0px",
		once: true,
		initialInView: priority,
	});
}

/** Pre-load 600 px before entry — good for heavy sections. */
export function useSectionInView<T extends Element = Element>(eager = false) {
	return useInView<T>({
		rootMargin: "600px 0px",
		once: true,
		initialInView: eager,
	});
}

/** Only trigger when actually visible — good for analytics / animations. */
export function useVisibleInView<T extends Element = Element>() {
	return useInView<T>({
		rootMargin: "0px",
		threshold: 0.1,
		once: false,
	});
}
