// ============================================================================
// EngineScrollNavigator.ts
// ============================================================================

import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type { EngineScrollMoveOptions } from "./EngineScrollTypes";

export type EngineScrollTarget =
	| number
	| "top"
	| "bottom"
	| "current"
	| `#${string}`;

export type EngineScrollNavigationOptions = EngineScrollMoveOptions;

export class EngineScrollNavigator {
	private static normalizeOptions(
		offsetOrOptions: number | EngineScrollNavigationOptions = 0,
		duration?: number,
	): EngineScrollNavigationOptions {
		if (typeof offsetOrOptions === "number") {
			return {
				offset: Number.isFinite(offsetOrOptions) ? offsetOrOptions : 0,
				duration: duration === undefined || !Number.isFinite(duration)
					? undefined
					: Math.max(0, duration),
			};
		}
		return {
			...offsetOrOptions,
			offset: Number.isFinite(offsetOrOptions.offset) ? offsetOrOptions.offset : 0,
			duration: offsetOrOptions.duration === undefined || !Number.isFinite(offsetOrOptions.duration)
				? undefined
				: Math.max(0, offsetOrOptions.duration),
		};
	}

	public static resolve(
		target: EngineScrollTarget,
		options: EngineScrollNavigationOptions = {},
	): number | undefined {
		const offset = Number.isFinite(options.offset) ? options.offset! : 0;
		const state = EngineScrollRuntime.get().getState();
		if (typeof target === "number") {
			return Number.isFinite(target) ? target + offset : undefined;
		}
		if (target === "top") return offset;
		if (target === "bottom") return state.page.totalPoints + offset;
		if (target === "current") return state.viewport.top + offset;
		if (!target.startsWith("#")) return undefined;

		const name = target.slice(1);
		const registered = EngineScrollPointManager.resolve(name, {
			align: options.align,
			offset,
		});
		if (registered) return registered.point;

		if (typeof document === "undefined") return undefined;
		let decodedName = name;
		try {
			decodedName = decodeURIComponent(name);
		} catch {
			// Keep the raw DOM id when the hash is not valid percent-encoding.
		}
		const element = document.getElementById(decodedName);
		if (!element) return undefined;
		return EngineScrollPointManager.resolveElement(element, {
			align: options.align,
			offset,
		});
	}

	public static move(
		target: EngineScrollTarget,
		offsetOrOptions: number | EngineScrollNavigationOptions = 0,
		duration?: number,
	): boolean {
		const options = this.normalizeOptions(offsetOrOptions, duration);
		const point = this.resolve(target, options);
		if (point !== undefined) {
			EngineScrollMovement.move(point, options);
			return true;
		}

		if (typeof target === "string" && target.startsWith("#")) {
			return EngineScrollHash.moveToHash(
				target,
				options.duration,
				options.offset ?? 0,
			);
		}
		return false;
	}

	public static nearest(options: EngineScrollNavigationOptions = {}): boolean {
		const point = EngineScrollPointManager.nearest();
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static next(
		options: EngineScrollNavigationOptions & { wrap?: boolean } = {},
	): boolean {
		const point = EngineScrollPointManager.next(undefined, options.wrap ?? false);
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static previous(
		options: EngineScrollNavigationOptions & { wrap?: boolean } = {},
	): boolean {
		const point = EngineScrollPointManager.previous(undefined, options.wrap ?? false);
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static current(): number {
		return EngineScrollRuntime.get().getState().viewport.current;
	}

	public static maximum(): number {
		return EngineScrollRuntime.get().getState().page.totalPoints;
	}
}
