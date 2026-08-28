// ============================================================================
// EngineScrollPointTracker.ts — Active named-point / scroll-spy tracking
// ============================================================================

import {
	EngineScrollPointManager,
	type EngineScrollPointLocation,
	type EngineScrollRegisteredPoint,
} from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type { EngineScrollState } from "./EngineScrollTypes";

export type EngineScrollPointTrackerSource = "top" | "current" | "bottom";

export interface EngineScrollPointTrackerConfig {
	group?: string;
	source?: EngineScrollPointTrackerSource;
	offset?: number;
}

export interface EngineScrollPointTrackerFrame extends EngineScrollPointLocation {
	source: EngineScrollPointTrackerSource;
	group?: string;
	currentPoint: number | null;
	previousPoint: number | null;
	nextPoint: number | null;
}

export type EngineScrollPointTrackerSubscriber = (
	frame: Readonly<EngineScrollPointTrackerFrame>,
) => void;

export type EngineScrollPointChangeSubscriber = (
	frame: Readonly<EngineScrollPointTrackerFrame>,
	previousPoint: EngineScrollRegisteredPoint | null,
) => void;

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? value! : fallback;
}

function pointName(point: EngineScrollRegisteredPoint | null): string | null {
	return point?.name ?? null;
}

function sameFrame(
	left: EngineScrollPointTrackerFrame | null,
	right: EngineScrollPointTrackerFrame,
): boolean {
	if (!left) return false;
	return left.source === right.source
		&& left.group === right.group
		&& left.referencePoint === right.referencePoint
		&& left.index === right.index
		&& left.count === right.count
		&& left.progress === right.progress
		&& pointName(left.current) === pointName(right.current)
		&& pointName(left.previous) === pointName(right.previous)
		&& pointName(left.next) === pointName(right.next)
		&& left.currentPoint === right.currentPoint
		&& left.previousPoint === right.previousPoint
		&& left.nextPoint === right.nextPoint;
}

export class EngineScrollPointTracker {
	private readonly runtime = EngineScrollRuntime.get();
	private readonly subscribers = new Set<EngineScrollPointTrackerSubscriber>();
	private readonly changeSubscribers = new Set<EngineScrollPointChangeSubscriber>();
	private unsubscribeRuntime: (() => void) | null = null;
	private latestFrame: EngineScrollPointTrackerFrame | null = null;
	private observedFrame: EngineScrollPointTrackerFrame | null = null;

	public constructor(public readonly config: Readonly<EngineScrollPointTrackerConfig> = {}) {}

	private sourcePoint(state: Readonly<EngineScrollState>): number {
		const source = this.config.source ?? "current";
		return state.viewport[source] + finiteOr(this.config.offset, 0);
	}

	private createFrame(state: Readonly<EngineScrollState>): EngineScrollPointTrackerFrame {
		const source = this.config.source ?? "current";
		const location = EngineScrollPointManager.locate(
			this.sourcePoint(state),
			this.config.group,
		);
		return {
			...location,
			source,
			group: this.config.group,
			currentPoint: location.current?.point ?? null,
			previousPoint: location.previous?.point ?? null,
			nextPoint: location.next?.point ?? null,
		};
	}

	private snapshotFromState(state: Readonly<EngineScrollState>): EngineScrollPointTrackerFrame {
		const frame = this.createFrame(state);
		if (sameFrame(this.latestFrame, frame)) return this.latestFrame!;
		this.latestFrame = frame;
		return frame;
	}

	private handleRuntime = (state: Readonly<EngineScrollState>): void => {
		const previousObserved = this.observedFrame;
		const frame = this.createFrame(state);
		this.latestFrame = sameFrame(this.latestFrame, frame) ? this.latestFrame : frame;
		if (sameFrame(previousObserved, frame)) return;

		this.observedFrame = frame;
		for (const subscriber of this.subscribers) subscriber(this.latestFrame!);

		if (pointName(previousObserved?.current ?? null) === pointName(frame.current)) return;
		for (const subscriber of this.changeSubscribers) {
			subscriber(this.latestFrame!, previousObserved?.current ?? null);
		}
	};

	private ensureRuntimeSubscription(): void {
		if (this.unsubscribeRuntime) return;
		this.observedFrame = this.createFrame(this.runtime.getState());
		this.unsubscribeRuntime = this.runtime.subscribe(this.handleRuntime);
	}

	private releaseRuntimeSubscriptionIfIdle(): void {
		if (
			this.subscribers.size > 0
			|| this.changeSubscribers.size > 0
			|| !this.unsubscribeRuntime
		) {
			return;
		}
		this.unsubscribeRuntime();
		this.unsubscribeRuntime = null;
		this.observedFrame = null;
	}

	public snapshot(
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): Readonly<EngineScrollPointTrackerFrame> {
		return this.snapshotFromState(state);
	}

	public subscribe(
		callback: EngineScrollPointTrackerSubscriber,
		emitInitial = true,
	): () => void {
		this.subscribers.add(callback);
		this.ensureRuntimeSubscription();
		if (emitInitial) callback(this.snapshot());

		return () => {
			this.subscribers.delete(callback);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public onChange(
		callback: EngineScrollPointChangeSubscriber,
		emitInitial = false,
	): () => void {
		this.changeSubscribers.add(callback);
		this.ensureRuntimeSubscription();
		if (emitInitial) callback(this.snapshot(), null);

		return () => {
			this.changeSubscribers.delete(callback);
			this.releaseRuntimeSubscriptionIfIdle();
		};
	}

	public dispose(): void {
		this.subscribers.clear();
		this.changeSubscribers.clear();
		this.unsubscribeRuntime?.();
		this.unsubscribeRuntime = null;
		this.latestFrame = null;
		this.observedFrame = null;
	}
}
