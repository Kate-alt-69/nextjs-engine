// ============================================================================
// ECFrameClock.ts — refresh-aware EngineCanvas frame timing
// ============================================================================

const COMMON_REFRESH_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240] as const;

export interface ECFrameTiming {
	timestamp: number;
	delta: number;
	elapsed: number;
	fps: number;
	averageFps: number;
	refreshRate: number;
}

export interface ECAdaptiveFrameThresholds {
	degradeBelow: number;
	recoverAbove: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function nearestCommonRefreshRate(rawRate: number): number {
	let nearest = COMMON_REFRESH_RATES[0];
	let nearestDistance = Math.abs(rawRate - nearest);
	for (const candidate of COMMON_REFRESH_RATES) {
		const distance = Math.abs(rawRate - candidate);
		if (distance < nearestDistance) {
			nearest = candidate;
			nearestDistance = distance;
		}
	}
	return nearestDistance / Math.max(rawRate, 1) <= 0.08
		? nearest
		: Math.round(clamp(rawRate, 24, 240));
}

export function resolveAdaptiveTargetFps(
	target: number | "display",
	detectedRefreshRate: number,
): number {
	return target === "display"
		? clamp(detectedRefreshRate, 24, 240)
		: clamp(target, 24, 240);
}

export function getAdaptiveFrameThresholds(targetFps: number): ECAdaptiveFrameThresholds {
	const normalizedTarget = clamp(targetFps, 24, 240);
	return {
		degradeBelow: Math.max(24, normalizedTarget * 0.72),
		recoverAbove: Math.max(28, normalizedTarget * 0.9),
	};
}

export class ECFrameClock {
	private lastTimestamp: number | null = null;
	private elapsed = 0;
	private readonly fpsSamples: number[] = [];
	private readonly intervalSamples: number[] = [];

	constructor(private readonly sampleSize = 48) {}

	/**
	 * Marks a pause/resume boundary without resetting active elapsed time.
	 * The next frame receives delta=0 instead of a giant hidden/offscreen gap.
	 */
	public discontinuity(): void {
		this.lastTimestamp = null;
	}

	public step(timestamp: number): ECFrameTiming {
		if (this.lastTimestamp === null) {
			this.lastTimestamp = timestamp;
			return {
				timestamp,
				delta: 0,
				elapsed: this.elapsed,
				fps: 0,
				averageFps: this.averageFps(),
				refreshRate: this.estimateRefreshRate(),
			};
		}

		const rawDelta = Math.max(0, timestamp - this.lastTimestamp);
		this.lastTimestamp = timestamp;
		const delta = Math.min(250, rawDelta);
		this.elapsed += delta;

		if (rawDelta > 0 && rawDelta <= 50) {
			const fps = 1000 / rawDelta;
			this.pushSample(this.fpsSamples, fps);
			this.pushSample(this.intervalSamples, rawDelta);
		}

		const fps = rawDelta > 0 ? 1000 / rawDelta : 0;
		return {
			timestamp,
			delta,
			elapsed: this.elapsed,
			fps,
			averageFps: this.averageFps(),
			refreshRate: this.estimateRefreshRate(),
		};
	}

	private pushSample(samples: number[], value: number): void {
		samples.push(value);
		if (samples.length > this.sampleSize) samples.shift();
	}

	private averageFps(): number {
		if (this.fpsSamples.length === 0) return 0;
		return this.fpsSamples.reduce((total, value) => total + value, 0) / this.fpsSamples.length;
	}

	private estimateRefreshRate(): number {
		if (this.intervalSamples.length < 4) return 60;

		// Prefer the faster end of the recent cadence. If a 120 Hz panel drops
		// an occasional frame to ~16.7 ms, the ~8.3 ms samples still identify
		// the display cadence instead of misclassifying the surface as 60 Hz.
		const sorted = [...this.intervalSamples].sort((left, right) => left - right);
		const sampleIndex = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.2));
		const representativeInterval = sorted[sampleIndex];
		return nearestCommonRefreshRate(1000 / Math.max(representativeInterval, 1));
	}
}
