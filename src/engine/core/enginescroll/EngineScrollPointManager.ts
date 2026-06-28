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

	private static readonly points =
		new Map<
			string,
			EngineRegisteredPoint
		>();

	// -------------------------------------------------------------------------

	public static register(

		name: string,

		point: number,

		element: HTMLElement,

	): void {

		this.points.set(

			name,

			{

				name,

				point,

				element,

			},

		);

	}

	// -------------------------------------------------------------------------

	public static unregister(
		name: string,
	): void {

		this.points.delete(
			name,
		);

	}

	// -------------------------------------------------------------------------

	public static has(
		name: string,
	): boolean {

		return this.points.has(
			name,
		);

	}

	// -------------------------------------------------------------------------

	public static get(
		name: string,
	): EngineRegisteredPoint | undefined {

		return this.points.get(
			name,
		);

	}

	// -------------------------------------------------------------------------

	public static names(): string[] {

		return [

			...this.points.keys(),

		];

	}

	// -------------------------------------------------------------------------

	public static values() {

		return this.points.values();

	}

	// -------------------------------------------------------------------------

	public static clear(): void {

		this.points.clear();

	}

	// -------------------------------------------------------------------------

	public static recalculate(): void {

		const runtime =
			EngineScrollRuntime.get();

		const spacing =
			runtime
				.getState()
				.page
				.pointSpacing;

		for (const point of this.points.values()) {

			point.point =

				(
					point.element
						.getBoundingClientRect()
						.top +

					window.scrollY
				)

				/

				spacing;

		}

	}

}