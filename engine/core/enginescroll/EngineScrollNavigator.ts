// ============================================================================
// EngineScrollNavigator.ts
// ============================================================================

import { EngineScrollHash } from "./EngineScrollHash";
import { EngineScrollMovement } from "./EngineScrollMovement";
import { EngineScrollPointManager } from "./EngineScrollPointManager";
import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type {
	EngineScrollAlignment,
	EngineScrollMoveOptions,
} from "./EngineScrollTypes";

export type EngineScrollTarget =
	| number
	| "top"
	| "bottom"
	| "current"
	| `#${string}`;

export interface EngineScrollTargetResolveOptions {
	align?: EngineScrollAlignment;
	offset?: number;
}

export type EngineScrollTargetResolutionKind =
	| "coordinate"
	| "registered"
	| "dom";

export interface EngineScrollTargetResolution {
	point: number;
	kind: EngineScrollTargetResolutionKind;
}

export interface EngineScrollNavigationOptions extends EngineScrollMoveOptions {
	group?: string;
}

function finiteOffset(value: number | undefined): number {
	return Number.isFinite(value) ? value! : 0;
}

function rawHashName(target: string): string {
	return target.startsWith("#") ? target.slice(1) : target;
}

function decodedHashName(name: string): string {
	try {
		return decodeURIComponent(name);
	} catch {
		return name;
	}
}

/** Shared target semantics used by navigation, Range, and Timeline. */
export class EngineScrollTargetResolver {
	public static resolveDetailed(
		target: EngineScrollTarget,
		options: EngineScrollTargetResolveOptions = {},
	): EngineScrollTargetResolution | undefined {
		const offset = finiteOffset(options.offset);
		const state = EngineScrollRuntime.get().getState();

		if (typeof target === "number") {
			return Number.isFinite(target)
				? { point: target + offset, kind: "coordinate" }
				: undefined;
		}
		if (target === "top") return { point: offset, kind: "coordinate" };
		if (target === "bottom") {
			return { point: state.page.totalPoints + offset, kind: "coordinate" };
		}
		if (target === "current") {
			return { point: state.viewport.top + offset, kind: "coordinate" };
		}
		if (!target.startsWith("#")) return undefined;

		const name = rawHashName(target);
		if (!name) return undefined;
		const registered = EngineScrollPointManager.resolve(name, {
			align: options.align,
			offset,
		});
		if (registered) {
			return { point: registered.point, kind: "registered" };
		}

		if (typeof document === "undefined") return undefined;
		const element = document.getElementById(decodedHashName(name));
		if (!element) return undefined;
		return {
			point: EngineScrollPointManager.resolveElement(element, {
				align: options.align,
				offset,
			}),
			kind: "dom",
		};
	}

	public static resolve(
		target: EngineScrollTarget,
		options: EngineScrollTargetResolveOptions = {},
	): number | undefined {
		return this.resolveDetailed(target, options)?.point;
	}

	/**
	 * Plain DOM ids are intentionally resolved live by ranges/timelines. They are
	 * not observed by EngineScrollPointManager, so caching them could preserve an
	 * initial miss or stale geometry forever.
	 */
	public static requiresLiveResolution(target: EngineScrollTarget): boolean {
		if (typeof target !== "string" || !target.startsWith("#")) return false;
		const name = rawHashName(target);
		if (!name) return false;
		try {
			return !EngineScrollPointManager.has(name);
		} catch {
			return false;
		}
	}
}

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
		return EngineScrollTargetResolver.resolve(target, options);
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
		const point = EngineScrollPointManager.nearest(undefined, options.group);
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static next(
		options: EngineScrollNavigationOptions & { wrap?: boolean } = {},
	): boolean {
		const point = EngineScrollPointManager.next(
			undefined,
			options.wrap ?? false,
			options.group,
		);
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static previous(
		options: EngineScrollNavigationOptions & { wrap?: boolean } = {},
	): boolean {
		const point = EngineScrollPointManager.previous(
			undefined,
			options.wrap ?? false,
			options.group,
		);
		return point ? this.move(`#${point.name}`, options) : false;
	}

	public static current(): number {
		return EngineScrollTargetResolver.resolve("current") ?? 0;
	}

	public static maximum(): number {
		return EngineScrollTargetResolver.resolve("bottom") ?? 0;
	}
}
