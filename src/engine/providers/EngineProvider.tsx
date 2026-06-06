"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineProvider
//
//  Root React context for the engine. Carries:
//    · Engine config (breakpoints, spacing scale, content max-width)
//    · Page-level handler registry (onClick callbacks by name)
//    · Style collector reference (server-only writes, client reads)
//    · Page-level props / slots
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
} from "react";
import { StyleCollector } from "../core/StyleCollector";
import {
	type EngineConfig,
	BREAKPOINTS,
	type Breakpoint,
} from "../schema/types";

// ── Context shape ─────────────────────────────────────────────────────────────

export interface EngineContextValue {
	config: Required<EngineConfig>;
	/** Named event handlers — keyed by string matching SchemaNode onClick prop */
	handlers: Record<string, (...args: unknown[]) => void>;
	/** Named slot content — keyed by string matching SlotProps.name */
	slots: Record<string, ReactNode>;
	/** Style collector (server-only write path) */
	styleCollector: StyleCollector;
}

const DEFAULT_CONFIG: Required<EngineConfig> = {
	breakpoints: BREAKPOINTS,
	contentMaxWidth: "1200px",
	gapBase: "1rem",
	spacingScale: (n: number) => `${n * 0.25}rem`,
};

const EngineContext = createContext<EngineContextValue>({
	config: DEFAULT_CONFIG,
	handlers: {},
	slots: {},
	styleCollector: new StyleCollector(),
});

// ── Provider ──────────────────────────────────────────────────────────────────

export interface EngineProviderProps {
	config?: EngineConfig;
	handlers?: Record<string, (...args: unknown[]) => void>;
	slots?: Record<string, ReactNode>;
	styleCollector?: StyleCollector;
	children: ReactNode;
}

export function EngineProvider({
	config,
	handlers = {},
	slots = {},
	styleCollector,
	children,
}: EngineProviderProps) {
	const collector = useMemo(
		() => styleCollector ?? new StyleCollector(),
		[styleCollector],
	);

	const mergedConfig = useMemo<Required<EngineConfig>>(
		() => ({
			...DEFAULT_CONFIG,
			...config,
			breakpoints: { ...BREAKPOINTS, ...(config?.breakpoints ?? {}) },
		}),
		[config],
	);

	const value = useMemo<EngineContextValue>(
		() => ({
			config: mergedConfig,
			handlers,
			slots,
			styleCollector: collector,
		}),
		[mergedConfig, handlers, slots, collector],
	);

	return (
		<EngineContext.Provider value={value}>{children}</EngineContext.Provider>
	);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useEngineContext(): EngineContextValue {
	return useContext(EngineContext);
}

export function useEngineConfig(): Required<EngineConfig> {
	return useContext(EngineContext).config;
}

export function useHandler(name: string): ((...args: unknown[]) => void) | undefined {
	return useContext(EngineContext).handlers[name];
}

export function useSlot(name: string): ReactNode | undefined {
	return useContext(EngineContext).slots[name];
}

// ── Breakpoint-aware context hook ─────────────────────────────────────────────

/**
 * Returns the current active breakpoint.
 * SSR-safe: returns "xs" on the server / before hydration.
 * Updates on resize via a passive listener.
 */
export function useBreakpoint(): Breakpoint {
	const { config } = useContext(EngineContext);
	const [bp, setBp] = React.useState<Breakpoint>("xs");

	React.useEffect(() => {
		function getBreakpoint(w: number): Breakpoint {
			const bps = config.breakpoints;
			if (w >= (bps["2xl"] ?? 1536)) return "2xl";
			if (w >= (bps.xl ?? 1280)) return "xl";
			if (w >= (bps.lg ?? 1024)) return "lg";
			if (w >= (bps.md ?? 768)) return "md";
			if (w >= (bps.sm ?? 640)) return "sm";
			return "xs";
		}

		function update() {
			setBp(getBreakpoint(window.innerWidth));
		}

		update();
		window.addEventListener("resize", update, { passive: true });
		return () => window.removeEventListener("resize", update);
	}, [config.breakpoints]);

	return bp;
}

/**
 * Returns true if the current viewport is at or above the given breakpoint.
 * SSR-safe: returns false until hydrated.
 */
export function useMinBreakpoint(target: Breakpoint): boolean {
	const current = useBreakpoint();
	const order: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];
	return order.indexOf(current) >= order.indexOf(target);
}
