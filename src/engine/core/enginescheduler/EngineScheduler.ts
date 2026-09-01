// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — work scheduler
//
// The scheduler removes unnecessary work before sacrificing frame delivery. It
// deliberately does not lower image, Canvas, Shader, or video resolution as a
// response to frame pressure.
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineWorkClass } from "../../compiler/types";
import {
	ECFrameClock,
	resolveAdaptiveTargetFps,
} from "../enginecanvas/ECFrameClock";

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
	const key = `${rootMargin}|${threshold}`;
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
		if (pool.listeners.size > 0) return;
		pool.observer.disconnect();
		viewportPools.delete(key);
	};
}

class EngineSchedulerRuntime {
	private frameSamples: number[] = [];
	private framePressure = false;
	private pressureListeners = new Set<(underPressure: boolean) => void>();
	private frameMonitorUsers = 0;
	private frameMonitorRaf = 0;
	private frameClock = new ECFrameClock(48);
	private highestObservedRefreshRate = 60;

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
		if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(targetFrameMs) || targetFrameMs <= 0) return;
		this.frameSamples.push(durationMs / targetFrameMs);
		if (this.frameSamples.length > 36) this.frameSamples.shift();
		if (this.frameSamples.length < 10) return;

		const ordered = [...this.frameSamples].sort((left, right) => left - right);
		const averageLoad = this.frameSamples.reduce((total, sample) => total + sample, 0) / this.frameSamples.length;
		const percentileIndex = Math.min(ordered.length - 1, Math.floor(ordered.length * 0.75));
		const p75Load = ordered[percentileIndex];
		const nextPressure = this.framePressure
			? averageLoad > 1.06 || p75Load > 1.08
			: averageLoad > 1.14 || p75Load > 1.18;
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

	/**
	 * Share one refresh-aware RAF pressure monitor across graphics runtimes.
	 * Consumers acquire it only while they own visible-capable animated work.
	 */
	acquireFrameMonitor(): () => void {
		if (typeof window === "undefined") return () => undefined;
		this.frameMonitorUsers += 1;
		if (this.frameMonitorUsers === 1) this.startFrameMonitor();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.frameMonitorUsers = Math.max(0, this.frameMonitorUsers - 1);
			if (this.frameMonitorUsers === 0) this.stopFrameMonitor();
		};
	}

	runWhenIdle(task: () => void, timeout = 1500): () => void {
		if (typeof window === "undefined") return () => undefined;
		let cancelled = false;
		let timer: number | undefined;
		const run = () => {
			if (cancelled) return;
			if (this.framePressure) {
				timer = window.setTimeout(run, 120);
				return;
			}
			task();
		};

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

	private frameMonitorTick = (now: number): void => {
		this.frameMonitorRaf = 0;
		if (this.frameMonitorUsers === 0 || typeof document === "undefined" || document.hidden) return;
		const timing = this.frameClock.step(now);
		if (timing.delta > 0) {
			const detectedRefreshRate = resolveAdaptiveTargetFps("display", timing.refreshRate);
			this.highestObservedRefreshRate = Math.max(this.highestObservedRefreshRate, detectedRefreshRate);
			this.reportFrame(timing.delta, 1000 / this.highestObservedRefreshRate);
		}
		this.frameMonitorRaf = window.requestAnimationFrame(this.frameMonitorTick);
	};

	private handleVisibilityChange = (): void => {
		this.frameClock.discontinuity();
		if (document.hidden) {
			if (this.frameMonitorRaf !== 0) window.cancelAnimationFrame(this.frameMonitorRaf);
			this.frameMonitorRaf = 0;
			return;
		}
		if (this.frameMonitorUsers > 0 && this.frameMonitorRaf === 0) {
			this.frameMonitorRaf = window.requestAnimationFrame(this.frameMonitorTick);
		}
	};

	private startFrameMonitor(): void {
		this.frameClock.discontinuity();
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		if (!document.hidden && this.frameMonitorRaf === 0) {
			this.frameMonitorRaf = window.requestAnimationFrame(this.frameMonitorTick);
		}
	}

	private stopFrameMonitor(): void {
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		if (this.frameMonitorRaf !== 0) window.cancelAnimationFrame(this.frameMonitorRaf);
		this.frameMonitorRaf = 0;
		this.frameClock.discontinuity();
		this.frameSamples = [];
		this.highestObservedRefreshRate = 60;
		if (!this.framePressure) return;
		this.framePressure = false;
		for (const listener of [...this.pressureListeners]) listener(false);
	}
}

export const EngineScheduler = new EngineSchedulerRuntime();
