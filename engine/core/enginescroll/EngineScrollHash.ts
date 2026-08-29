// ============================================================================
// EngineScrollHash.ts
// ============================================================================

import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollRuntime } from "./EngineScrollRuntime";

export class EngineScrollHash {
	public static moveToHash(
		hash: string,
		duration: number | undefined = 550,
		offset = 0,
	): boolean {
		if (typeof document === "undefined" || typeof window === "undefined") return false;
		const rawId = hash.startsWith("#") ? hash.slice(1) : hash;
		if (!rawId) return false;

		let elementId = rawId;
		try {
			elementId = decodeURIComponent(rawId);
		} catch {
			elementId = rawId;
		}

		const element = document.getElementById(elementId);
		if (!element) return false;

		const spacing = EngineScrollRuntime.get().getState().page.pointSpacing;
		const safeSpacing = spacing > 0 ? spacing : 1;
		const safeOffset = Number.isFinite(offset) ? offset : 0;
		const point = (element.getBoundingClientRect().top + window.scrollY) / safeSpacing;
		EngineScrollMovement.move(point + safeOffset, duration);
		return true;
	}
}
