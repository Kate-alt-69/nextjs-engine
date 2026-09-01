// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — work scheduler
//
// The scheduler reduces unnecessary work. It deliberately does not lower image,
// Canvas, Shader, or video resolution as a response to frame pressure.
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineWorkClass } from "../../compiler/types";

export interface EngineSchedulePolicy {
	priority?: boolean;
	nearMargin?: string;
	visibleThreshold?: number;
	releaseWhenFar?: boolean;
}

export interface EngineScheduleSnapshot {
	state: EngineWorkClass;
	near: boolean;
	visible: boolean;
	underFramePressure: boolean;
}

export type EngineScheduleListener = (snapshot: EngineScheduleSnapshot) => void;

type ObserverListener = (entry: IntersectionObserverEntry) => void;

interface ObserverPool {
	observer: IntersectionObserver;
	listeners: Map<Element, Set<ObserverListener>>;
}

const viewportPools = new Map<string, ObserverPool>();

function getObserverPool(rootMargin: string, threshold: number): ObserverPool {
	const key = `${rootMargin}|${threshold}`;
	const existing = viewportPools.get(key);
	if (existing) return existing;

	const listeners = new Map<Element, Set<ObserverListener>>();
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const targetListeners = listeners.get(entry.target);
			if (!targetListeners) continue;
			for (const listener of [...targetListeners]) listener(entry);
		}
	}, { root: null, rootMargin, threshold });
	const pool = { observer, listeners };
	viewportPools.set(key, pool);
	return pool;
}

function subscribeObserver(
	element: Element,
	rootMargin: string,
	threshold: number,
	listener: ObserverListener,
): () => void {
	const pool = getObserverPool(rootMargin, threshold);
	let listeners = pool.listeners.get(element);
	if (!listeners) {
		listeners = new Set();
		pool.listeners.set(element, listeners);
		pool.observer.observe(element);
	}
	listeners.add(listener);

	return () => {
		const targetListeners = pool.listeners.get(element);
		if (!targetListeners) return;
		targetListeners.delete(listener);
		if (targetListeners.size > 0) return;
		pool.listeners.delete(element);
		pool.observer.unobserve(element);
	};
}

class EngineSchedulerRuntime {
	private frameSamples: number[] = [];
	private framePressure = false;
	private pressureListeners = new Set<(underPressure: boolean) => void>();

	observe(
		element: Element,
		listener: EngineScheduleListener,
		policy: EngineSchedulePolicy = {},
	): () => void {
		if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
			listener({
				state: policy.priority ? "critical" : "visible",
				near: true,
				visible: true,
				underFramePressure: this.framePressure,
			});
			return () => undefined;
		}

		if (policy.priority) {
			listener({ state: "critical", near: true, visible: true, underFramePressure: this.framePressure });
			return () => undefined;
		}

		const nearMargin = policy.nearMargin ?? "700px 0px";
		const visibleThreshold = policy.visibleThreshold ?? 0.01;
		let near = false;
		let visible = false;
		let currentState: EngineWorkClass = "deferred";

		const emit = () => {
			const nextState: EngineWorkClass = visible
				? "visible"
				: near
					? "near"
					: policy.releaseWhenFar
						? "sleeping"
						: "deferred";
			if (nextState === currentState) return;
			currentState = nextState;
			listener({ state: nextState, near, visible, underFramePressure: this.framePressure });
		};

		listener({ state: currentState, near, visible, underFramePressure: this.framePressure });
		const stopNear = subscribeObserver(element, nearMargin, 0, (entry) => {
			near = entry.isIntersecting;
			emit();
		});
		const stopVisible = subscribeObserver(element, "0px", visibleThreshold, (entry) => {
			visible = entry.isIntersecting;
			if (visible) near = true;
			emit();
		});

		return () => {
			stopNear();
			stopVisible();
		};
	}

	reportFrame(durationMs: number, targetFrameMs: number): void {
		if (!Number.isFinite(durationMs) || durationMs < 0 || !Number.isFinite(targetFrameMs) || targetFrameMs <= 0) return;
		this.frameSamples.push(durationMs / targetFrameMs);
		if (this.frameSamples.length > 30) this.frameSamples.shift();
		if (this.frameSamples.length < 8) return;
		const averageLoad = this.frameSamples.reduce((total, sample) => total + sample, 0) / this.frameSamples.length;
		const nextPressure = this.framePressure ? averageLoad > 0.78 : averageLoad > 0.92;
		if (nextPressure === this.framePressure) return;
		this.framePressure = nextPressure;
		for (const listener of [...this.pressureListeners]) listener(nextPressure);
	}

	isUnderFramePressure(): boolean {
		return this.framePressure;
	}

	subscribeFramePressure(listener: (underPressure: boolean) => void): () => void {
		this.pressureListeners.add(listener);
		return () => this.pressureListeners.delete(listener);
	}

	runWhenIdle(task: () => void, timeout = 1500): () => void {
		if (typeof window === "undefined") return () => undefined;
		let cancelled = false;
		const run = () => {
			if (cancelled) return;
			if (this.framePressure) {
				timer = window.setTimeout(run, 120);
				return;
			}
			task();
		};

		let timer: number | undefined;
		const browser = window as Window & {
			requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		const idleId = browser.requestIdleCallback?.(run, { timeout });
		if (idleId === undefined) timer = window.setTimeout(run, Math.min(timeout, 250));

		return () => {
			cancelled = true;
			if (timer !== undefined) window.clearTimeout(timer);
			if (idleId !== undefined) browser.cancelIdleCallback?.(idleId);
		};
	}
}

export const EngineScheduler = new EngineSchedulerRuntime();
