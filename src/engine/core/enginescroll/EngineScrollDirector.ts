// ============================================================================
// EngineScrollDirector.ts — Multi-timeline orchestration on one ES subscription
// ============================================================================

import {
	bindEngineScrollTimelineStyles,
	type EngineScrollTimelineStyleBindings,
} from "./EngineScrollTimelineBinding";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import {
	EngineScrollTimeline,
	type EngineScrollTimelineActivityEvent,
	type EngineScrollTimelineActivitySubscriber,
	type EngineScrollTimelineBoundary,
	type EngineScrollTimelineConfig,
	type EngineScrollTimelineCrossEvent,
	type EngineScrollTimelineCrossSubscriber,
	type EngineScrollTimelineFrame,
	type EngineScrollTimelineSubscriber,
} from "./EngineScrollTimeline";
import {
	EngineScrollTimelineTrack,
	type EngineScrollTimelineKeyframe,
} from "./EngineScrollTimelineTrack";
import type {
	EngineScrollDirection,
	EngineScrollEasingName,
	EngineScrollMoveOptions,
	EngineScrollState,
} from "./EngineScrollTypes";

export type EngineScrollDirectorConfig = Readonly<Record<
	string,
	EngineScrollTimelineConfig
>>;

export type EngineScrollDirectorName<
	TConfig extends EngineScrollDirectorConfig,
> = Extract<keyof TConfig, string>;

export type EngineScrollDirectorTimelineFrames<
	TConfig extends EngineScrollDirectorConfig,
> = Readonly<{
	[TName in EngineScrollDirectorName<TConfig>]: Readonly<EngineScrollTimelineFrame>;
}>;

export interface EngineScrollDirectorFrame<
	TConfig extends EngineScrollDirectorConfig = EngineScrollDirectorConfig,
> {
	timelines: EngineScrollDirectorTimelineFrames<TConfig>;
	changed: readonly EngineScrollDirectorName<TConfig>[];
	active: readonly EngineScrollDirectorName<TConfig>[];
	direction: EngineScrollDirection;
	velocity: number;
}

export type EngineScrollDirectorSubscriber<
	TConfig extends EngineScrollDirectorConfig = EngineScrollDirectorConfig,
> = (
	frame: Readonly<EngineScrollDirectorFrame<TConfig>>,
) => void;

const DIRECTOR_EPSILON = 0.000001;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function sameTrackState(
	left: Readonly<EngineScrollTimelineFrame> | undefined,
	right: Readonly<EngineScrollTimelineFrame>,
): boolean {
	if (!left) return false;
	if (
		left.startPoint !== right.startPoint
		|| left.endPoint !== right.endPoint
		|| left.progress !== right.progress
		|| left.before !== right.before
		|| left.active !== right.active
		|| left.after !== right.after
	) {
		return false;
	}

	if (!left.active && !right.active) return true;
	return left.direction === right.direction
		&& Math.abs(left.velocity - right.velocity) <= DIRECTOR_EPSILON;
}

export class EngineScrollDirector<
	TConfig extends EngineScrollDirectorConfig = EngineScrollDirectorConfig,
