// ============================================================================
// EngineScrollTimeline.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import {
	bindEngineScrollTimelineStyles,
	type EngineScrollTimelineStyleBindings,
} from "./EngineScrollTimelineBinding";
import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import {
	EngineScrollTimelineTrack,
	type EngineScrollTimelineKeyframe,
} from "./EngineScrollTimelineTrack";
import type {
	EngineScrollAlignment,
	EngineScrollDirection,
	EngineScrollEasingName,
	EngineScrollMoveOptions,
	EngineScrollState,
} from "./EngineScrollTypes";

export type EngineScrollTimelineTarget =
	| number
	| "top"
	| "bottom"
	| `#${string}`;

export type EngineScrollTimelineSource = "top" | "current" | "bottom";

export interface EngineScrollTimelineConfig {
	start: EngineScrollTimelineTarget;
	end: EngineScrollTimelineTarget;
	source?: EngineScrollTimelineSource;
	startOffset?: number;
	endOffset?: number;
	startAlign?: EngineScrollAlignment;
	endAlign?: EngineScrollAlignment;
	easing?: EngineScrollEasingName;
}

export interface EngineScrollTimelineFrame {
	point: number;
	startPoint: number | null;
	endPoint: number | null;
	rawProgress: number;
	progress: number;
	before: boolean;
	active: boolean;
	after: boolean;
	direction: EngineScrollDirection;
	velocity: number;
}

export type EngineScrollTimelineSubscriber = (
	frame: Readonly<EngineScrollTimelineFrame>,
) => void;

export interface EngineScrollTimelineCrossEvent {
	at: number;
	direction: -1 | 1;
	frame: Readonly<EngineScrollTimelineFrame>;
	previousFrame: Readonly<EngineScrollTimelineFrame>;
}

export type EngineScrollTimelineCrossSubscriber = (
	event: Readonly<EngineScrollTimelineCrossEvent>,
) => void;

export type EngineScrollTimelineActivityType = "enter" | "leave";
export type EngineScrollTimelineBoundary = "start" | "end";

export interface EngineScrollTimelineActivityEvent {
	type: EngineScrollTimelineActivityType;
	boundary: EngineScrollTimelineBoundary;
	direction: EngineScrollDirection;
	frame: Readonly<EngineScrollTimelineFrame>;
	previousFrame: Readonly<EngineScrollTimelineFrame>;
}

export type EngineScrollTimelineActivitySubscriber = (
	event: Readonly<EngineScrollTimelineActivityEvent>,
) => void;

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? value! : fallback;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function sameFrame(
	left: EngineScrollTimelineFrame | null,
	right: EngineScrollTimelineFrame,
): boolean {
	if (!left) return false;
	return left.point === right.point
		&& left.startPoint === right.startPoint
		&& left.endPoint === right.endPoint
		&& left.rawProgress === right.rawProgress
		&& left.progress === right.progress
		&& left.before === right.before
		&& left.active === right.active
		&& left.after === right.after
		&& left.direction === right.direction
		&& left.velocity === right.velocity;
}

export class EngineScrollTimeline {
	private readonly runtime = EngineScrollRuntime.get();
	private readonly subscribers = new Set<EngineScrollTimelineSubscriber>();
	private readonly crossSubscribers = new Map<number, Set<EngineScrollTimelineCrossSubscriber>>();
	private readonly enterSubscribers = new Set<EngineScrollTimelineActivitySubscriber>();
	private readonly leaveSubscribers = new Set<EngineScrollTimelineActivitySubscriber>();
	private unsubscribeRuntime: (() => void) | null = null;
	private boundaryRevision = -1;
	private boundaryMaximum = Number.NaN;
	private resolvedStart: number | null = null;
	private resolvedEnd: number | null = null;
	private latestFrame: EngineScrollTimelineFrame | null = null;
	private lastObservedFrame: EngineScrollTimelineFrame | null = null;

	public constructor(public readonly config: Readonly<EngineScrollTimelineConfig>) {}

	private resolveTarget(
		target: EngineScrollTimelineTarget,
		align: EngineScrollAlignment | undefined,
		offset: number,
	): number | null {
		if (typeof target === "string" && target.startsWith("#")) {
			const resolved = EngineScrollPointManager.resolve(target.slice(1), {
				align,
				offset,
			});
			return resolved?.point ?? null;
		}

		return EngineScrollNavigator.resolve(target, {
			align,
			offset,
		}) ?? null;
	}

	private resolveBoundaries(state: Readonly<EngineScrollState>): void {
		const revision = EngineScrollPointManager.revision();
		if (
			this.boundaryRevision === revision
			&& this.boundaryMaximum === state.page.totalPoints
		) {
			return;
		}

		this.resolvedStart = this.resolveTarget(
			this.config.start,
			this.config.startAlign,
			finiteOr(this.config.startOffset, 0),
		);
		this.resolvedEnd = this.resolveTarget(
			this.config.end,
			this.config.endAlign,
			finiteOr(this.config.endOffset, 0),
		);
		this.boundaryRevision = EngineScrollPointManager.revision();
		this.boundaryMaximum = state.page.totalPoints;
	}

