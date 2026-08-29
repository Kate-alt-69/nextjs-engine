"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngineCanvas — shared canvas runtime
//
// Keeps expensive work out of the hot frame path:
// · built-in graphics engines are dynamically imported only when selected
// · adaptive DPR follows the observed display cadence instead of assuming 60 Hz
// · responsive CSS sizing is never replaced with fixed inline pixel sizing
// · offscreen + hidden pause reasons cannot accidentally resume each other
// · callback/scene refs stay current without tearing down the canvas runtime
// · callback mode owns RAF only while onDraw has useful work to do
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useCallback,
	useEffect,
	useRef,
	type CSSProperties,
} from "react";
import type { ECScene } from "./ECTypes";
import type { ECRenderContext, RenderingEngine } from "./RenderingEngine";
import {
	ECFrameClock,
	getAdaptiveFrameThresholds,
	resolveAdaptiveTargetFps,
	type ECFrameTiming,
} from "./ECFrameClock";
import { useHandler } from "../../providers/EngineProvider";

type Mode = "2d" | "webgl" | "webgl2" | "auto";
type Ctx2D = CanvasRenderingContext2D;
type CtxGL = WebGLRenderingContext;
type CtxGL2 = WebGL2RenderingContext;
type AnyCtx = Ctx2D | CtxGL | CtxGL2;

/** Return false from an onDraw callback when it has no more frames to produce. */
export type EngineCanvasDrawResult = void | false;
export type EngineCanvasFrameInfo = ECFrameTiming;

