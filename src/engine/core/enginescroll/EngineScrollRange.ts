// ============================================================================
// EngineScrollRange.ts — Cached non-reactive scroll range geometry
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type {
	EngineScrollAlignment,
	EngineScrollDirection,
	EngineScrollMoveOptions,
	EngineScrollState,
} from "./EngineScrollTypes";

export type EngineScrollRangeTarget =
	| number
	| "top"
	| "bottom"
	| `#${string}`;

export interface EngineScrollRangeConfig {
	start: EngineScrollRangeTarget;
	end: EngineScrollRangeTarget;
	startOffset?: number;
	endOffset?: number;
	startAlign?: EngineScrollAlignment;
	endAlign?: EngineScrollAlignment;
}

export interface EngineScrollRangeSnapshot {
	startPoint: number | null;
	endPoint: number | null;
	span: number | null;
	minimum: number | null;
	maximum: number | null;
	direction: EngineScrollDirection;
	valid: boolean;
}

const RANGE_EPSILON = 0.000001;

function finiteOr(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? value! : fallback;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export class EngineScrollRange {
	private readonly runtime = EngineScrollRuntime.get();
	private boundaryRevision = -1;
	private boundaryMaximum = Number.NaN;
	private resolvedStart: number | null = null;
	private resolvedEnd: number | null = null;
	private latestSnapshot: EngineScrollRangeSnapshot | null = null;

	public constructor(public readonly config: Readonly<EngineScrollRangeConfig>) {}

	private resolveTarget(
		target: EngineScrollRangeTarget,
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
		this.latestSnapshot = null;
	}

	public snapshot(
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): Readonly<EngineScrollRangeSnapshot> {
		this.resolveBoundaries(state);
		if (this.latestSnapshot) return this.latestSnapshot;

		if (this.resolvedStart === null || this.resolvedEnd === null) {
			this.latestSnapshot = {
				startPoint: this.resolvedStart,
				endPoint: this.resolvedEnd,
				span: null,
				minimum: null,
				maximum: null,
				direction: 0,
				valid: false,
			};
			return this.latestSnapshot;
		}

		const span = this.resolvedEnd - this.resolvedStart;
		this.latestSnapshot = {
			startPoint: this.resolvedStart,
			endPoint: this.resolvedEnd,
			span,
			minimum: Math.min(this.resolvedStart, this.resolvedEnd),
			maximum: Math.max(this.resolvedStart, this.resolvedEnd),
			direction: Math.sign(span) as EngineScrollDirection,
			valid: true,
		};
		return this.latestSnapshot;
	}

	public rawProgressAt(
		point: number,
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): number | null {
		const range = this.snapshot(state);
		if (!range.valid || range.startPoint === null || range.span === null) return null;
		const safePoint = Number.isFinite(point) ? point : range.startPoint;
		if (Math.abs(range.span) <= RANGE_EPSILON) {
			return safePoint < range.startPoint
				? -1
				: safePoint > range.startPoint
					? 2
					: 1;
		}
		return (safePoint - range.startPoint) / range.span;
	}

	public progressAt(
		point: number,
		clamp = true,
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): number | null {
		const progress = this.rawProgressAt(point, state);
		if (progress === null) return null;
		return clamp ? clamp01(progress) : progress;
	}

	public pointAt(
		progress: number,
		clamp = true,
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): number | null {
		const range = this.snapshot(state);
		if (
			!range.valid
			|| range.startPoint === null
			|| range.endPoint === null
		) {
			return null;
		}

		const normalized = Number.isFinite(progress) ? progress : 0;
		const safeProgress = clamp ? clamp01(normalized) : normalized;
		return range.startPoint
			+ (range.endPoint - range.startPoint) * safeProgress;
	}

	public contains(
		point: number,
		state: Readonly<EngineScrollState> = this.runtime.getState(),
	): boolean {
		const range = this.snapshot(state);
		if (!range.valid || range.minimum === null || range.maximum === null) return false;
		if (!Number.isFinite(point)) return false;
		return point >= range.minimum - RANGE_EPSILON
			&& point <= range.maximum + RANGE_EPSILON;
	}

	public moveTo(
		progress: number,
		options?: number | EngineScrollMoveOptions,
	): boolean {
		const point = this.pointAt(progress);
		if (point === null) return false;
		EngineScrollMovement.move(point, options);
		return true;
	}

	public invalidate(): void {
		this.boundaryRevision = -1;
		this.boundaryMaximum = Number.NaN;
		this.latestSnapshot = null;
	}
}