	private sourcePoint(state: Readonly<EngineScrollState>): number {
		const source = this.config.source ?? "current";
		return state.viewport[source];
	}

	private createFrame(state: Readonly<EngineScrollState>): EngineScrollTimelineFrame {
		this.resolveBoundaries(state);
		const point = this.sourcePoint(state);
		const cache = this.runtime.getCache();
		if (this.resolvedStart === null || this.resolvedEnd === null) {
			return {
				point,
				startPoint: this.resolvedStart,
				endPoint: this.resolvedEnd,
				rawProgress: 0,
				progress: 0,
				before: true,
				active: false,
				after: false,
				direction: cache.scrollDirection,
				velocity: cache.scrollVelocity,
			};
		}

		const span = this.resolvedEnd - this.resolvedStart;
		let rawProgress: number;
		if (Math.abs(span) < 0.000001) {
			rawProgress = point < this.resolvedStart
				? -1
				: point > this.resolvedStart
					? 2
					: 1;
		} else {
			rawProgress = (point - this.resolvedStart) / span;
		}
		const clampedProgress = clamp01(rawProgress);
		const progress = EngineScrollEasing.resolve(this.config.easing ?? "linear")(
			clampedProgress,
		);

		return {
			point,
			startPoint: this.resolvedStart,
			endPoint: this.resolvedEnd,
			rawProgress,
			progress,
			before: rawProgress < 0,
			active: rawProgress >= 0 && rawProgress <= 1,
			after: rawProgress > 1,
			direction: cache.scrollDirection,
			velocity: cache.scrollVelocity,
		};
	}

	private listenerCount(): number {
		let count = this.subscribers.size + this.enterSubscribers.size + this.leaveSubscribers.size;
		for (const subscribers of this.crossSubscribers.values()) count += subscribers.size;
		return count;
	}

	private ensureRuntimeSubscription(): void {
		if (this.unsubscribeRuntime) return;
		const baseline = this.createFrame(this.runtime.getState());
		this.latestFrame = baseline;
		this.lastObservedFrame = baseline;
		this.unsubscribeRuntime = this.runtime.subscribe(this.handleRuntime);
	}

	private releaseRuntimeSubscription(): void {
		if (this.listenerCount() > 0 || !this.unsubscribeRuntime) return;
		this.unsubscribeRuntime();
		this.unsubscribeRuntime = null;
		this.lastObservedFrame = null;
	}

	private activityBoundary(
		previousFrame: Readonly<EngineScrollTimelineFrame>,
		frame: Readonly<EngineScrollTimelineFrame>,
		type: EngineScrollTimelineActivityType,
	): EngineScrollTimelineBoundary {
		if (type === "enter") {
			return previousFrame.rawProgress > 1 ? "end" : "start";
		}
		return frame.rawProgress > 1 ? "end" : "start";
	}

	private emitActivity(
		previousFrame: Readonly<EngineScrollTimelineFrame>,
		frame: Readonly<EngineScrollTimelineFrame>,
	): void {
		const logicalDirection = Math.sign(
			frame.rawProgress - previousFrame.rawProgress,
		) as EngineScrollDirection;

		if (!previousFrame.active && frame.active && this.enterSubscribers.size > 0) {
			const event: EngineScrollTimelineActivityEvent = {
				type: "enter",
				boundary: this.activityBoundary(previousFrame, frame, "enter"),
				direction: logicalDirection,
				frame,
				previousFrame,
			};
			for (const subscriber of this.enterSubscribers) subscriber(event);
		}

		if (previousFrame.active && !frame.active && this.leaveSubscribers.size > 0) {
			const event: EngineScrollTimelineActivityEvent = {
				type: "leave",
				boundary: this.activityBoundary(previousFrame, frame, "leave"),
				direction: logicalDirection,
				frame,
				previousFrame,
			};
			for (const subscriber of this.leaveSubscribers) subscriber(event);
		}
	}

	private emitCrossings(
		previousFrame: Readonly<EngineScrollTimelineFrame>,
		frame: Readonly<EngineScrollTimelineFrame>,
	): void {
		if (this.crossSubscribers.size === 0) return;
		for (const [at, subscribers] of this.crossSubscribers) {
			let direction: -1 | 1 | null = null;
			if (previousFrame.rawProgress < at && frame.rawProgress >= at) {
				direction = 1;
			} else if (previousFrame.rawProgress > at && frame.rawProgress <= at) {
				direction = -1;
			}
			if (direction === null) continue;

			const event: EngineScrollTimelineCrossEvent = {
				at,
				direction,
				frame,
				previousFrame,
			};
			for (const subscriber of subscribers) subscriber(event);
		}
	}

