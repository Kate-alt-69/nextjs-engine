"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineCanvas
//
//  A canvas component that actually uses the GPU and doesn't lag.
//
//  What it does vs a plain <canvas>:
//
//    · Picks the right context automatically:
//        mode "2d"     → CanvasRenderingContext2D  with desynchronized:true
//                         (lets the browser present the canvas without waiting
//                          for the main-thread compositor — biggest 2D win)
//        mode "webgl2" → WebGL2RenderingContext    with powerPreference:"high-performance"
//        mode "webgl"  → WebGLRenderingContext     same
//        mode "auto"   → tries webgl2 → webgl → 2d
//
//    · Promotes the canvas to its own GPU compositor layer via CSS:
//        transform: translateZ(0) + will-change: transform
//        contain: strict  ← prevents layout/style recalcs from neighbours
//
//    · Adaptive DPR scaling — starts at window.devicePixelRatio (capped at
//      maxDpr, default 2). If the rolling-average FPS drops below 30, DPR
//      is reduced 10% per frame until FPS recovers. It ramps back up when
//      the GPU has headroom again.
//
//    · Pauses the animation loop via the Page Visibility API when the tab
//      is hidden, and via IntersectionObserver when the canvas is scrolled
//      off-screen. Resets the delta-time clock on resume so the first frame
//      after a pause doesn't have a massive dt.
//
//    · Responsive via ResizeObserver — canvas pixel dimensions stay in sync
//      with its CSS layout size at all times.
//
//    · Clean teardown — cancels RAF, disconnects observers, calls onDestroy.
//
//  Usage (2D):
//
//    <EngineCanvas
//      mode="2d"
//      responsive
//      onSetup={(ctx) => {
//        ctx.fillStyle = "red";
//        return () => { /* optional cleanup */ };
//      }}
//      onDraw={(ctx, canvas, delta) => {
//        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
//        // draw here — canvas coordinates are in CSS pixels (DPR handled)
//      }}
//    />
//
//  Usage (WebGL 3D):
//
//    <EngineCanvas
//      mode="webgl2"
//      powerPreference="high-performance"
//      antialias
//      onSetup={(gl) => {
//        // compile shaders, create buffers, etc.
//        return () => { gl.getExtension("WEBGL_lose_context")?.loseContext(); };
//      }}
//      onDraw={(gl, canvas, delta, frame) => {
//        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//        // draw here
//      }}
//    />
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	useRef,
	useEffect,
	useCallback,
	memo,
	type CSSProperties,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "2d" | "webgl" | "webgl2" | "auto";

type Ctx2D  = CanvasRenderingContext2D;
type CtxGL  = WebGLRenderingContext;
type CtxGL2 = WebGL2RenderingContext;
type AnyCtx = Ctx2D | CtxGL | CtxGL2;

export interface EngineCanvasProps {
	/**
	 * Rendering context to use.
	 * "auto" tries webgl2 → webgl → 2d and picks the best available.
	 * Default: "auto"
	 */
	mode?: Mode;

	// ── Canvas dimensions ──────────────────────────────────────────────────
	/** Fixed pixel width — omit for responsive mode */
	width?: number;
	/** Fixed pixel height — omit for responsive mode */
	height?: number;
	/**
	 * When true, the canvas fills its CSS container and ResizeObserver keeps
	 * pixel dimensions in sync. Default: true when width/height are omitted.
	 */
	responsive?: boolean;

	// ── Performance ───────────────────────────────────────────────────────
	/**
	 * Device pixel ratio. "auto" = window.devicePixelRatio (capped at maxDpr).
	 * Default: "auto"
	 */
	dpr?: number | "auto";
	/** Cap on the device pixel ratio. Default: 2 */
	maxDpr?: number;
	/**
	 * Adaptive DPR — automatically reduce pixel density if FPS drops below
	 * 30 fps and restore it when performance recovers. Default: true
	 */
	adaptive?: boolean;
	/**
	 * Pause the animation loop when the canvas is not in the viewport.
	 * Default: true
	 */
	pauseWhenOffscreen?: boolean;
	/**
	 * Pause the animation loop when the browser tab is hidden (Page Visibility).
	 * Default: true
	 */
	pauseWhenHidden?: boolean;

	// ── Context options ────────────────────────────────────────────────────
	/**
	 * Transparent canvas background. Setting to false (default) allows
	 * the browser to skip alpha compositing — a small but free GPU win.
	 * Default: false
	 */
	alpha?: boolean;
	/**
	 * WebGL multi-sample anti-aliasing.
	 * Expensive on mobile — disable for particle systems / volumetrics.
	 * Default: true for webgl/webgl2, ignored for 2d.
	 */
	antialias?: boolean;
	/**
	 * WebGL power preference hint sent to the OS GPU scheduler.
	 * "high-performance" — request the discrete GPU on dual-GPU systems.
	 * Default: "high-performance"
	 */
	powerPreference?: "default" | "high-performance" | "low-power";

