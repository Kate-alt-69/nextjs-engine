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
import type { EngineScrollTarget } from "./EngineScrollNavigator";

export interface EngineScrollCtx {
	move: (
		target: EngineScrollTarget,
		offset?: number,
		duration?: number,
	) => boolean;
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
		offset = 0,
		duration?: number,
	): boolean => EngineScrollNavigator.move(target, offset, duration), []);
	const value = useMemo<EngineScrollCtx>(() => ({ move }), [move]);

	return (
		<ESContext.Provider value={value}>
			{children}
		</ESContext.Provider>
	);
}
