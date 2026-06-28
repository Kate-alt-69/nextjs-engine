// ============================================================================
// EngineScrollProvider.tsx — React integration for EngineScroll
// ============================================================================

"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
} from "react";

import { EngineScroll }          from "./EngineScroll";
import { EngineScrollNavigator } from "./EngineScrollNavigator";
import { EngineScrollURL }       from "./EngineScrollURL";

import type { EngineScrollTarget } from "./EngineScrollNavigator";

/* ========================================================================== */
/*  Context                                                                   */
/* ========================================================================== */

export interface EngineScrollCtx {
	/** Navigate to a target (semantic name, DOM id, absolute point, or keyword) */
	move: (
		target:    EngineScrollTarget,
		offset?:   number,
		duration?: number,
	) => boolean;
}

const ESContext = createContext<EngineScrollCtx | null>(null);

/* ========================================================================== */
/*  Hook                                                                      */
/* ========================================================================== */

export function useEngineScroll(): EngineScrollCtx {

	const ctx = useContext(ESContext);

	if (!ctx) {
		throw new Error(
			"[EngineScroll] useEngineScroll must be used inside <EngineScrollProvider>.",
		);
	}

	return ctx;

}

/* ========================================================================== */
/*  Provider                                                                  */
/* ========================================================================== */

export interface EngineScrollProviderProps {
	children: React.ReactNode;
}

export function EngineScrollProvider({
	children,
}: EngineScrollProviderProps) {

	const initialized = useRef(false);

	useEffect(() => {

		if (initialized.current) return;
		initialized.current = true;

		// Boot the scroll runtime (no-op if already running)
		EngineScroll.initialize();

		// Execute any #-es? command present at page load
		EngineScrollURL.execute();

		// Subscribe to future hash changes
		return EngineScrollURL.listen();

	}, []);

	const move = useCallback((
		target:    EngineScrollTarget,
		offset     = 0,
		duration?: number,
	): boolean => {
		return EngineScrollNavigator.move(target, offset, duration);
	}, []);

	return (
		<ESContext.Provider value={{ move }}>
			{children}
		</ESContext.Provider>
	);

}