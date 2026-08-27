"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineProvider
//
//  Root React context for the engine. Carries config, handlers, slots, and the
//  style collector currently used by generated engine styles.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
} from "react";
import { globalStyleCollector, StyleCollector } from "../core/StyleCollector";
import {
	type EngineConfig,
	BREAKPOINTS,
	type Breakpoint,
} from "../schema/types";

export interface EngineContextValue {
	config: Required<EngineConfig>;
	/** Named event handlers — keyed by string matching SchemaNode handler props. */
	handlers: Record<string, (...args: unknown[]) => void>;
	/** Named slot content — keyed by string matching SlotProps.name. */
	slots: Record<string, ReactNode>;
	/** Collector used by the current engine style pipeline. */
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
	styleCollector: globalStyleCollector,
});

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
	// Generated style helpers still use the process-level collector today. Point
	// the context at that real collector by default instead of allocating a new
	// unused StyleCollector for every provider instance.
	const collector = styleCollector ?? globalStyleCollector;

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

// ── Shared viewport-width subscription ────────────────────────────────────────

const viewportSubscribers = new Set<() => void>();
let viewportListenerAttached = false;

function readViewportWidth(): number {
	return typeof window === "undefined" ? 0 : window.innerWidth;
}

function notifyViewportSubscribers(): void {
	for (const subscriber of [...viewportSubscribers]) subscriber();
}

function subscribeViewportWidth(subscriber: () => void): () => void {
	if (typeof window === "undefined") return () => undefined;
	viewportSubscribers.add(subscriber);

	if (!viewportListenerAttached) {
		viewportListenerAttached = true;
		window.addEventListener("resize", notifyViewportSubscribers, { passive: true });
	}

	return () => {
		viewportSubscribers.delete(subscriber);
		if (viewportSubscribers.size === 0 && viewportListenerAttached) {
			window.removeEventListener("resize", notifyViewportSubscribers);
			viewportListenerAttached = false;
		}
	};
}

const breakpointOrder: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

/**
 * Returns the current active breakpoint.
 * SSR-safe: returns "xs" on the server / before hydration.
 * All hook instances share one passive window resize listener.
 */
export function useBreakpoint(): Breakpoint {
	const { config } = useContext(EngineContext);
	const width = React.useSyncExternalStore(
		subscribeViewportWidth,
		readViewportWidth,
		() => 0,
	);
	const breakpoints = config.breakpoints;

	if (width >= (breakpoints["2xl"] ?? 1536)) return "2xl";
	if (width >= (breakpoints.xl ?? 1280)) return "xl";
	if (width >= (breakpoints.lg ?? 1024)) return "lg";
	if (width >= (breakpoints.md ?? 768)) return "md";
	if (width >= (breakpoints.sm ?? 640)) return "sm";
	return "xs";
}

/** Returns true if the current viewport is at or above the target breakpoint. */
export function useMinBreakpoint(target: Breakpoint): boolean {
	const current = useBreakpoint();
	return breakpointOrder.indexOf(current) >= breakpointOrder.indexOf(target);
}