export interface EngineCanvasProps {
	mode?: Mode;
	width?: number;
	height?: number;
	responsive?: boolean;
	dpr?: number | "auto";
	maxDpr?: number;
	adaptive?: boolean;
	adaptiveTargetFps?: number | "display";
	pauseWhenOffscreen?: boolean;
	pauseWhenHidden?: boolean;
	alpha?: boolean;
	antialias?: boolean;
	/** Opt into the low-latency 2D context hint. Disabled by default to avoid presentation tearing. */
	desynchronized?: boolean;
	powerPreference?: "default" | "high-performance" | "low-power";
	onSetup?: string | ((ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void);
	onDraw?: string | ((
		ctx: AnyCtx,
		canvas: HTMLCanvasElement,
		delta: number,
		frame: number,
		timing: EngineCanvasFrameInfo,
	) => EngineCanvasDrawResult);
	onResize?: string | ((ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void);
	graphics?: {
		engine: string;
		scene: ECScene;
	};
	style?: CSSProperties;
	className?: string;
}

function getContext(
	canvas: HTMLCanvasElement,
	mode: Mode,
	options: {
		alpha: boolean;
		antialias: boolean;
		desynchronized: boolean;
		powerPreference: string;
	},
): { ctx: AnyCtx; resolvedMode: "2d" | "webgl" | "webgl2" } | null {
	const webglOptions = {
		alpha: options.alpha,
		antialias: options.antialias,
		powerPreference: options.powerPreference,
		preserveDrawingBuffer: false,
		failIfMajorPerformanceCaveat: false,
	};
	const canvas2dOptions: CanvasRenderingContext2DSettings = {
		alpha: options.alpha,
		desynchronized: options.desynchronized,
	};

	if (mode === "2d") {
		const context = canvas.getContext("2d", canvas2dOptions) as Ctx2D | null;
		return context ? { ctx: context, resolvedMode: "2d" } : null;
	}

	if (mode === "webgl2" || mode === "auto") {
		const context = canvas.getContext("webgl2", webglOptions) as CtxGL2 | null;
		if (context) return { ctx: context, resolvedMode: "webgl2" };
		if (mode === "webgl2") return null;
	}

	if (mode === "webgl" || mode === "auto") {
		const context = canvas.getContext("webgl", webglOptions) as CtxGL | null;
		if (context) return { ctx: context, resolvedMode: "webgl" };
		if (mode === "webgl") return null;
	}

	const context = canvas.getContext("2d", canvas2dOptions) as Ctx2D | null;
	return context ? { ctx: context, resolvedMode: "2d" } : null;
}

async function loadRenderingEngine(name: string): Promise<RenderingEngine> {
	switch (name) {
		case "2d": {
			const { Engine2D } = await import("./Engine2D");
			return new Engine2D();
		}
		case "3d": {
			const { Engine3D } = await import("./Engine3D");
			return new Engine3D();
		}
		case "svg": {
			const { EngineSVGEngine } = await import("./EngineSVG");
			return new EngineSVGEngine();
		}
		case "skia": {
			const { EngineSkiaEngine } = await import("./EngineSkia");
			return new EngineSkiaEngine();
		}
		default: {
			const { createRenderingEngine } = await import("./ECEngineRegistry");
			return createRenderingEngine(name);
		}
	}
}

function resolveGraphicsMode(mode: Mode, graphicsEngine?: string): Mode {
	if (graphicsEngine === "2d" || graphicsEngine === "svg") return "2d";
	if (graphicsEngine === "3d" && mode === "2d") return "webgl2";
	return mode;
}

function getTargetDpr(dpr: number | "auto", maxDpr: number): number {
	const rawDpr = dpr === "auto" ? window.devicePixelRatio || 1 : dpr;
	return Math.max(0.5, Math.min(rawDpr, maxDpr));
}

function getCanvasCssSize(
	canvas: HTMLCanvasElement,
	width: number | undefined,
	height: number | undefined,
): { width: number; height: number } {
	return {
		width: (width ?? canvas.clientWidth) || 300,
		height: (height ?? canvas.clientHeight) || 150,
	};
}

function resolveAdaptiveDpr(
	currentDpr: number,
	targetDpr: number,
	averageFps: number,
	targetFps: number,
): number {
	const thresholds = getAdaptiveFrameThresholds(targetFps);
	if (averageFps < thresholds.degradeBelow && currentDpr > 0.5) {
		return Math.max(0.5, currentDpr - 0.25);
	}
	if (averageFps > thresholds.recoverAbove && currentDpr < targetDpr - 0.05) {
		return Math.min(targetDpr, currentDpr + 0.25);
	}
	return currentDpr;
}

export const EngineCanvas = memo(function EngineCanvas({
	mode = "auto",
	width,
	height,
	responsive,
	dpr: dprProp = "auto",
	maxDpr = 2,
	adaptive = true,
	adaptiveTargetFps = "display",
	pauseWhenOffscreen = true,
	pauseWhenHidden = true,
	alpha = false,
	antialias = true,
	desynchronized = false,
	powerPreference = "high-performance",
	onSetup: onSetupRaw,
	onDraw: onDrawRaw,
	onResize: onResizeRaw,
	graphics,
	style,
	className,
}: EngineCanvasProps) {
	const onSetupFromContext = useHandler(typeof onSetupRaw === "string" ? onSetupRaw : "");
	const onDrawFromContext = useHandler(typeof onDrawRaw === "string" ? onDrawRaw : "");
	const onResizeFromContext = useHandler(typeof onResizeRaw === "string" ? onResizeRaw : "");

	const resolvedOnSetup = (typeof onSetupRaw === "function" ? onSetupRaw : onSetupFromContext) as
		| ((ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void)
		| undefined;
	const resolvedOnDraw = (typeof onDrawRaw === "function" ? onDrawRaw : onDrawFromContext) as
		| ((ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number, timing: EngineCanvasFrameInfo) => EngineCanvasDrawResult)
		| undefined;
	const resolvedOnResize = (typeof onResizeRaw === "function" ? onResizeRaw : onResizeFromContext) as
		| ((ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void)
		| undefined;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const onDrawRef = useRef(resolvedOnDraw);
	const onResizeRef = useRef(resolvedOnResize);
	const graphicsRef = useRef(graphics);
	const requestLoopRef = useRef<() => void>(() => {});
	onDrawRef.current = resolvedOnDraw;
	onResizeRef.current = resolvedOnResize;
	graphicsRef.current = graphics;

	const isResponsive = responsive ?? (width === undefined && height === undefined);
	const resolvedMode = resolveGraphicsMode(mode, graphics?.engine);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const contextResult = getContext(canvas, resolvedMode, {
			alpha,
			antialias,
			desynchronized,
			powerPreference,
		});
		if (!contextResult) {
			console.warn(`[EngineCanvas] Could not obtain a ${resolvedMode} rendering context.`);
			return;
		}

		const context = contextResult.ctx;
		let graphicsEngine: RenderingEngine | null = null;
		let disposed = false;
		let raf = 0;
		let running = false;
		let drawCompleted = false;
		let frame = 0;
		let lastDprAdjustment = 0;
		let currentDpr = getTargetDpr(dprProp, maxDpr);
		let lastCssWidth = 0;
		let lastCssHeight = 0;
		let offscreenPaused = false;
		let hiddenPaused = pauseWhenHidden && document.hidden;
		const frameClock = new ECFrameClock(48);

		const resizeBackingStore = (
			cssWidth: number,
			cssHeight: number,
			dpr: number,
			notify: boolean,
		): boolean => {
			if (cssWidth <= 0 || cssHeight <= 0) return false;
			lastCssWidth = cssWidth;
			lastCssHeight = cssHeight;
			currentDpr = dpr;

			const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
			const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
			const backingStoreChanged = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
			if (backingStoreChanged) {
				canvas.width = pixelWidth;
				canvas.height = pixelHeight;
				if (context instanceof CanvasRenderingContext2D) {
					context.setTransform(dpr, 0, 0, dpr, 0, 0);
				}
			}

			if (notify) {
				graphicsEngine?.resize(cssWidth, cssHeight, dpr);
				onResizeRef.current?.(context, canvas, cssWidth, cssHeight);
			}
			return backingStoreChanged;
		};

		const initialSize = getCanvasCssSize(canvas, width, height);
		resizeBackingStore(initialSize.width, initialSize.height, currentDpr, false);
		const userCleanup = resolvedOnSetup?.(context, canvas);

		const shouldPause = (): boolean => offscreenPaused || hiddenPaused;

		const stopLoop = (): void => {
			if (!running) return;
			running = false;
			cancelAnimationFrame(raf);
			frameClock.discontinuity();
		};

		const tick = (now: number): void => {
			if (disposed || shouldPause()) {
				running = false;
				frameClock.discontinuity();
				return;
			}

			const timing = frameClock.step(now);
			const delta = timing.delta;

			if (adaptive && timing.averageFps > 0 && now - lastDprAdjustment >= 750) {
				const targetDpr = getTargetDpr(dprProp, maxDpr);
				const targetFps = resolveAdaptiveTargetFps(adaptiveTargetFps, timing.refreshRate);
				const nextDpr = resolveAdaptiveDpr(currentDpr, targetDpr, timing.averageFps, targetFps);

				if (Math.abs(nextDpr - currentDpr) >= 0.05) {
					resizeBackingStore(lastCssWidth, lastCssHeight, nextDpr, true);
				}
				lastDprAdjustment = now;
			}

			const currentGraphics = graphicsRef.current;
			if (currentGraphics) {
				graphicsEngine?.render(currentGraphics.scene, delta, frame++);
			} else {
				const draw = onDrawRef.current;
				if (!draw) {
					running = false;
					return;
				}
				if (draw(context, canvas, delta, frame++, timing) === false) {
					drawCompleted = true;
					running = false;
					return;
				}
			}

			raf = requestAnimationFrame(tick);
		};

		const startLoop = (): void => {
			if (running || disposed || shouldPause()) return;
			if (!graphicsRef.current && (drawCompleted || !onDrawRef.current)) return;
			running = true;
			frameClock.discontinuity();
			raf = requestAnimationFrame(tick);
		};

		requestLoopRef.current = () => {
			if (graphicsRef.current || !onDrawRef.current) return;
			drawCompleted = false;
			startLoop();
		};

		const syncLoopState = (): void => {
			if (shouldPause()) stopLoop();
			else startLoop();
		};

		let resizeObserver: ResizeObserver | undefined;
		if (isResponsive && typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (!entry) return;
				const backingStoreChanged = resizeBackingStore(
					entry.contentRect.width,
					entry.contentRect.height,
					currentDpr,
					true,
				);
				if (backingStoreChanged && !graphicsRef.current && onDrawRef.current) {
					drawCompleted = false;
					startLoop();
				}
			});
			resizeObserver.observe(canvas);
		}

		let intersectionObserver: IntersectionObserver | undefined;
		if (pauseWhenOffscreen && typeof IntersectionObserver !== "undefined") {
			intersectionObserver = new IntersectionObserver(([entry]) => {
				offscreenPaused = !entry.isIntersecting;
				syncLoopState();
			}, { rootMargin: "200px 0px" });
			intersectionObserver.observe(canvas);
		}

		const handleVisibilityChange = (): void => {
			hiddenPaused = pauseWhenHidden && document.hidden;
			syncLoopState();
		};
		if (pauseWhenHidden) document.addEventListener("visibilitychange", handleVisibilityChange);

		const initializeGraphics = async (): Promise<void> => {
			const currentGraphics = graphicsRef.current;
			if (!currentGraphics) {
				startLoop();
				return;
			}

			try {
				const engine = await loadRenderingEngine(currentGraphics.engine);
				const renderContext: ECRenderContext = {
					canvas,
					ctx2d: contextResult.resolvedMode === "2d"
						? context as CanvasRenderingContext2D
						: undefined,
					gl: contextResult.resolvedMode !== "2d"
						? context as WebGLRenderingContext | WebGL2RenderingContext
						: undefined,
					width: lastCssWidth,
					height: lastCssHeight,
					dpr: currentDpr,
				};
				await engine.init(renderContext);
				if (disposed) {
					engine.dispose();
					return;
				}
				graphicsEngine = engine;
				startLoop();
			} catch (error) {
				console.error(`[EngineCanvas] Failed to initialize graphics engine "${currentGraphics.engine}".`, error);
			}
		};
		void initializeGraphics();

		return () => {
			disposed = true;
			requestLoopRef.current = () => {};
			stopLoop();
			userCleanup?.();
			graphicsEngine?.dispose();
			graphicsEngine = null;
			resizeObserver?.disconnect();
			intersectionObserver?.disconnect();
			if (pauseWhenHidden) document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [
		resolvedMode,
		alpha,
		antialias,
		desynchronized,
		powerPreference,
		width,
		height,
		isResponsive,
		dprProp,
		maxDpr,
		adaptive,
		adaptiveTargetFps,
		pauseWhenOffscreen,
		pauseWhenHidden,
		graphics?.engine,
		resolvedOnSetup,
	]);

	useEffect(() => {
		if (resolvedOnDraw) requestLoopRef.current();
	}, [resolvedOnDraw]);

	const canvasStyle: CSSProperties = {
		transform: "translateZ(0)",
		contain: "strict",
		display: "block",
		...(isResponsive ? { width: "100%", height: "100%", minHeight: "150px" } : {}),
		...(width !== undefined ? { width: `${width}px` } : {}),
		...(height !== undefined ? { height: `${height}px` } : {}),
		...style,
	};

	return <canvas ref={canvasRef} className={className} style={canvasStyle} />;
});

// ─────────────────────────────────────────────────────────────────────────────
// Low-level hook
// ─────────────────────────────────────────────────────────────────────────────

export function useEngineCanvas(
	options: Pick<EngineCanvasProps, "mode" | "alpha" | "antialias" | "desynchronized" | "powerPreference"> = {},
) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const mode = options.mode ?? "auto";
	const alpha = options.alpha ?? false;
	const antialias = options.antialias ?? true;
	const desynchronized = options.desynchronized ?? false;
	const powerPreference = options.powerPreference ?? "high-performance";

	const setup = useCallback((
		handlers: Pick<EngineCanvasProps, "adaptive" | "adaptiveTargetFps" | "maxDpr"> & {
			onSetup?: (ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void;
			onDraw?: (
				ctx: AnyCtx,
				canvas: HTMLCanvasElement,
				delta: number,
				frame: number,
				timing: EngineCanvasFrameInfo,
			) => EngineCanvasDrawResult;
			onResize?: (ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void;
		},
	): (() => void) => {
		const canvas = canvasRef.current;
		if (!canvas) return () => {};

		const contextResult = getContext(canvas, mode, { alpha, antialias, desynchronized, powerPreference });
		if (!contextResult) return () => {};

		const context = contextResult.ctx;
		const maxDpr = handlers.maxDpr ?? 2;
		const adaptive = handlers.adaptive ?? true;
		const adaptiveTargetFps = handlers.adaptiveTargetFps ?? "display";
		const frameClock = new ECFrameClock(48);
		let currentDpr = getTargetDpr("auto", maxDpr);
		let lastDprAdjustment = 0;
		let frame = 0;
		let raf = 0;

		const resize = (dpr: number): void => {
			const cssWidth = canvas.clientWidth || canvas.offsetWidth || 300;
			const cssHeight = canvas.clientHeight || canvas.offsetHeight || 150;
			canvas.width = Math.max(1, Math.round(cssWidth * dpr));
			canvas.height = Math.max(1, Math.round(cssHeight * dpr));
			currentDpr = dpr;
			if (context instanceof CanvasRenderingContext2D) {
				context.setTransform(dpr, 0, 0, dpr, 0, 0);
			}
			handlers.onResize?.(context, canvas, cssWidth, cssHeight);
		};
		resize(currentDpr);

		const cleanup = handlers.onSetup?.(context, canvas);
		const tick = (now: number): void => {
			const timing = frameClock.step(now);
			const delta = timing.delta;

			if (adaptive && timing.averageFps > 0 && now - lastDprAdjustment >= 750) {
				const targetDpr = getTargetDpr("auto", maxDpr);
				const targetFps = resolveAdaptiveTargetFps(adaptiveTargetFps, timing.refreshRate);
				const nextDpr = resolveAdaptiveDpr(currentDpr, targetDpr, timing.averageFps, targetFps);
				if (Math.abs(nextDpr - currentDpr) >= 0.05) resize(nextDpr);
				lastDprAdjustment = now;
			}

			if (handlers.onDraw?.(context, canvas, delta, frame++, timing) === false) return;
			raf = requestAnimationFrame(tick);
		};
		if (handlers.onDraw) {
			frameClock.discontinuity();
			raf = requestAnimationFrame(tick);
		}

		return () => {
			cancelAnimationFrame(raf);
			cleanup?.();
		};
	}, [mode, alpha, antialias, desynchronized, powerPreference]);

	return { canvasRef, setup };
}
