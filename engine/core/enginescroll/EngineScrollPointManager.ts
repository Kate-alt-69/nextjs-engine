// ============================================================================
// EngineScrollPointManager.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type { EngineScrollAlignment } from "./EngineScrollTypes";

export interface EngineScrollPointOptions {
	align?: EngineScrollAlignment;
	offset?: number;
}

export interface EngineScrollRegisteredPoint {
	name: string;
	point: number;
	element: HTMLElement;
	align: EngineScrollAlignment;
	offset: number;
}

export interface EngineScrollResolvedPoint extends EngineScrollRegisteredPoint {
	point: number;
}

export class EngineScrollPointManager {
	private static readonly points = new Map<string, EngineScrollRegisteredPoint>();
	private static readonly observedElementRefs = new Map<HTMLElement, number>();
	private static resizeObserver: ResizeObserver | null = null;
	private static revisionValue = 0;
	private static geometryDirty = true;
	private static orderedCache: EngineScrollRegisteredPoint[] | null = null;

	private static normalizeName(name: string): string {
		const normalized = String(name).trim().replace(/^#/, "");
		if (!normalized) {
			throw new Error("[EngineScroll] Point names cannot be empty.");
		}
		return normalized;
	}

	private static spacing(): number {
		const spacing = EngineScrollRuntime.get().getState().page.pointSpacing;
		return spacing > 0 ? spacing : 1;
	}

	private static clampPoint(point: number): number {
		const maximum = EngineScrollRuntime.get().getState().page.totalPoints;
		return Math.max(0, Math.min(Number.isFinite(point) ? point : 0, maximum));
	}

	private static invalidateOrder(): void {
		this.orderedCache = null;
		this.revisionValue++;
	}

	private static markGeometryDirty(): void {
		this.geometryDirty = true;
		this.invalidateOrder();
	}

	private static startPointForElement(element: HTMLElement): number {
		const absoluteTop = element.getBoundingClientRect().top + window.scrollY;
		return absoluteTop / this.spacing();
	}

	private static alignedPointForElement(
		element: HTMLElement,
		align: EngineScrollAlignment,
	): number {
		const rect = element.getBoundingClientRect();
		const absoluteTop = rect.top + window.scrollY;
		const viewportHeight = window.innerHeight;
		let targetPixels = absoluteTop;

		if (align === "center") {
			targetPixels = absoluteTop + rect.height / 2 - viewportHeight / 2;
		} else if (align === "end") {
			targetPixels = absoluteTop + rect.height - viewportHeight;
		} else if (align === "nearest") {
			if (rect.top >= 0 && rect.bottom <= viewportHeight) {
				targetPixels = window.scrollY;
			} else if (rect.top < 0) {
				targetPixels = absoluteTop;
			} else {
				targetPixels = absoluteTop + rect.height - viewportHeight;
			}
		}

		return targetPixels / this.spacing();
	}

	private static ensureObserver(): void {
		if (this.resizeObserver || typeof ResizeObserver === "undefined") return;
		this.resizeObserver = new ResizeObserver(() => {
			this.markGeometryDirty();
		});
		if (typeof document !== "undefined") {
			this.resizeObserver.observe(document.documentElement);
		}
	}

	private static observeElement(element: HTMLElement): void {
		this.ensureObserver();
		const count = this.observedElementRefs.get(element) ?? 0;
		this.observedElementRefs.set(element, count + 1);
		if (count === 0) this.resizeObserver?.observe(element);
	}

	private static unobserveElement(element: HTMLElement): void {
		const count = this.observedElementRefs.get(element) ?? 0;
		if (count <= 1) {
			this.observedElementRefs.delete(element);
			this.resizeObserver?.unobserve(element);
			return;
		}
		this.observedElementRefs.set(element, count - 1);
	}

	private static measure(
		name: string,
	): EngineScrollRegisteredPoint | undefined {
		const registeredPoint = this.points.get(name);
		if (!registeredPoint) return undefined;
		if (!registeredPoint.element.isConnected) {
			this.unregister(name);
			return undefined;
		}

		const nextPoint = this.startPointForElement(registeredPoint.element);
		if (Math.abs(nextPoint - registeredPoint.point) > 0.0001) {
			registeredPoint.point = nextPoint;
			this.invalidateOrder();
		}
		return registeredPoint;
	}

	public static register(
		name: string,
		point: number,
		element: HTMLElement,
		options: EngineScrollPointOptions = {},
	): void {
		const normalizedName = this.normalizeName(name);
		const previous = this.points.get(normalizedName);
		if (previous && previous.element !== element) this.unobserveElement(previous.element);
		if (!previous || previous.element !== element) this.observeElement(element);

		this.points.set(normalizedName, {
			name: normalizedName,
			point: Number.isFinite(point) ? point : 0,
			element,
			align: options.align ?? "start",
			offset: Number.isFinite(options.offset) ? options.offset! : 0,
		});
		this.invalidateOrder();
	}

	public static registerElement(
		name: string,
		element: HTMLElement,
		options: EngineScrollPointOptions = {},
	): void {
		this.register(name, this.startPointForElement(element), element, options);
	}

	public static unregister(name: string): void {
		const normalizedName = this.normalizeName(name);
		const existing = this.points.get(normalizedName);
		if (!existing) return;
		this.points.delete(normalizedName);
		this.unobserveElement(existing.element);
		this.invalidateOrder();
	}

	public static has(name: string): boolean {
		return this.points.has(this.normalizeName(name));
	}

	public static get(name: string): EngineScrollRegisteredPoint | undefined {
		return this.points.get(this.normalizeName(name));
	}

	public static refresh(name: string): EngineScrollRegisteredPoint | undefined {
		return this.measure(this.normalizeName(name));
	}

	public static resolveElement(
		element: HTMLElement,
		options: EngineScrollPointOptions = {},
	): number {
		const align = options.align ?? "start";
		const offset = Number.isFinite(options.offset) ? options.offset! : 0;
		return this.clampPoint(this.alignedPointForElement(element, align) + offset);
	}

	public static resolve(
		name: string,
		options: EngineScrollPointOptions = {},
	): EngineScrollResolvedPoint | undefined {
		const registeredPoint = this.refresh(name);
		if (!registeredPoint) return undefined;
		const align = options.align ?? registeredPoint.align;
		const offset = registeredPoint.offset
			+ (Number.isFinite(options.offset) ? options.offset! : 0);
		const point = this.clampPoint(
			this.alignedPointForElement(registeredPoint.element, align) + offset,
		);
		return {
			...registeredPoint,
			point,
			align,
			offset,
		};
	}

	public static distance(name: string, fromPoint?: number): number | undefined {
		const resolved = this.resolve(name);
		if (!resolved) return undefined;
		const origin = Number.isFinite(fromPoint)
			? fromPoint!
			: EngineScrollRuntime.get().getState().viewport.top;
		return resolved.point - origin;
	}

	public static sorted(): EngineScrollRegisteredPoint[] {
		this.recalculate();
		if (!this.orderedCache) {
			this.orderedCache = [...this.points.values()]
				.sort((left, right) => left.point - right.point || left.name.localeCompare(right.name));
		}
		return [...this.orderedCache];
	}

	public static nearest(referencePoint?: number): EngineScrollRegisteredPoint | undefined {
		const points = this.sorted();
		if (points.length === 0) return undefined;
		const reference = Number.isFinite(referencePoint)
			? referencePoint!
			: EngineScrollRuntime.get().getState().viewport.top;
		let nearest = points[0];
		let nearestDistance = Math.abs(nearest.point - reference);
		for (let index = 1; index < points.length; index += 1) {
			const distance = Math.abs(points[index].point - reference);
			if (distance >= nearestDistance) continue;
			nearest = points[index];
			nearestDistance = distance;
		}
		return nearest;
	}

	public static next(referencePoint?: number, wrap = false): EngineScrollRegisteredPoint | undefined {
		const points = this.sorted();
		if (points.length === 0) return undefined;
		const reference = Number.isFinite(referencePoint)
			? referencePoint!
			: EngineScrollRuntime.get().getState().viewport.top;
		const nextPoint = points.find((point) => point.point > reference + 0.0001);
		return nextPoint ?? (wrap ? points[0] : undefined);
	}

	public static previous(referencePoint?: number, wrap = false): EngineScrollRegisteredPoint | undefined {
		const points = this.sorted();
		if (points.length === 0) return undefined;
		const reference = Number.isFinite(referencePoint)
			? referencePoint!
			: EngineScrollRuntime.get().getState().viewport.top;
		for (let index = points.length - 1; index >= 0; index -= 1) {
			if (points[index].point < reference - 0.0001) return points[index];
		}
		return wrap ? points[points.length - 1] : undefined;
	}

	public static names(): string[] {
		return [...this.points.keys()];
	}

	public static values(): IterableIterator<EngineScrollRegisteredPoint> {
		return this.points.values();
	}

	public static revision(): number {
		return this.revisionValue;
	}

	public static invalidateAll(): void {
		this.markGeometryDirty();
	}

	public static clear(): void {
		for (const point of this.points.values()) this.unobserveElement(point.element);
		this.points.clear();
		this.geometryDirty = false;
		this.invalidateOrder();
	}

	public static recalculate(): void {
		if (!this.geometryDirty) return;
		this.geometryDirty = false;
		for (const name of [...this.points.keys()]) this.measure(name);
	}
}

export type EngineRegisteredPoint = EngineScrollRegisteredPoint;
