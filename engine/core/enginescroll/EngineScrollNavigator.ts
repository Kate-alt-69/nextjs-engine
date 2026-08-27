// ============================================================================
// EngineScrollNavigator.ts
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

export type EngineScrollTarget =
	| number
	| "top"
	| "bottom"
	| "current"
	| `#${string}`;

export class EngineScrollNavigator {
	public static move(
		target: EngineScrollTarget,
		offset = 0,
		duration?: number,
	): boolean {
		const safeOffset = Number.isFinite(offset) ? offset : 0;
		const safeDuration = duration === undefined || !Number.isFinite(duration)
			? undefined
			: Math.max(0, duration);

		if (typeof target === "number") {
			if (!Number.isFinite(target)) return false;
			EngineScrollMovement.move(target + safeOffset, safeDuration);
			return true;
		}

		switch (target) {
			case "top":
				EngineScrollMovement.top(safeDuration);
				return true;
			case "bottom":
				EngineScrollMovement.bottom(safeDuration);
				return true;
			case "current":
				EngineScrollMovement.moveBy(safeOffset, safeDuration);
				return true;
		}

		if (target.startsWith("#")) {
			const name = target.slice(1);
			const registered = EngineScrollPointManager.refresh(name);
			if (registered) {
				EngineScrollMovement.move(registered.point + safeOffset, safeDuration);
				return true;
			}
			return EngineScrollHash.moveToHash(target, safeDuration, safeOffset);
		}

		return false;
	}

	public static current(): number {
		return EngineScrollRuntime.get().getState().viewport.current;
	}

	public static maximum(): number {
		return EngineScrollRuntime.get().getState().page.totalPoints;
	}
}
