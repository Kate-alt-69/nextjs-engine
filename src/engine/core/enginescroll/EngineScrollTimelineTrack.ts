// ============================================================================
// EngineScrollTimelineTrack.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import type { EngineScrollEasingName } from "./EngineScrollTypes";

export interface EngineScrollTimelineKeyframe {
	at: number;
	value: number;
	easing?: EngineScrollEasingName;
}

interface NormalizedEngineScrollTimelineKeyframe extends EngineScrollTimelineKeyframe {
	at: number;
	value: number;
	easing: EngineScrollEasingName;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

export class EngineScrollTimelineTrack {
	private readonly keyframes: readonly NormalizedEngineScrollTimelineKeyframe[];
	private readonly progressSource?: () => number;

	public constructor(
		keyframes: readonly EngineScrollTimelineKeyframe[],
		progressSource?: () => number,
	) {
		if (!Array.isArray(keyframes) || keyframes.length === 0) {
			throw new Error("[EngineScroll] Timeline tracks require at least one keyframe.");
		}

		const normalized = keyframes
			.map((keyframe, index) => {
				if (!Number.isFinite(keyframe.at) || !Number.isFinite(keyframe.value)) {
					throw new Error(
						`[EngineScroll] Timeline keyframe ${index} must use finite at/value numbers.`,
					);
				}
				return {
					at: clamp01(keyframe.at),
					value: keyframe.value,
					easing: keyframe.easing ?? "linear",
					index,
				};
			})
			.sort((left, right) => left.at - right.at || left.index - right.index);

		const deduplicated: NormalizedEngineScrollTimelineKeyframe[] = [];
		for (const keyframe of normalized) {
			const previous = deduplicated[deduplicated.length - 1];
			const nextKeyframe = {
				at: keyframe.at,
				value: keyframe.value,
				easing: keyframe.easing,
			};
			if (previous?.at === keyframe.at) {
				deduplicated[deduplicated.length - 1] = nextKeyframe;
				continue;
			}
			deduplicated.push(nextKeyframe);
		}

		this.keyframes = deduplicated;
		this.progressSource = progressSource;
	}

	public sample(progress: number): number {
		const safeProgress = clamp01(Number.isFinite(progress) ? progress : 0);
		if (this.keyframes.length === 1) return this.keyframes[0].value;

		const first = this.keyframes[0];
		const last = this.keyframes[this.keyframes.length - 1];
		if (safeProgress <= first.at) return first.value;
		if (safeProgress >= last.at) return last.value;

		for (let index = 0; index < this.keyframes.length - 1; index += 1) {
			const left = this.keyframes[index];
			const right = this.keyframes[index + 1];
			if (safeProgress > right.at) continue;
			const span = right.at - left.at;
			const localProgress = span <= 0
				? 1
				: (safeProgress - left.at) / span;
			const eased = EngineScrollEasing.resolve(left.easing)(clamp01(localProgress));
			return left.value + (right.value - left.value) * eased;
		}

		return last.value;
	}

	public value(): number {
		return this.sample(this.progressSource?.() ?? 0);
	}

	public frames(): readonly EngineScrollTimelineKeyframe[] {
		return this.keyframes;
	}
}
