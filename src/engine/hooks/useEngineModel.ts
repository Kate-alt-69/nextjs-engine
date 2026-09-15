"use client";

import { useCallback, useEffect, useId, useSyncExternalStore } from "react";
import type { EngineModel, EngineModelState } from "../core/EngineModel";

export function useEngineModel<TState extends EngineModelState>(
	model: EngineModel<TState>,
): Readonly<TState> {
	const consumerId = `useEngineModel:${useId()}`;
	const subscribe = useCallback((listener: () => void) => model.subscribe(listener), [model]);
	const getSnapshot = useCallback(() => model.snapshot(), [model]);
	useEffect(() => model.registerDebugConsumer(consumerId, "*"), [consumerId, model]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useEngineModelValue<
	TState extends EngineModelState,
	TKey extends keyof TState,
>(
	model: EngineModel<TState>,
	key: TKey,
): TState[TKey] {
	const consumerId = `useEngineModelValue:${useId()}`;
	const subscribe = useCallback((listener: () => void) => model.watch(key, () => listener()), [key, model]);
	const getSnapshot = useCallback(() => model.get(key), [key, model]);
	useEffect(() => model.registerDebugConsumer(consumerId, key), [consumerId, key, model]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
