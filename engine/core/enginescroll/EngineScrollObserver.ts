// ============================================================================
// EngineScrollObserver.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollObserver {

	public static update(): void {

		const runtime =
			EngineScrollRuntime.get();

		const cache =
			runtime.getCache();

		if (
			cache.isUserScrolling &&
			performance.now() -
			cache.lastUserScrollTime >
			120
		) {

			cache.isUserScrolling =
				false;

		}

	}

}