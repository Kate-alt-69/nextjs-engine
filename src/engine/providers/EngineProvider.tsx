"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineProvider
//
//  Root React context for the engine. Carries config, handlers, slots, and the
//  style collector used by generated engine styles.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	createContext,
	useCallback,
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
	/** Collector owned by the current EngineProvider render boundary. */
	styleCollector: StyleCollector;
}

const DEFAULT_CONFIG: Required<EngineConfig> = {
	breakpoints: BREAKPOINTS,
	contentMaxWidth: "1200px",
	gapBase: "1rem",
	spacingScale: (n: number) => `${n * 0.25}rem`,
};

const EMPTY_HANDLERS: Record<string, (...args: unknown[]) => void> = {};
const EMPTY_SLOTS: Record<string, ReactNode> = {};

const EngineContext = createContext<EngineContextValue>({
	config: DEFAULT_CONFIG,
	handlers: EMPTY_HANDLERS,
	slots: EMPTY_SLOTS,
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
	handlers,
	slots,
	styleCollector,
	children,
}: EngineProviderProps) {
	const ownedStyleCollectorRef = React.useRef<StyleCollector | null>(null);
	if (ownedStyleCollectorRef.current === null) {
		ownedStyleCollectorRef.current = new StyleCollector();
	}
	const collector = styleCollector ?? ownedStyleCollectorRef.current;
	const resolvedHandlers = handlers ?? EMPTY_HANDLERS;
	const resolvedSlots = slots ?? EMPTY_SLOTS;

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
			handlers: resolvedHandlers,
			slots: resolvedSlots,
			styleCollector: collector,
		}),
		[mergedConfig, resolvedHandlers, resolvedSlots, collector],
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

export function useStyleCollector(): StyleCollector {
	return useContext(EngineContext).styleCollector;
}

export function useHandler(name: string): ((...args: unknown[]) => void) | undefined {
	return useContext(EngineContext).handlers[name];
}

export function useSlot(name: string): ReactNode | undefined {
	return useContext(EngineContext).slots[name];
}

export interface EngineCollectedStylesProps {
	/** Preserve the historical page-level style id when createPage owns emission. */
	id?: string;
}

/** Emit only CSS collected by the nearest EngineProvider. */
export function EngineCollectedStyles({ id }: EngineCollectedStylesProps) {
	const styleCollector = useStyleCollector();
	const generatedId = React.useId().replace(/:/g, "");
	const css = styleCollector.collect();
	if (!css) return null;

	return (
		<style
			id={id ?? `__engine_styles_${generatedId}`}
			precedence="default"
			dangerouslySetInnerHTML={{ __html: css }}
		/>
	);
}

// ── Shared viewport-width subscription ────────────────────────────────────────

type ViewportSubscriber = (width: number) => void;

const viewportSubscribers = new Set<ViewportSubscriber>();
let viewportListenerAttached = false;
let viewportFrame: number | null = null;

function readViewportWidth(): number {
	return typeof window === "undefined" ? 0 : window.innerWidth;
}

function flushViewportSubscribers(): void {
	viewportFrame = null;
	const width = readViewportWidth();
	for (const subscriber of [...viewportSubscribers]) subscriber(width);
}

function handleViewportResize(): void {
	if (viewportFrame !== null) return;
	viewportFrame = window.requestAnimationFrame(flushViewportSubscribers);
}

function subscribeViewportWidth(subscriber: ViewportSubscriber): () => void {
	if (typeof window === "undefined") return () => undefined;
	viewportSubscribers.add(subscriber);

	if (!viewportListenerAttached) {
		viewportListenerAttached = true;
		window.addEventListener("resize", handleViewportResize, { passive: true });
	}

	return () => {
		viewportSubscribers.delete(subscriber);
		if (viewportSubscribers.size === 0 && viewportListenerAttached) {
			window.removeEventListener("resize", handleViewportResize);
			viewportListenerAttached = false;
			if (viewportFrame !== null) {
				window.cancelAnimationFrame(viewportFrame);
				viewportFrame = null;
			}
		}
	};
}

const breakpointOrder: Breakpoint[] = ["xs", "sm", "md", "lg", "xl", "2xl"];

function resolveBreakpoint(width: number, breakpoints: Required<EngineConfig>["breakpoints"]): Breakpoint {
	if (width >= (breakpoints["2xl"] ?? 1536)) return "2xl";
	if (width >= (breakpoints.xl ?? 1280)) return "xl";
	if (width >= (breakpoints.lg ?? 1024)) return "lg";
	if (width >= (breakpoints.md ?? 768)) return "md";
	if (width >= (breakpoints.sm ?? 640)) return "sm";
	return "xs";
}

/**
 * Returns the current active breakpoint.
 * SSR-safe: returns "xs" on the server / before hydration.
 * All hook instances share one RAF-coalesced passive window resize listener,
 * and React is notified only when this hook's resolved breakpoint changes.
 */
export function useBreakpoint(): Breakpoint {
	const { config } = useContext(EngineContext);
	const breakpoints = config.breakpoints;

	const subscribe = useCallback((notify: () => void) => {
		let currentBreakpoint = resolveBreakpoint(readViewportWidth(), breakpoints);
		return subscribeViewportWidth((width) => {
			const nextBreakpoint = resolveBreakpoint(width, breakpoints);
			if (nextBreakpoint === currentBreakpoint) return;
			currentBreakpoint = nextBreakpoint;
			notify();
		});
	}, [breakpoints]);

	const getSnapshot = useCallback(
		() => resolveBreakpoint(readViewportWidth(), breakpoints),
		[breakpoints],
	);

	return React.useSyncExternalStore(subscribe, getSnapshot, () => "xs");
}

/** Returns true if the current viewport is at or above the target breakpoint. */
export function useMinBreakpoint(target: Breakpoint): boolean {
	const current = useBreakpoint();
	return breakpointOrder.indexOf(current) >= breakpointOrder.indexOf(target);
}
