"use client";

// ─────────────────────────────────────────────────────────────────────────────
// EngineCanvas — shared canvas runtime
//
// Keeps expensive work out of the hot frame path:
// · built-in graphics engines are dynamically imported only when selected
// · adaptive DPR changes are rate-limited and use hysteresis
// · responsive CSS sizing is never replaced with fixed inline pixel sizing
// · offscreen + hidden pause reasons cannot accidentally resume each other
// · callback/scene refs stay current without tearing down the canvas runtime
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
import { useHandler } from "../../providers/EngineProvider";

type Mode = "2d" | "webgl" | "webgl2" | "auto";
type Ctx2D = CanvasRenderingContext2D;
type CtxGL = WebGLRenderingContext;
type CtxGL2 = WebGL2RenderingContext;
type AnyCtx = Ctx2D | CtxGL | CtxGL2;

export interface EngineCanvasProps {
	mode?: Mode;
	width?: number;
	height?: number;
	responsive?: boolean;
	dpr?: number | "auto";
	maxDpr?: number;
	adaptive?: boolean;
	pauseWhenOffscreen?: boolean;
	pauseWhenHidden?: boolean;
	alpha?: boolean;
	antialias?: boolean;
	powerPreference?: "default" | "high-performance" | "low-power";
	onSetup?: string | ((ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void);
	onDraw?: string | ((ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number) => void);
	onResize?: string | ((ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void);
	graphics?: {
		engine: string;
		scene: ECScene;
	};
	style?: CSSProperties;
	className?: string;
}

class FPSTracker {
	private readonly samples: number[];
	private index = 0;
	private total: number;

	constructor(private readonly size = 30) {
		this.samples = Array(size).fill(60);
		this.total = size * 60;
	}

	push(fps: number): void {
		const sampleIndex = this.index++ % this.size;
		this.total -= this.samples[sampleIndex];
		this.samples[sampleIndex] = fps;
		this.total += fps;
	}

	avg(): number {
		return this.total / this.size;
	}
}

function getContext(
	canvas: HTMLCanvasElement,
	mode: Mode,
	options: { alpha: boolean; antialias: boolean; powerPreference: string },
): { ctx: AnyCtx; resolvedMode: "2d" | "webgl" | "webgl2" } | null {
	const webglOptions = {
		alpha: options.alpha,
		antialias: options.antialias,
		powerPreference: options.powerPreference,
		preserveDrawingBuffer: false,
		failIfMajorPerformanceCaveat: false,
	};

	if (mode === "2d") {
		const context = canvas.getContext("2d", {
			alpha: options.alpha,
			desynchronized: true,
		}) as Ctx2D | null;
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

	const context = canvas.getContext("2d", {
		alpha: options.alpha,
		desynchronized: true,
	}) as Ctx2D | null;
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
		width: width ?? canvas.clientWidth || 300,
		height: height ?? canvas.clientHeight || 150,
	};
}

export const EngineCanvas = memo(function EngineCanvas({
	mode = "auto",
	width,
	height,
	responsive,
	dpr: dprProp = "auto",
	maxDpr = 2,
	adaptive = true,
	pauseWhenOffscreen = true,
	pauseWhenHidden = true,
	alpha = false,
	antialias = true,
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
		| ((ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number) => void)
		| undefined;
	const resolvedOnResize = (typeof onResizeRaw === "function" ? onResizeRaw : onResizeFromContext) as
		| ((ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void)
		| undefined;

	const canvasRef = useRef<HTMLCanvasElement>(null);
	const onDrawRef = useRef(resolvedOnDraw);
	const onResizeRef = useRef(resolvedOnResize);
	const graphicsRef = useRef(graphics);
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
		let frame = 0;
		let lastFrameTime = 0;
		let lastDprAdjustment = 0;
		let currentDpr = getTargetDpr(dprProp, maxDpr);
		let lastCssWidth = 0;
		let lastCssHeight = 0;
		let offscreenPaused = false;
		let hiddenPaused = pauseWhenHidden && document.hidden;
		const fpsTracker = new FPSTracker(30);

		const resizeBackingStore = (
			cssWidth: number,
			cssHeight: number,
			dpr: number,
			notify: boolean,
		): void => {
			if (cssWidth <= 0 || cssHeight <= 0) return;
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
				graphicsEngine?.resize(cssWidth, cssHeight);
				onResizeRef.current?.(context, canvas, cssWidth, cssHeight);
			}
		};

		const initialSize = getCanvasCssSize(canvas, width, height);
		resizeBackingStore(initialSize.width, initialSize.height, currentDpr, false);
		const userCleanup = resolvedOnSetup?.(context, canvas);

		const shouldPause = (): boolean => offscreenPaused || hiddenPaused;

		const stopLoop = (): void => {
			if (!running) return;
			running = false;
			cancelAnimationFrame(raf);
		};

		const tick = (now: number): void => {
			if (disposed || shouldPause()) {
				running = false;
				return;
			}

			const delta = lastFrameTime === 0 ? 16 : Math.min(250, now - lastFrameTime);
			lastFrameTime = now;
			fpsTracker.push(1000 / Math.max(delta, 1));

			if (adaptive && now - lastDprAdjustment >= 750) {
				const averageFps = fpsTracker.avg();
				const targetDpr = getTargetDpr(dprProp, maxDpr);
				let nextDpr = currentDpr;

				if (averageFps < 32 && currentDpr > 0.5) {
					nextDpr = Math.max(0.5, currentDpr - 0.25);
				} else if (averageFps > 56 && currentDpr < targetDpr - 0.05) {
					nextDpr = Math.min(targetDpr, currentDpr + 0.25);
				}

				if (Math.abs(nextDpr - currentDpr) >= 0.05) {
					resizeBackingStore(lastCssWidth, lastCssHeight, nextDpr, true);
				}
				lastDprAdjustment = now;
			}

			const currentGraphics = graphicsRef.current;
			if (currentGraphics) {
				graphicsEngine?.render(currentGraphics.scene, delta, frame++);
			} else {
				onDrawRef.current?.(context, canvas, delta, frame++);
			}

			raf = requestAnimationFrame(tick);
		};

		const startLoop = (): void => {
			if (running || disposed || shouldPause()) return;
			running = true;
			lastFrameTime = 0;
			raf = requestAnimationFrame(tick);
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
				resizeBackingStore(entry.contentRect.width, entry.contentRect.height, currentDpr, true);
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
		powerPreference,
		width,
		height,
		isResponsive,
		dprProp,
		maxDpr,
		adaptive,
		pauseWhenOffscreen,
		pauseWhenHidden,
		graphics?.engine,
		resolvedOnSetup,
	]);

	const canvasStyle: CSSProperties = {
		transform: "translateZ(0)",
		contain: "strict",
		display: "block",
		...(isResponsive ? { width: "100%", height: "100%" } : {}),
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
	options: Pick<EngineCanvasProps, "mode" | "alpha" | "antialias" | "powerPreference"> = {},
) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const mode = options.mode ?? "auto";
	const alpha = options.alpha ?? false;
	const antialias = options.antialias ?? true;
	const powerPreference = options.powerPreference ?? "high-performance";

	const setup = useCallback((
		handlers: Pick<EngineCanvasProps, "adaptive" | "maxDpr"> & {
			onSetup?: (ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void;
			onDraw?: (ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number) => void;
			onResize?: (ctx: AnyCtx, canvas: HTMLCanvasElement, width: number, height: number) => void;
		},
	): (() => void) => {
		const canvas = canvasRef.current;
		if (!canvas) return () => {};

		const contextResult = getContext(canvas, mode, { alpha, antialias, powerPreference });
		if (!contextResult) return () => {};

		const context = contextResult.ctx;
		const maxDpr = handlers.maxDpr ?? 2;
		const adaptive = handlers.adaptive ?? true;
		const fpsTracker = new FPSTracker(30);
		let currentDpr = getTargetDpr("auto", maxDpr);
		let lastDprAdjustment = 0;
		let lastFrameTime = 0;
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
			const delta = lastFrameTime === 0 ? 16 : Math.min(250, now - lastFrameTime);
			lastFrameTime = now;
			fpsTracker.push(1000 / Math.max(delta, 1));

			if (adaptive && now - lastDprAdjustment >= 750) {
				const averageFps = fpsTracker.avg();
				const targetDpr = getTargetDpr("auto", maxDpr);
				let nextDpr = currentDpr;
				if (averageFps < 32 && currentDpr > 0.5) nextDpr = Math.max(0.5, currentDpr - 0.25);
				else if (averageFps > 56 && currentDpr < targetDpr - 0.05) nextDpr = Math.min(targetDpr, currentDpr + 0.25);
				if (Math.abs(nextDpr - currentDpr) >= 0.05) resize(nextDpr);
				lastDprAdjustment = now;
			}

			handlers.onDraw?.(context, canvas, delta, frame++);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			cleanup?.();
		};
	}, [mode, alpha, antialias, powerPreference]);

	return { canvasRef, setup };
}