	// ── Callbacks ─────────────────────────────────────────────────────────
	/**
	 * Called once after the canvas and context are created.
	 * Use for shader compilation, buffer setup, loading assets, etc.
	 * Return a cleanup function that will be called on unmount.
	 */
	onSetup?: (ctx: AnyCtx, canvas: HTMLCanvasElement) => (() => void) | void;
	/**
	 * Called every animation frame.
	 * @param ctx    Rendering context
	 * @param canvas The canvas element
	 * @param delta  Milliseconds since the last frame (frame-rate independent)
	 * @param frame  Cumulative frame counter (starts at 0)
	 */
	onDraw?: (ctx: AnyCtx, canvas: HTMLCanvasElement, delta: number, frame: number) => void;
	/**
	 * Called when the canvas resizes (only fires in responsive mode).
	 * @param ctx    Rendering context
	 * @param canvas The canvas element
	 * @param w      New CSS width in pixels
	 * @param h      New CSS height in pixels
	 */
	onResize?: (ctx: AnyCtx, canvas: HTMLCanvasElement, w: number, h: number) => void;

	// ── Layout ────────────────────────────────────────────────────────────
	style?:     CSSProperties;
	className?: string;
}

// ── FPS tracker ───────────────────────────────────────────────────────────────

class FPSTracker {
	private _window: number[];
	private _idx = 0;
	constructor(private size = 30) {
		this._window = Array(size).fill(60);
	}
	push(fps: number): void {
		this._window[this._idx++ % this.size] = fps;
	}
	avg(): number {
		return this._window.reduce((a, b) => a + b, 0) / this.size;
	}
}

// ── Context factory ───────────────────────────────────────────────────────────

function getContext(
	canvas: HTMLCanvasElement,
	mode: Mode,
	opts: { alpha: boolean; antialias: boolean; powerPreference: string },
): { ctx: AnyCtx; resolvedMode: "2d" | "webgl" | "webgl2" } | null {

	const gl2Opts = {
		alpha:          opts.alpha,
		antialias:      opts.antialias,
		powerPreference: opts.powerPreference,
		preserveDrawingBuffer: false,
		failIfMajorPerformanceCaveat: false,
	};

	if (mode === "2d") {
		const ctx = canvas.getContext("2d", {
			alpha:          opts.alpha,
			// desynchronized: true → browser can present without waiting for the
			// main-thread compositor. Biggest perf win for 2D canvas.
			desynchronized: true,
		}) as Ctx2D | null;
		if (!ctx) return null;
		return { ctx, resolvedMode: "2d" };
	}

	if (mode === "webgl2" || mode === "auto") {
		const ctx = canvas.getContext("webgl2", gl2Opts) as CtxGL2 | null;
		if (ctx) return { ctx, resolvedMode: "webgl2" };
		if (mode === "webgl2") return null; // explicit request, don't fall back
	}

	if (mode === "webgl" || mode === "auto") {
		const ctx = canvas.getContext("webgl", gl2Opts) as CtxGL | null;
		if (ctx) return { ctx, resolvedMode: "webgl" };
		if (mode === "webgl") return null;
	}

	// Final fallback for "auto"
	const ctx = canvas.getContext("2d", { alpha: opts.alpha, desynchronized: true }) as Ctx2D | null;
	if (!ctx) return null;
	return { ctx, resolvedMode: "2d" };
}

// ── Main component ────────────────────────────────────────────────────────────

