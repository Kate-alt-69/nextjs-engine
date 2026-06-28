// ============================================================================
// ViewportMath.ts
// ============================================================================

export class ViewportMath {

	/**
	 * Default pixels represented by one Engine Point.
	 */
	public static readonly DEFAULT_POINT_SPACING = 7;

	// -------------------------------------------------------------------------

	public static pixelsToPoints(
		pixels: number,
		pointSpacing: number,
	): number {

		if (pointSpacing <= 0) {
			return 0;
		}

		return pixels / pointSpacing;

	}

	// -------------------------------------------------------------------------

	public static pointsToPixels(
		points: number,
		pointSpacing: number,
	): number {

		return points * pointSpacing;

	}

	// -------------------------------------------------------------------------

	public static clamp(
		value: number,
		min: number,
		max: number,
	): number {

		return Math.min(
			Math.max(value, min),
			max,
		);

	}

	// -------------------------------------------------------------------------

	public static lerp(
		start: number,
		end: number,
		alpha: number,
	): number {

		return start + (end - start) * alpha;

	}

}