	private handleRuntime = (state: Readonly<EngineScrollState>): void => {
		const previousFrame = this.lastObservedFrame ?? this.createFrame(state);
		const nextFrame = this.createFrame(state);
		this.latestFrame = nextFrame;
		this.lastObservedFrame = nextFrame;
		if (sameFrame(previousFrame, nextFrame)) return;

		this.emitActivity(previousFrame, nextFrame);
		this.emitCrossings(previousFrame, nextFrame);
		for (const subscriber of this.subscribers) subscriber(nextFrame);
	};

	public snapshot(
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): Readonly<EngineScrollTimelineFrame> {
		const nextFrame = this.createFrame(state);
		if (!sameFrame(this.latestFrame, nextFrame)) this.latestFrame = nextFrame;
		return this.latestFrame!;
	}

	public subscribe(
		callback: EngineScrollTimelineSubscriber,
		emitInitial = true,
	): () => void {
		this.subscribers.add(callback);
		this.ensureRuntimeSubscription();
		if (emitInitial) callback(this.snapshot());

		return () => {
			this.subscribers.delete(callback);
			this.releaseRuntimeSubscription();
		};
	}

	public onCross(
		progress: number,
		callback: EngineScrollTimelineCrossSubscriber,
	): () => void {
		const at = clamp01(Number.isFinite(progress) ? progress : 0);
		let subscribers = this.crossSubscribers.get(at);
		if (!subscribers) {
			subscribers = new Set();
			this.crossSubscribers.set(at, subscribers);
		}
		subscribers.add(callback);
		this.ensureRuntimeSubscription();

		return () => {
			const current = this.crossSubscribers.get(at);
			current?.delete(callback);
			if (current?.size === 0) this.crossSubscribers.delete(at);
			this.releaseRuntimeSubscription();
		};
	}

	public onEnter(
		callback: EngineScrollTimelineActivitySubscriber,
	): () => void {
		this.enterSubscribers.add(callback);
		this.ensureRuntimeSubscription();
		return () => {
			this.enterSubscribers.delete(callback);
			this.releaseRuntimeSubscription();
		};
	}

	public onLeave(
		callback: EngineScrollTimelineActivitySubscriber,
	): () => void {
		this.leaveSubscribers.add(callback);
		this.ensureRuntimeSubscription();
		return () => {
			this.leaveSubscribers.delete(callback);
			this.releaseRuntimeSubscription();
		};
	}

	public invalidate(): void {
		this.boundaryRevision = -1;
		this.latestFrame = null;
	}

	public pointAt(progress: number): number | null {
		this.resolveBoundaries(this.runtime.getState());
		if (this.resolvedStart === null || this.resolvedEnd === null) return null;
		const safeProgress = clamp01(Number.isFinite(progress) ? progress : 0);
		return this.resolvedStart
			+ (this.resolvedEnd - this.resolvedStart) * safeProgress;
	}

	public segment(
		start: number,
		end: number,
		easing: EngineScrollEasingName = "linear",
	): number {
		const progress = this.snapshot().progress;
		const safeStart = clamp01(Number.isFinite(start) ? start : 0);
		const safeEnd = clamp01(Number.isFinite(end) ? end : 1);
		if (Math.abs(safeEnd - safeStart) < 0.000001) {
			return progress >= safeEnd ? 1 : 0;
		}
		const localProgress = clamp01((progress - safeStart) / (safeEnd - safeStart));
		return EngineScrollEasing.resolve(easing)(localProgress);
	}

	public value(from: number, to: number): number {
		const progress = this.snapshot().progress;
		return from + (to - from) * progress;
	}

	public track(
		keyframes: readonly EngineScrollTimelineKeyframe[],
	): EngineScrollTimelineTrack {
		return new EngineScrollTimelineTrack(
			keyframes,
			() => this.snapshot().progress,
		);
	}

	public bindStyles(
		element: HTMLElement,
		bindings: EngineScrollTimelineStyleBindings,
	): () => void {
		return bindEngineScrollTimelineStyles(this, element, bindings);
	}

	public seek(
		progress: number,
		options?: number | EngineScrollMoveOptions,
	): boolean {
		const point = this.pointAt(progress);
		if (point === null) return false;
		EngineScrollMovement.move(point, options);
		return true;
	}

	public dispose(): void {
		this.subscribers.clear();
		this.crossSubscribers.clear();
		this.enterSubscribers.clear();
		this.leaveSubscribers.clear();
		this.unsubscribeRuntime?.();
		this.unsubscribeRuntime = null;
		this.lastObservedFrame = null;
	}
}