export const EngineCanvas = memo(function EngineCanvas({
	mode             = "auto",
	width,
	height,
	responsive,
	dpr:             dprProp   = "auto",
	maxDpr           = 2,
	adaptive         = true,
	pauseWhenOffscreen = true,
	pauseWhenHidden  = true,
	alpha            = false,
	antialias        = true,
	powerPreference  = "high-performance",
	onSetup,
	onDraw,
	onResize,
	style,
	className,
}: EngineCanvasProps) {
	const canvasRef   = useRef<HTMLCanvasElement>(null);
	const ctxRef      = useRef<AnyCtx | null>(null);
	const rafRef      = useRef<number>(0);
	const frameRef    = useRef(0);
	const lastTimeRef = useRef(0);
	const dprRef      = useRef(1);
	const pausedRef   = useRef(false);
	const fpsTracker  = useRef(new FPSTracker(30));

	// Whether to use responsive layout
	const isResponsive = responsive ?? (width === undefined && height === undefined);

	// ── Scale canvas to DPR ───────────────────────────────────────────────────
	const applyDPR = useCallback((canvas: HTMLCanvasElement, cssW: number, cssH: number) => {
		const rawDpr  = dprProp === "auto" ? (window.devicePixelRatio || 1) : dprProp;
		const capped  = Math.min(rawDpr, maxDpr);
		dprRef.current = capped;

		canvas.width  = Math.round(cssW * capped);
		canvas.height = Math.round(cssH * capped);
		canvas.style.width  = `${cssW}px`;
		canvas.style.height = `${cssH}px`;

		// Scale 2D context so coordinates stay in CSS pixel space
		if (ctxRef.current instanceof CanvasRenderingContext2D) {
			ctxRef.current.scale(capped, capped);
		}
	}, [dprProp, maxDpr]);

	// ── Animation loop ────────────────────────────────────────────────────────
	const startLoop = useCallback(() => {
		if (!ctxRef.current || !canvasRef.current) return;
		const canvas = canvasRef.current;
		const ctx    = ctxRef.current;

		const tick = (now: number) => {
			if (pausedRef.current) return;

			const delta = lastTimeRef.current === 0 ? 16 : now - lastTimeRef.current;
			lastTimeRef.current = now;

			// FPS tracking + adaptive DPR
			const fps = 1000 / Math.max(delta, 1);
			fpsTracker.current.push(fps);
			const avgFps = fpsTracker.current.avg();

			if (adaptive) {
				if (avgFps < 30 && dprRef.current > 0.5) {
					// Performance struggling — reduce resolution
					const newDpr = Math.max(0.5, dprRef.current * 0.92);
					if (Math.abs(newDpr - dprRef.current) > 0.01) {
						const cssW = parseInt(canvas.style.width, 10)  || canvas.offsetWidth;
						const cssH = parseInt(canvas.style.height, 10) || canvas.offsetHeight;
						dprRef.current = newDpr;
						canvas.width   = Math.round(cssW * newDpr);
						canvas.height  = Math.round(cssH * newDpr);
						if (ctx instanceof CanvasRenderingContext2D) {
							ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);
						}
					}
				} else if (avgFps > 55) {
					// GPU has headroom — restore resolution toward target
					const rawDpr  = dprProp === "auto" ? (window.devicePixelRatio || 1) : dprProp;
					const target  = Math.min(rawDpr, maxDpr);
					if (dprRef.current < target - 0.01) {
						const newDpr = Math.min(target, dprRef.current * 1.04);
						const cssW   = parseInt(canvas.style.width, 10)  || canvas.offsetWidth;
						const cssH   = parseInt(canvas.style.height, 10) || canvas.offsetHeight;
						dprRef.current = newDpr;
						canvas.width   = Math.round(cssW * newDpr);
						canvas.height  = Math.round(cssH * newDpr);
						if (ctx instanceof CanvasRenderingContext2D) {
							ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);
						}
					}
				}
			}

			onDraw?.(ctx, canvas, delta, frameRef.current++);
			rafRef.current = requestAnimationFrame(tick);
		};

		lastTimeRef.current = 0;
		rafRef.current = requestAnimationFrame(tick);
	}, [onDraw, adaptive, dprProp, maxDpr]);

	const stopLoop = useCallback(() => {
		cancelAnimationFrame(rafRef.current);
	}, []);

	const pauseLoop = useCallback(() => {
		pausedRef.current = true;
		stopLoop();
	}, [stopLoop]);

	const resumeLoop = useCallback(() => {
		if (!pausedRef.current) return;
		pausedRef.current  = false;
		lastTimeRef.current = 0; // reset delta — prevents huge dt on resume
		startLoop();
	}, [startLoop]);

	// ── SSR / pre-mount — must be declared before setup effect ─────────────
	const [canvasMounted, setCanvasMounted] = React.useState(false);
	React.useEffect(() => { setCanvasMounted(true); }, []);

	// ── Main setup effect ─────────────────────────────────────────────────────
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		// Initialise context
		const result = getContext(canvas, mode, { alpha, antialias, powerPreference });
		if (!result) {
			console.warn("[EngineCanvas] Could not obtain a rendering context.");
			return;
		}
		ctxRef.current = result.ctx;

		// Initial size
		const cssW = width  ?? canvas.offsetWidth  ?? 300;
		const cssH = height ?? canvas.offsetHeight ?? 150;
		applyDPR(canvas, cssW, cssH);

		// User setup
		const cleanup = onSetup?.(result.ctx, canvas);

		// Start the loop
		startLoop();

		// ── ResizeObserver ─────────────────────────────────────────────────────
		let resizeObserver: ResizeObserver | undefined;
		if (isResponsive && typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (!entry || !ctxRef.current) return;
				const { width: rw, height: rh } = entry.contentRect;
				applyDPR(canvas, rw, rh);
				onResize?.(ctxRef.current, canvas, rw, rh);
			});
			resizeObserver.observe(canvas);
		}

		// ── IntersectionObserver — pause when off-screen ───────────────────────
		let intersectionObserver: IntersectionObserver | undefined;
		if (pauseWhenOffscreen && typeof IntersectionObserver !== "undefined") {
			intersectionObserver = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting) resumeLoop();
				else                      pauseLoop();
			}, { rootMargin: "200px 0px" }); // start slightly before entering view
			intersectionObserver.observe(canvas);
		}

		// ── Page Visibility API — pause when tab hidden ────────────────────────
		const onVisibility = pauseWhenHidden
			? () => { document.hidden ? pauseLoop() : resumeLoop(); }
			: undefined;
		if (onVisibility) document.addEventListener("visibilitychange", onVisibility);

		// ── Cleanup ────────────────────────────────────────────────────────────
		return () => {
			stopLoop();
			cleanup?.();
			resizeObserver?.disconnect();
			intersectionObserver?.disconnect();
			if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
			ctxRef.current = null;
		};
	// onDraw/onSetup/onResize intentionally excluded — callers should use useCallback
	// canvasMounted IS included — setup must re-run once the <canvas> is in the DOM
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, alpha, antialias, powerPreference, width, height, isResponsive, canvasMounted]);


	if (!canvasMounted) {
		const placeholderW = width  !== undefined ? `${width}px`  : "100%";
		const placeholderH = height !== undefined ? `${height}px` : "150px";
		return (
			<div
				aria-hidden="true"
				className={className}
				style={{
					width:       placeholderW,
					height:      placeholderH,
					background:  "var(--e-canvas-placeholder, transparent)",
					borderRadius: style?.borderRadius,
					// Contain sizing — prevents parent reflow
					contain: "strict",
					...style,
				}}
			/>
		);
	}

	const canvasStyle: CSSProperties = {
		// GPU layer promotion
		transform:   "translateZ(0)",
		willChange:  "transform",
		// Isolate from surrounding layout — prevents the canvas from causing
		// expensive reflows in sibling elements during animation
		contain:     "strict",
		display:     "block",
		// Size
		...(isResponsive ? { width: "100%", height: "100%" } : {}),
		...(width  !== undefined ? { width:  `${width}px`  } : {}),
		...(height !== undefined ? { height: `${height}px` } : {}),
		...style,
	};

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={canvasStyle}
		/>
	);
});