> {
	private readonly runtime = EngineScrollRuntime.get();
	private readonly timelines = new Map<
		EngineScrollDirectorName<TConfig>,
		EngineScrollTimeline
	>();
	private readonly namesValue: readonly EngineScrollDirectorName<TConfig>[];
	private readonly subscribers = new Set<EngineScrollDirectorSubscriber<TConfig>>();
	private readonly trackSubscribers = new Map<
		EngineScrollDirectorName<TConfig>,
		Set<EngineScrollTimelineSubscriber>
	>();
	private readonly crossSubscribers = new Map<
		EngineScrollDirectorName<TConfig>,
		Map<number, Set<EngineScrollTimelineCrossSubscriber>>
	>();
	private readonly enterSubscribers = new Map<
		EngineScrollDirectorName<TConfig>,
		Set<EngineScrollTimelineActivitySubscriber>
	>();
	private readonly leaveSubscribers = new Map<
		EngineScrollDirectorName<TConfig>,
		Set<EngineScrollTimelineActivitySubscriber>
	>();
	private unsubscribeRuntime: (() => void) | null = null;
	private observedFrames: EngineScrollDirectorTimelineFrames<TConfig> | null = null;
	private latestFrame: EngineScrollDirectorFrame<TConfig> | null = null;

	public constructor(public readonly config: TConfig) {
		const names = Object.keys(config) as EngineScrollDirectorName<TConfig>[];
		for (const name of names) {
			if (!name.trim()) {
				throw new Error("[EngineScroll] Director track names cannot be empty.");
			}
			const timelineConfig = config[name];
			if (!timelineConfig || typeof timelineConfig !== "object") {
				throw new Error(`[EngineScroll] Director track "${name}" requires a timeline config.`);
			}
			this.timelines.set(name, new EngineScrollTimeline(timelineConfig));
		}
		this.namesValue = Object.freeze([...names]);
	}

	private timelineFor(
		name: EngineScrollDirectorName<TConfig>,
	): EngineScrollTimeline {
		const timeline = this.timelines.get(name);
		if (timeline) return timeline;
		throw new Error(`[EngineScroll] Unknown director track "${String(name)}".`);
	}

	private sampleTimelines(
		state: Readonly<EngineScrollState>,
	): EngineScrollDirectorTimelineFrames<TConfig> {
		const timelines: Record<string, Readonly<EngineScrollTimelineFrame>> = {};
		for (const name of this.namesValue) {
			timelines[name] = this.timelineFor(name).snapshot(state);
		}
		return timelines as EngineScrollDirectorTimelineFrames<TConfig>;
	}

	private createDirectorFrame(
		timelines: EngineScrollDirectorTimelineFrames<TConfig>,
		changed: readonly EngineScrollDirectorName<TConfig>[] = [],
	): EngineScrollDirectorFrame<TConfig> {
		const active: EngineScrollDirectorName<TConfig>[] = [];
		for (const name of this.namesValue) {
			if (timelines[name].active) active.push(name);
		}
		const cache = this.runtime.getCache();
		return {
			timelines,
			changed,
			active,
			direction: cache.scrollDirection,
			velocity: cache.scrollVelocity,
		};
	}

	private changedTracks(
		previous: EngineScrollDirectorTimelineFrames<TConfig>,
		next: EngineScrollDirectorTimelineFrames<TConfig>,
	): EngineScrollDirectorName<TConfig>[] {
		const changed: EngineScrollDirectorName<TConfig>[] = [];
		for (const name of this.namesValue) {
			if (!sameTrackState(previous[name], next[name])) changed.push(name);
		}
		return changed;
	}

	private activityBoundary(
		previousFrame: Readonly<EngineScrollTimelineFrame>,
		frame: Readonly<EngineScrollTimelineFrame>,
		type: "enter" | "leave",
	): EngineScrollTimelineBoundary {
		if (type === "enter") {
			return previousFrame.rawProgress > 1 ? "end" : "start";
		}
		return frame.rawProgress > 1 ? "end" : "start";
	}

	private emitCrossings(
		previous: EngineScrollDirectorTimelineFrames<TConfig>,
		next: EngineScrollDirectorTimelineFrames<TConfig>,
	): void {
		for (const [name, thresholds] of this.crossSubscribers) {
			const previousFrame = previous[name];
			const frame = next[name];
			if (!previousFrame || !frame) continue;

			for (const [at, subscribers] of thresholds) {
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
	}

	private emitActivity(
		previous: EngineScrollDirectorTimelineFrames<TConfig>,
		next: EngineScrollDirectorTimelineFrames<TConfig>,
	): void {
		for (const [name, subscribers] of this.enterSubscribers) {
			const previousFrame = previous[name];
			const frame = next[name];
			if (!previousFrame || !frame || previousFrame.active || !frame.active) continue;
			const event: EngineScrollTimelineActivityEvent = {
				type: "enter",
				boundary: this.activityBoundary(previousFrame, frame, "enter"),
				direction: Math.sign(
					frame.rawProgress - previousFrame.rawProgress,
				) as EngineScrollDirection,
				frame,
				previousFrame,
			};
			for (const subscriber of subscribers) subscriber(event);
		}

		for (const [name, subscribers] of this.leaveSubscribers) {
			const previousFrame = previous[name];
			const frame = next[name];
			if (!previousFrame || !frame || !previousFrame.active || frame.active) continue;
			const event: EngineScrollTimelineActivityEvent = {
				type: "leave",
				boundary: this.activityBoundary(previousFrame, frame, "leave"),
				direction: Math.sign(
					frame.rawProgress - previousFrame.rawProgress,
				) as EngineScrollDirection,
				frame,
				previousFrame,
			};
			for (const subscriber of subscribers) subscriber(event);
		}
	}

	private listenerCount(): number {
		let count = this.subscribers.size;
		for (const subscribers of this.trackSubscribers.values()) count += subscribers.size;
		for (const thresholds of this.crossSubscribers.values()) {
			for (const subscribers of thresholds.values()) count += subscribers.size;
		}
		for (const subscribers of this.enterSubscribers.values()) count += subscribers.size;
		for (const subscribers of this.leaveSubscribers.values()) count += subscribers.size;
		return count;
	}

	private ensureRuntimeSubscription(): void {
		if (this.unsubscribeRuntime) return;
		const timelines = this.sampleTimelines(this.runtime.getState());
		this.observedFrames = timelines;
		this.latestFrame = this.createDirectorFrame(timelines);
		this.unsubscribeRuntime = this.runtime.subscribe(this.handleRuntime);
	}

	private releaseRuntimeSubscriptionIfIdle(): void {
		if (this.listenerCount() > 0 || !this.unsubscribeRuntime) return;
		this.unsubscribeRuntime();
		this.unsubscribeRuntime = null;
		this.observedFrames = null;
	}

	private handleRuntime = (state: Readonly<EngineScrollState>): void => {
		const previous = this.observedFrames ?? this.sampleTimelines(state);
		const timelines = this.sampleTimelines(state);
		const changed = this.changedTracks(previous, timelines);
		const frame = this.createDirectorFrame(timelines, changed);
		this.observedFrames = timelines;
		this.latestFrame = frame;

		this.emitActivity(previous, timelines);
		this.emitCrossings(previous, timelines);
		if (changed.length === 0) return;

		for (const subscriber of this.subscribers) subscriber(frame);
		for (const name of changed) {
			const subscribers = this.trackSubscribers.get(name);
			if (!subscribers) continue;
			for (const subscriber of subscribers) subscriber(timelines[name]);
		}
	};

	private addActivitySubscriber(
		collection: Map<
			EngineScrollDirectorName<TConfig>,
			Set<EngineScrollTimelineActivitySubscriber>
		>,
		name: EngineScrollDirectorName<TConfig>,
		callback: EngineScrollTimelineActivitySubscriber,
	): () => void {
		this.timelineFor(name);
		let subscribers = collection.get(name);
		if (!subscribers) {
			subscribers = new Set();
			collection.set(name, subscribers);
		}
		subscribers.add(callback);
		this.ensureRuntimeSubscription();

		return () => {
			const current = collection.get(name);
			current?.delete(callback);
			if (current?.size === 0) collection.delete(name);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public get size(): number {
		return this.namesValue.length;
	}

	public names(): readonly EngineScrollDirectorName<TConfig>[] {
		return this.namesValue;
	}

	public has(name: string): name is EngineScrollDirectorName<TConfig> {
		return this.timelines.has(name as EngineScrollDirectorName<TConfig>);
	}

	public snapshot(
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): Readonly<EngineScrollDirectorFrame<TConfig>> {
		const timelines = this.sampleTimelines(state);
		const frame = this.createDirectorFrame(timelines);
		this.latestFrame = frame;
		return frame;
	}

	public snapshotTrack(
		name: EngineScrollDirectorName<TConfig>,
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): Readonly<EngineScrollTimelineFrame> {
		return this.timelineFor(name).snapshot(state);
	}

	public subscribe(
		callback: EngineScrollDirectorSubscriber<TConfig>,
		emitInitial = true,
	): () => void {
		this.subscribers.add(callback);
		this.ensureRuntimeSubscription();
		if (emitInitial) callback(this.latestFrame!);

		return () => {
			this.subscribers.delete(callback);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public subscribeTrack(
		name: EngineScrollDirectorName<TConfig>,
		callback: EngineScrollTimelineSubscriber,
		emitInitial = true,
	): () => void {
		this.timelineFor(name);
		let subscribers = this.trackSubscribers.get(name);
		if (!subscribers) {
			subscribers = new Set();
			this.trackSubscribers.set(name, subscribers);
		}
		subscribers.add(callback);
		this.ensureRuntimeSubscription();
		if (emitInitial) callback(this.latestFrame!.timelines[name]);

		return () => {
			const current = this.trackSubscribers.get(name);
			current?.delete(callback);
			if (current?.size === 0) this.trackSubscribers.delete(name);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public onCross(
		name: EngineScrollDirectorName<TConfig>,
		progress: number,
		callback: EngineScrollTimelineCrossSubscriber,
	): () => void {
		this.timelineFor(name);
		const at = clamp01(Number.isFinite(progress) ? progress : 0);
		let thresholds = this.crossSubscribers.get(name);
		if (!thresholds) {
			thresholds = new Map();
			this.crossSubscribers.set(name, thresholds);
		}
		let subscribers = thresholds.get(at);
		if (!subscribers) {
			subscribers = new Set();
			thresholds.set(at, subscribers);
		}
		subscribers.add(callback);
		this.ensureRuntimeSubscription();

		return () => {
			const currentThresholds = this.crossSubscribers.get(name);
			const current = currentThresholds?.get(at);
			current?.delete(callback);
			if (current?.size === 0) currentThresholds?.delete(at);
			if (currentThresholds?.size === 0) this.crossSubscribers.delete(name);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public onEnter(
		name: EngineScrollDirectorName<TConfig>,
		callback: EngineScrollTimelineActivitySubscriber,
	): () => void {
		return this.addActivitySubscriber(this.enterSubscribers, name, callback);
	}

	public onLeave(
		name: EngineScrollDirectorName<TConfig>,
		callback: EngineScrollTimelineActivitySubscriber,
	): () => void {
		return this.addActivitySubscriber(this.leaveSubscribers, name, callback);
	}

	public pointAt(
		name: EngineScrollDirectorName<TConfig>,
		progress: number,
	): number | null {
		return this.timelineFor(name).pointAt(progress);
	}

	public seek(
		name: EngineScrollDirectorName<TConfig>,
		progress: number,
		options?: number | EngineScrollMoveOptions,
	): boolean {
		return this.timelineFor(name).seek(progress, options);
	}

	public segment(
		name: EngineScrollDirectorName<TConfig>,
		start: number,
		end: number,
		easing: EngineScrollEasingName = "linear",
	): number {
		return this.timelineFor(name).segment(start, end, easing);
	}

	public value(
		name: EngineScrollDirectorName<TConfig>,
		from: number,
		to: number,
	): number {
		return this.timelineFor(name).value(from, to);
	}

	public track(
		name: EngineScrollDirectorName<TConfig>,
		keyframes: readonly EngineScrollTimelineKeyframe[],
	): EngineScrollTimelineTrack {
		return this.timelineFor(name).track(keyframes);
	}

	public bindStyles(
		name: EngineScrollDirectorName<TConfig>,
		element: HTMLElement,
		bindings: EngineScrollTimelineStyleBindings,
	): () => void {
		this.timelineFor(name);
		return bindEngineScrollTimelineStyles({
			subscribe: (callback, emitInitial = true) => (
				this.subscribeTrack(name, callback, emitInitial)
			),
		}, element, bindings);
	}

	public invalidate(name?: EngineScrollDirectorName<TConfig>): void {
		if (name !== undefined) {
			this.timelineFor(name).invalidate();
			this.latestFrame = null;
			return;
		}
		for (const timeline of this.timelines.values()) timeline.invalidate();
		this.latestFrame = null;
	}

	public dispose(): void {
		this.subscribers.clear();
		this.trackSubscribers.clear();
		this.crossSubscribers.clear();
		this.enterSubscribers.clear();
		this.leaveSubscribers.clear();
		this.unsubscribeRuntime?.();
		this.unsubscribeRuntime = null;
		this.observedFrames = null;
		this.latestFrame = null;
		for (const timeline of this.timelines.values()) timeline.dispose();
	}
}
