// ============================================================================
// EngineScrollPointManager.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";

export interface EngineRegisteredPoint {
	name: string;
	point: number;
	element: HTMLElement;
}

export class EngineScrollPointManager {
	private static readonly points = new Map<string, EngineRegisteredPoint>();

	private static pointForElement(element: HTMLElement): number {
		const spacing = EngineScrollRuntime.get().getState().page.pointSpacing;
		const safeSpacing = spacing > 0 ? spacing : 1;
		return (element.getBoundingClientRect().top + window.scrollY) / safeSpacing;
	}

	public static register(
		name: string,
		point: number,
		element: HTMLElement,
	): void {
		this.points.set(name, { name, point, element });
	}

	/** Register a DOM element and derive its current EngineScroll point. */
	public static registerElement(name: string, element: HTMLElement): void {
		this.register(name, this.pointForElement(element), element);
	}

	public static unregister(name: string): void {
		this.points.delete(name);
	}

	public static has(name: string): boolean {
		return this.points.has(name);
	}

	public static get(name: string): EngineRegisteredPoint | undefined {
		return this.points.get(name);
	}

	/**
	 * Recalculate one registered point before navigation.
	 * This prevents stale coordinates after images, fonts, accordions, or other
	 * layout changes move the target after its initial mount.
	 */
	public static refresh(name: string): EngineRegisteredPoint | undefined {
		const registeredPoint = this.points.get(name);
		if (!registeredPoint) return undefined;

		if (!registeredPoint.element.isConnected) {
			this.points.delete(name);
			return undefined;
		}

		registeredPoint.point = this.pointForElement(registeredPoint.element);
		return registeredPoint;
	}

	public static names(): string[] {
		return [...this.points.keys()];
	}

	public static values() {
		return this.points.values();
	}

	public static clear(): void {
		this.points.clear();
	}

	public static recalculate(): void {
		for (const name of [...this.points.keys()]) {
			this.refresh(name);
		}
	}
}
