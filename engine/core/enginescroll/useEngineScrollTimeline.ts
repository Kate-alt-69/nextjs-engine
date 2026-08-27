// ============================================================================
// useEngineScrollTimeline.ts
// ============================================================================

"use client";

import {
	useCallback,
	useMemo,
	useSyncExternalStore,
} from "react";
import {
	EngineScrollTimeline,
	type EngineScrollTimelineConfig,
	type EngineScrollTimelineFrame,
} from "./EngineScrollTimeline";

export function useEngineScrollTimeline(
	config: EngineScrollTimelineConfig,
): Readonly<EngineScrollTimelineFrame> {
	const timeline = useMemo(
		() => new EngineScrollTimeline(config),
		[
			config.start,
			config.end,
			config.source,
			config.startOffset,
			config.endOffset,
			config.startAlign,
			config.endAlign,
			config.easing,
		],
	);

	const subscribe = useCallback(
		(notify: () => void) => timeline.subscribe(() => notify(), false),
		[timeline],
	);
	const getSnapshot = useCallback(() => timeline.snapshot(), [timeline]);

	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
