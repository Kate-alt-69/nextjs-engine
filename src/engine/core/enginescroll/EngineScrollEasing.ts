// ============================================================================
// EngineScrollEasing.ts
// ============================================================================

export class EngineScrollEasing {

	public static linear(
		t: number,
	): number {

		return t;

	}

	public static easeInQuad(
		t: number,
	): number {

		return t * t;

	}

	public static easeOutQuad(
		t: number,
	): number {

		return t * (2 - t);

	}

	public static easeInOutQuad(
		t: number,
	): number {

		return t < 0.5
			? 2 * t * t
			: 1 -
				Math.pow(
					-2 * t + 2,
					2,
				) / 2;

	}

	public static easeInCubic(
		t: number,
	): number {

		return t * t * t;

	}

	public static easeOutCubic(
		t: number,
	): number {

		return 1 -
			Math.pow(
				1 - t,
				3,
			);

	}

	public static easeInOutCubic(
		t: number,
	): number {

		return t < 0.5
			? 4 * t * t * t
			: 1 -
				Math.pow(
					-2 * t + 2,
					3,
				) / 2;

	}

}