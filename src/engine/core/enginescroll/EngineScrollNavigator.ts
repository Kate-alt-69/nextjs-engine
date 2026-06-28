// ============================================================================
// EngineScrollNavigator.ts
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

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

				EngineScrollMovement.top(
					duration,
				);

				return true;

			case "bottom":

				EngineScrollMovement.bottom(
					duration,
				);

				return true;

			case "current":

				EngineScrollMovement.moveBy(
					offset,
					duration,
				);

				return true;

		}

		if (target.startsWith("#")) {

			return EngineScrollHash.moveToHash(
				target,
				duration,
			);

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