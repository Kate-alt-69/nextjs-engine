"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
	EngineScheduler,
	type EngineSchedulePolicy,
	type EngineScheduleSnapshot,
} from "../core/enginescheduler/EngineScheduler";

const DEFAULT_SNAPSHOT: EngineScheduleSnapshot = {
	state: "deferred",
	near: false,
	visible: false,
	underFramePressure: false,
};

export interface UseEngineScheduleReturn<T extends Element = HTMLElement> extends EngineScheduleSnapshot {
	ref: RefObject<T | null>;
}

export function useEngineSchedule<T extends Element = HTMLElement>(
	policy: EngineSchedulePolicy = {},
): UseEngineScheduleReturn<T> {
	const ref = useRef<T | null>(null);
	const [snapshot, setSnapshot] = useState<EngineScheduleSnapshot>(() => policy.priority
		? { state: "critical", near: true, visible: true, underFramePressure: false }
		: DEFAULT_SNAPSHOT);
	const priority = policy.priority === true;
	const nearMargin = policy.nearMargin ?? "700px 0px";
	const visibleThreshold = policy.visibleThreshold ?? 0.01;
	const releaseWhenFar = policy.releaseWhenFar === true;

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		return EngineScheduler.observe(element, setSnapshot, {
			priority,
			nearMargin,
			visibleThreshold,
			releaseWhenFar,
		});
	}, [nearMargin, priority, releaseWhenFar, visibleThreshold]);

	useEffect(() => EngineScheduler.subscribeFramePressure((underFramePressure) => {
		setSnapshot((current) => current.underFramePressure === underFramePressure
			? current
			: { ...current, underFramePressure });
	}), []);

	return { ref, ...snapshot };
}

export function useEngineVisible<T extends Element = HTMLElement>(priority = false): UseEngineScheduleReturn<T> {
	return useEngineSchedule<T>({ priority, nearMargin: "600px 0px", releaseWhenFar: true });
}
