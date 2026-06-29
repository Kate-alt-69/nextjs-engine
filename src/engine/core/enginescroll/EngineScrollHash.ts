// ============================================================================
// EngineScrollHash.ts
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollRuntime }  from "./EngineScrollRuntime";

export class EngineScrollHash {

	/**
	 * Scroll to the DOM element matched by `hash` (e.g. "#about").
	 * Returns false if no element is found.
	 */
	public static moveToHash(
		hash:     string,
		duration: number | undefined = 550,
	): boolean {

		const element = document.querySelector(hash);

		if (!element) return false;

		const spacing =
			EngineScrollRuntime
				.get()
				.getState()
				.page
				.pointSpacing;

		const point =
			(
				element.getBoundingClientRect().top +
				window.scrollY
			) / spacing;

		EngineScrollMovement.move(point, duration);

		return true;

	}

}
