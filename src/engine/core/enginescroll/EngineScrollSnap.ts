// ============================================================================
// EngineScrollSnap.ts
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type {
	EngineScrollDirection,
	EngineScrollMoveOptions,
} from "./EngineScrollTypes";

export type EngineScrollSnapMode = "nearest" | "directional";

export interface EngineScrollSnapOptions extends EngineScrollMoveOptions {
	mode?: EngineScrollSnapMode;
	threshold?: number;
	wrap?: boolean;
	group?: string;
}

export class EngineScrollSnap {
	private static unsubscribeRuntime: (() => void) | null = null;
	private static options: EngineScrollSnapOptions = {};
	private static wasUserScrolling = false;
	private static lastDirection: EngineScrollDirection = 0;

	private static normalizeAutoOptions(
		options: EngineScrollSnapOptions,
	): EngineScrollSnapOptions {
		return {
			...options,
			mode: options.mode ?? "nearest",
			threshold: Number.isFinite(options.threshold)
				? Math.max(0, options.threshold!)
				: 12,
			duration: Number.isFinite(options.duration)
				? Math.max(0, options.duration!)
				: 260,
			easing: options.easing ?? "easeOutCubic",
		};
	}

	private static candidate(
		reference: number,
		direction: EngineScrollDirection,
		options: EngineScrollSnapOptions,
	) {
		if (options.mode === "directional" && direction > 0) {
			return EngineScrollPointManager.next(
				reference,
				options.wrap ?? false,
				options.group,
			);
		}
		if (options.mode === "directional" && direction < 0) {
			return EngineScrollPointManager.previous(
				reference,
				options.wrap ?? false,
				options.group,
			);
		}
		return EngineScrollPointManager.nearest(reference, options.group);
	}

	private static snapWithOptions(
		options: EngineScrollSnapOptions,
		direction: EngineScrollDirection,
	): boolean {
		const runtime = EngineScrollRuntime.get();
		const reference = runtime.getState().viewport.top;
		const candidate = this.candidate(reference, direction, options);
		if (!candidate) return false;

		const resolved = EngineScrollPointManager.resolve(candidate.name, {
			align: options.align,
			offset: options.offset,
		});
		if (!resolved) return false;

		const threshold = Number.isFinite(options.threshold)
			? Math.max(0, options.threshold!)
			: Number.POSITIVE_INFINITY;
		if (Math.abs(resolved.point - reference) > threshold) return false;

		EngineScrollMovement.move(resolved.point, options);
		return true;
	}

	private static handleRuntime = (): void => {
		const cache = EngineScrollRuntime.get().getCache();
		if (cache.isUserScrolling && cache.scrollDirection !== 0) {
			this.lastDirection = cache.scrollDirection;
		}

		const scrollingEnded = this.wasUserScrolling && !cache.isUserScrolling;
		this.wasUserScrolling = cache.isUserScrolling;
		if (!scrollingEnded || cache.isAnimating) return;
		this.snapWithOptions(this.options, this.lastDirection);
	};

	public static enable(options: EngineScrollSnapOptions = {}): () => void {
		this.disable();
		this.options = this.normalizeAutoOptions(options);
		const cache = EngineScrollRuntime.get().getCache();
		this.wasUserScrolling = cache.isUserScrolling;
		this.lastDirection = cache.scrollDirection;
		this.unsubscribeRuntime = EngineScrollRuntime.get().subscribe(this.handleRuntime);
		return () => this.disable();
	}

	public static disable(): void {
		this.unsubscribeRuntime?.();
		this.unsubscribeRuntime = null;
		this.wasUserScrolling = false;
		this.lastDirection = 0;
	}

	public static isEnabled(): boolean {
		return this.unsubscribeRuntime !== null;
	}

	public static now(options: EngineScrollSnapOptions = {}): boolean {
		return this.snapWithOptions(
			{
				...options,
				mode: options.mode ?? "nearest",
			},
			this.lastDirection,
		);
	}
}
