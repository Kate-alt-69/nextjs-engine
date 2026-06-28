// ============================================================================
// EngineScrollPhysics.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollPhysics {

	private static previousPoint = 0;

	// -------------------------------------------------------------------------

	public static update(
		deltaTime: number,
	): void {

		const runtime =
			EngineScrollRuntime.get();

		const cache =
			runtime.getCache();

		const current =
			runtime
				.getState()
				.viewport
				.current;

		if (deltaTime <= 0) {

			cache.scrollVelocity = 0;

			cache.scrollDirection = 0;

			return;

		}

		const velocity =
			(current - this.previousPoint) /
			deltaTime;

		cache.scrollVelocity =
			velocity;

		cache.scrollDirection =
			velocity > 0
				? 1
				: velocity < 0
					? -1
					: 0;

		this.previousPoint =
			current;

	}

}