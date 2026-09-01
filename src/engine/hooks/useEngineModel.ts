"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { EngineModel, EngineModelState } from "../core/EngineModel";

export function useEngineModel<TState extends EngineModelState>(
	model: EngineModel<TState>,
): Readonly<TState> {
	const subscribe = useCallback((listener: () => void) => model.subscribe(listener), [model]);
	const getSnapshot = useCallback(() => model.snapshot(), [model]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEngineModelValue<
	TState extends EngineModelState,
	TKey extends keyof TState,
>(
	model: EngineModel<TState>,
	key: TKey,
): TState[TKey] {
	const subscribe = useCallback((listener: () => void) => model.watch(key, () => listener()), [key, model]);
	const getSnapshot = useCallback(() => model.get(key), [key, model]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
