// ============================================================================
// EngineScrollObserver.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollObserver {
	public static update(): void {
		const cache = EngineScrollRuntime.get().getCache();
		if (
			cache.isUserScrolling
			&& performance.now() >= cache.userScrollIdleUntil
		) {
			cache.isUserScrolling = false;
		}
	}
}
