// ============================================================================
// EngineScrollNavigator.ts
// ============================================================================

import { EngineScrollMovement }     from "./EngineScrollMovement";
import { EngineScrollHash }         from "./EngineScrollHash";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime }      from "./EngineScrollRuntime";

export type EngineScrollTarget =
	| number
	| "top"
	| "bottom"
	| "current"
	| `#${string}`;

export class EngineScrollNavigator {

	// -------------------------------------------------------------------------

	public static move(
		target: EngineScrollTarget,
		offset = 0,
		duration?: number,
	): boolean {

		if (typeof target === "number") {

			EngineScrollMovement.move(
				target + offset,
				duration,
			);

			return true;

		}

		switch (target) {

			case "top":

				EngineScrollMovement.top(duration);
				return true;

			case "bottom":

				EngineScrollMovement.bottom(duration);
				return true;

			case "current":

				EngineScrollMovement.moveBy(offset, duration);
				return true;

		}

		if (target.startsWith("#")) {

			const name = target.slice(1);

			// Named point registered via EngineScrollPointManager / point prop
			if (EngineScrollPointManager.has(name)) {

				const registered = EngineScrollPointManager.get(name)!;

				EngineScrollMovement.move(
					registered.point + offset,
					duration,
				);

				return true;

			}

			// Fall back to DOM id lookup
			return EngineScrollHash.moveToHash(target, duration);

		}

		return false;

	}

	// -------------------------------------------------------------------------

	public static current(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.viewport
			.current;

	}

	// -------------------------------------------------------------------------

	public static maximum(): number {

		return EngineScrollRuntime
			.get()
			.getState()
			.page
			.totalPoints;

	}

}