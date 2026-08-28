// ============================================================================
// EngineScrollTimelineBinding.ts
// ============================================================================

import { EngineScrollEasing } from "./EngineScrollEasing";
import {
	EngineScrollTimelineTrack,
	type EngineScrollTimelineKeyframe,
} from "./EngineScrollTimelineTrack";
import type {
	EngineScrollTimelineFrame,
	EngineScrollTimelineSubscriber,
} from "./EngineScrollTimeline";
import type { EngineScrollEasingName } from "./EngineScrollTypes";

export interface EngineScrollTimelineFrameSource {
	subscribe(
		callback: EngineScrollTimelineSubscriber,
		emitInitial?: boolean,
	): () => void;
}

export interface EngineScrollTimelineStyleRange {
	from: number;
	to: number;
	start?: number;
	end?: number;
	unit?: string;
	precision?: number;
	easing?: EngineScrollEasingName;
}

export interface EngineScrollTimelineStyleKeyframes {
	keyframes: readonly EngineScrollTimelineKeyframe[];
	unit?: string;
	precision?: number;
}

export type EngineScrollTimelineStyleBinding =
	| readonly [number, number]
	| EngineScrollTimelineStyleRange
	| EngineScrollTimelineStyleKeyframes
	| ((frame: Readonly<EngineScrollTimelineFrame>) => string | number | null | undefined);

export type EngineScrollTimelineStyleBindings = Readonly<Record<
	string,
	EngineScrollTimelineStyleBinding
>>;

type CompiledStyleBinding = (
	frame: Readonly<EngineScrollTimelineFrame>,
) => string | number | null | undefined;

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function precision(value: number | undefined): number {
	if (!Number.isFinite(value)) return 4;
	return Math.max(0, Math.min(8, Math.trunc(value!)));
}

function formatNumber(value: number, digits: number, unit = ""): string {
	const power = 10 ** digits;
	const rounded = Math.round(value * power) / power;
	return `${Object.is(rounded, -0) ? 0 : rounded}${unit}`;
}

function rangeProgress(
	progress: number,
	start: number,
	end: number,
	easing: EngineScrollEasingName,
): number {
	const safeStart = clamp01(start);
	const safeEnd = clamp01(end);
	if (Math.abs(safeEnd - safeStart) < 0.000001) {
		return progress >= safeEnd ? 1 : 0;
	}
	const raw = clamp01((progress - safeStart) / (safeEnd - safeStart));
	return EngineScrollEasing.resolve(easing)(raw);
}

function isRangeTuple(
	binding: EngineScrollTimelineStyleBinding,
): binding is readonly [number, number] {
	return Array.isArray(binding);
}

function compileBinding(binding: EngineScrollTimelineStyleBinding): CompiledStyleBinding {
	if (typeof binding === "function") return binding;

	if (isRangeTuple(binding)) {
		const from = Number.isFinite(binding[0]) ? binding[0] : 0;
		const to = Number.isFinite(binding[1]) ? binding[1] : from;
		return (frame) => formatNumber(from + (to - from) * frame.progress, 4);
	}

	if ("keyframes" in binding) {
		const track = new EngineScrollTimelineTrack(binding.keyframes);
		const digits = precision(binding.precision);
		const unit = binding.unit ?? "";
		return (frame) => formatNumber(track.sample(frame.progress), digits, unit);
	}

	const from = Number.isFinite(binding.from) ? binding.from : 0;
	const to = Number.isFinite(binding.to) ? binding.to : from;
	const start = Number.isFinite(binding.start) ? binding.start! : 0;
	const end = Number.isFinite(binding.end) ? binding.end! : 1;
	const easing = binding.easing ?? "linear";
	const digits = precision(binding.precision);
	const unit = binding.unit ?? "";
	return (frame) => {
		const progress = rangeProgress(frame.progress, start, end, easing);
		return formatNumber(from + (to - from) * progress, digits, unit);
	};
}

export function bindEngineScrollTimelineStyles(
	source: EngineScrollTimelineFrameSource,
	element: HTMLElement,
	bindings: EngineScrollTimelineStyleBindings,
): () => void {
	const compiled = Object.entries(bindings).map(([property, binding]) => ({
		property,
		resolve: compileBinding(binding),
	}));
	const previousValues = new Map<string, string>();

	return source.subscribe((frame) => {
		for (const binding of compiled) {
			const value = binding.resolve(frame);
			if (value === null || value === undefined) {
				if (!previousValues.has(binding.property)) continue;
				element.style.removeProperty(binding.property);
				previousValues.delete(binding.property);
				continue;
			}

			const serialized = String(value);
			if (previousValues.get(binding.property) === serialized) continue;
			element.style.setProperty(binding.property, serialized);
			previousValues.set(binding.property, serialized);
		}
	});
}
