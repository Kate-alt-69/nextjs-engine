// ============================================================================
// EngineScrollPointManager.ts
// ============================================================================

import { EngineScrollRuntime } from "./EngineScrollRuntime";
import type { EngineScrollAlignment } from "./EngineScrollTypes";

export type EngineScrollPointGroupInput = string | readonly string[];

export interface EngineScrollPointOptions {
	align?: EngineScrollAlignment;
	offset?: number;
	group?: EngineScrollPointGroupInput;
}

export interface EngineScrollRegisteredPoint {
	name: string;
	point: number;
	element: HTMLElement;
	align: EngineScrollAlignment;
	offset: number;
	groups: readonly string[];
}

export interface EngineScrollResolvedPoint extends EngineScrollRegisteredPoint {
	point: number;
}

export interface EngineScrollPointLocation {
	referencePoint: number;
	current: EngineScrollRegisteredPoint | null;
	previous: EngineScrollRegisteredPoint | null;
	next: EngineScrollRegisteredPoint | null;
	index: number;
	count: number;
	progress: number;
}

const POINT_EPSILON = 0.0001;

export class EngineScrollPointManager {
	private static readonly points = new Map<string, EngineScrollRegisteredPoint>();
	private static readonly observedElementRefs = new Map<HTMLElement, number>();
	private static readonly groupOrderCache = new Map<string, EngineScrollRegisteredPoint[]>();
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

	private static normalizeGroupName(group: string): string {
		return String(group).trim();
	}

	private static normalizeGroups(
		group: EngineScrollPointGroupInput | undefined,
	): string[] {
		if (group === undefined) return [];
		const source = Array.isArray(group) ? group : [group];
		const groups = new Set<string>();
		for (const item of source) {
			const normalized = this.normalizeGroupName(String(item));
			if (normalized) groups.add(normalized);
		}
		return [...groups];
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
		this.groupOrderCache.clear();
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
		if (Math.abs(nextPoint - registeredPoint.point) > POINT_EPSILON) {
			registeredPoint.point = nextPoint;
			this.invalidateOrder();
		}
		return registeredPoint;
	}

	private static ordered(): readonly EngineScrollRegisteredPoint[] {
		this.recalculate();
		if (!this.orderedCache) {
			this.orderedCache = [...this.points.values()]
				.sort((left, right) => left.point - right.point || left.name.localeCompare(right.name));
		}
		return this.orderedCache;
	}

	private static orderedFor(group?: string): readonly EngineScrollRegisteredPoint[] {
		const ordered = this.ordered();
		if (group === undefined) return ordered;

		const normalizedGroup = this.normalizeGroupName(group);
		if (!normalizedGroup) return [];

		let cached = this.groupOrderCache.get(normalizedGroup);
		if (!cached) {
			cached = ordered.filter((point) => point.groups.includes(normalizedGroup));
			this.groupOrderCache.set(normalizedGroup, cached);
		}
		return cached;
	}

	private static defaultReference(): number {
		return EngineScrollRuntime.get().getState().viewport.top;
	}

	private static normalizeReference(referencePoint?: number): number {
		return Number.isFinite(referencePoint)
			? referencePoint!
			: this.defaultReference();
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
			groups: this.normalizeGroups(options.group),
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
			: this.defaultReference();
		return resolved.point - origin;
	}

	public static locate(
		referencePoint?: number,
		group?: string,
	): EngineScrollPointLocation {
		const points = this.orderedFor(group);
		const reference = this.normalizeReference(referencePoint);
		if (points.length === 0) {
			return {
				referencePoint: reference,
				current: null,
				previous: null,
				next: null,
				index: -1,
				count: 0,
				progress: 0,
			};
		}

		let low = 0;
		let high = points.length - 1;
		let currentIndex = -1;
		while (low <= high) {
			const middle = (low + high) >> 1;
			if (points[middle].point <= reference + POINT_EPSILON) {
				currentIndex = middle;
				low = middle + 1;
			} else {
				high = middle - 1;
			}
		}

		if (currentIndex < 0) {
			return {
				referencePoint: reference,
				current: null,
				previous: null,
				next: points[0],
				index: -1,
				count: points.length,
				progress: 0,
			};
		}

		const current = points[currentIndex];
		const previous = currentIndex > 0 ? points[currentIndex - 1] : null;
		const next = currentIndex + 1 < points.length ? points[currentIndex + 1] : null;
		let progress = 1;
		if (next) {
			const span = next.point - current.point;
			progress = Math.abs(span) <= POINT_EPSILON
				? 1
				: Math.max(0, Math.min(1, (reference - current.point) / span));
		}

		return {
			referencePoint: reference,
			current,
			previous,
			next,
			index: currentIndex,
			count: points.length,
			progress,
		};
	}

	public static sorted(group?: string): EngineScrollRegisteredPoint[] {
		return [...this.orderedFor(group)];
	}

	public static inGroup(group: string): EngineScrollRegisteredPoint[] {
		return this.sorted(group);
	}

	public static nearest(
		referencePoint?: number,
		group?: string,
	): EngineScrollRegisteredPoint | undefined {
		const location = this.locate(referencePoint, group);
		if (!location.current) return location.next ?? undefined;
		if (!location.next) return location.current;
		const currentDistance = Math.abs(location.current.point - location.referencePoint);
		const nextDistance = Math.abs(location.next.point - location.referencePoint);
		return nextDistance < currentDistance ? location.next : location.current;
	}

	public static next(
		referencePoint?: number,
		wrap = false,
		group?: string,
	): EngineScrollRegisteredPoint | undefined {
		const points = this.orderedFor(group);
		if (points.length === 0) return undefined;
		const location = this.locate(referencePoint, group);
		return location.next ?? (wrap ? points[0] : undefined);
	}

	public static previous(
		referencePoint?: number,
		wrap = false,
		group?: string,
	): EngineScrollRegisteredPoint | undefined {
		const points = this.orderedFor(group);
		if (points.length === 0) return undefined;
		const location = this.locate(referencePoint, group);
		if (!location.current) return wrap ? points[points.length - 1] : undefined;
		if (Math.abs(location.current.point - location.referencePoint) <= POINT_EPSILON) {
			return location.previous ?? (wrap ? points[points.length - 1] : undefined);
		}
		return location.current;
	}

	public static names(group?: string): string[] {
		if (group === undefined) return [...this.points.keys()];
		return this.orderedFor(group).map((point) => point.name);
	}

	public static groups(): string[] {
		const groups = new Set<string>();
		for (const point of this.points.values()) {
			for (const group of point.groups) groups.add(group);
		}
		return [...groups].sort((left, right) => left.localeCompare(right));
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