// ── useEngineCanvas hook — low-level API ──────────────────────────────────────

/**
 * Lower-level hook for when you need direct access to the canvas context
 * outside of a component tree (e.g. integrating with Three.js or Babylon.js).
 *
 * Returns a ref to attach to your <canvas> and a setup function to call
 * after the canvas mounts.
 *
 * @example
 * const { canvasRef, setup } = useEngineCanvas({ mode: "webgl2" });
 * useEffect(() => {
 *   return setup({
 *     onDraw: (gl, canvas, delta) => { ... }
 *   });
 * }, []);
 * return <canvas ref={canvasRef} style={{ width: "100%", height: 400 }} />;
 */
export function useEngineCanvas(options: Pick<EngineCanvasProps, "mode" | "alpha" | "antialias" | "powerPreference"> = {}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const setup = useCallback((
		handlers: Pick<EngineCanvasProps, "onSetup" | "onDraw" | "onResize" | "adaptive" | "maxDpr">
	): (() => void) => {
		const canvas = canvasRef.current;
		if (!canvas) return () => {};

		const mode            = options.mode ?? "auto";
		const alpha           = options.alpha ?? false;
		const antialias       = options.antialias ?? true;
		const powerPreference = options.powerPreference ?? "high-performance";
		const maxDpr          = handlers.maxDpr ?? 2;
		const adaptive        = handlers.adaptive ?? true;

		const result = getContext(canvas, mode, { alpha, antialias, powerPreference });
		if (!result) return () => {};

		const ctx = result.ctx;
		const fps = new FPSTracker();
		let raf   = 0;
		let last  = 0;
		let frame = 0;
		const rawDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
		canvas.width  = canvas.offsetWidth  * rawDpr;
		canvas.height = canvas.offsetHeight * rawDpr;
		if (ctx instanceof CanvasRenderingContext2D) ctx.scale(rawDpr, rawDpr);

		const cleanup = handlers.onSetup?.(ctx, canvas);

		const tick = (now: number) => {
			const delta = last === 0 ? 16 : now - last;
			last = now;
			fps.push(1000 / Math.max(delta, 1));
			handlers.onDraw?.(ctx, canvas, delta, frame++);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			cleanup?.();
		};
	}, [options]);

	return { canvasRef, setup };
}
