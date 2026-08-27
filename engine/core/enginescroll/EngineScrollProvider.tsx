// ============================================================================
// EngineScrollProvider.tsx — React integration for EngineScroll
// ============================================================================

"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from "react";
import { EngineScroll } from "./EngineScroll";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollURL } from "./EngineScrollURL";
import type {
	EngineScrollNavigationOptions,
	EngineScrollTarget,
} from "./EngineScrollNavigator";

export interface EngineScrollCtx {
	move: (
		target: EngineScrollTarget,
		offsetOrOptions?: number | EngineScrollNavigationOptions,
		duration?: number,
	) => boolean;
	nearest: (options?: EngineScrollNavigationOptions) => boolean;
	next: (options?: EngineScrollNavigationOptions & { wrap?: boolean }) => boolean;
	previous: (options?: EngineScrollNavigationOptions & { wrap?: boolean }) => boolean;
}

const ESContext = createContext<EngineScrollCtx | null>(null);

export function useEngineScroll(): EngineScrollCtx {
	const ctx = useContext(ESContext);
	if (!ctx) {
		throw new Error("[EngineScroll] useEngineScroll must be used inside <EngineScrollProvider>.");
	}
	return ctx;
}

export interface EngineScrollProviderProps {
	children: React.ReactNode;
}

export function EngineScrollProvider({ children }: EngineScrollProviderProps) {
	useEffect(() => {
		EngineScroll.initialize();
		EngineScrollURL.execute();
		return EngineScrollURL.listen();
	}, []);

	const move = useCallback((
		target: EngineScrollTarget,
		offsetOrOptions?: number | EngineScrollNavigationOptions,
		duration?: number,
	): boolean => EngineScrollNavigator.move(target, offsetOrOptions, duration), []);
	const nearest = useCallback(
		(options?: EngineScrollNavigationOptions): boolean => EngineScrollNavigator.nearest(options),
		[],
	);
	const next = useCallback(
		(options?: EngineScrollNavigationOptions & { wrap?: boolean }): boolean => EngineScrollNavigator.next(options),
		[],
	);
	const previous = useCallback(
		(options?: EngineScrollNavigationOptions & { wrap?: boolean }): boolean => EngineScrollNavigator.previous(options),
		[],
	);
	const value = useMemo<EngineScrollCtx>(
		() => ({ move, nearest, next, previous }),
		[move, nearest, next, previous],
	);

	return (
		<ESContext.Provider value={value}>
			{children}
		</ESContext.Provider>
	);
}
