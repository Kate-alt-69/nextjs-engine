// ============================================================================
// EngineScrollPhysics.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollPhysics {
	private static previousPoint = 0;
	private static initialized = false;

	public static reset(): void {
		this.initialized = false;
		this.previousPoint = 0;
	}

	public static update(deltaTime: number): void {
		const runtime = EngineScrollRuntime.get();
		const cache = runtime.getCache();
		// Scroll velocity describes physical page movement. It must not depend on
		// the configurable logical viewport.current focus strategy.
		const current = runtime.getState().viewport.top;

		if (!this.initialized) {
			this.initialized = true;
			this.previousPoint = current;
			cache.scrollVelocity = 0;
			cache.scrollDirection = 0;
			return;
		}

		if (deltaTime <= 0) {
			cache.scrollVelocity = 0;
			cache.scrollDirection = 0;
			this.previousPoint = current;
			return;
		}

		const velocity = (current - this.previousPoint) / deltaTime;
		cache.scrollVelocity = velocity;
		cache.scrollDirection = velocity > 0
			? 1
			: velocity < 0
				? -1
				: 0;
		this.previousPoint = current;
	}
}
