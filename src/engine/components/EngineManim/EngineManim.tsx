"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim  (2D Phase 1)
//
//  Declarative Manim-style 2D animation. Reads cprop.manim, compiles shapes
//  into Float32Array pools once, then drives EngineCanvas's RAF loop with
//  zero heap allocation per frame.
//
//  Schema type: "manim"
// ─────────────────────────────────────────────────────────────────────────────

import dynamic            from "next/dynamic";
import { useRef, memo }   from "react";
import type { CSSProperties } from "react";
import type { ManimConfig }   from "./manimTypes";
import {
	compileManimConfig,
	applyEasing,
	equalisePoints,
	interpolatePoints,
	drawPoints,
} from "./manimCompiler";

// Lazy-load EngineCanvas — keeps manim math out of the main bundle
const EngineCanvas = dynamic(
	() => import("../EngineCanvas").then((m) => m.EngineCanvas),
	{ ssr: false },
);

// ─────────────────────────────────────────────────────────────────────────────
//  Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineManimProps {
	cprop: { manim: ManimConfig };
	width?:     number;
	height?:    number;
	className?: string;
	style?:     CSSProperties;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Runtime state (all refs — zero React re-renders during animation)
// ─────────────────────────────────────────────────────────────────────────────

interface ManimRuntime {
	stepIndex:    number;
	stepStart:    number;      // performance.now() when step began
	delayEnd:     number;      // performance.now() when delay expires
	alpha:        number;      // current fade value 0–1
	interpBuffer: Float32Array; // pre-allocated interpolation output
	loopCount:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export const EngineManim = memo(function EngineManim({
	cprop,
	width,
	height,
	className,
	style,
}: EngineManimProps) {
	// Compile once — WeakMap cache in manimCompiler prevents re-work
	const compiled  = compileManimConfig(cprop.manim);
	const compiledRef = useRef(compiled);
	compiledRef.current = compiled;

	// Pre-allocate the interp buffer at max possible point size
	const maxPoints = Math.max(
		...compiled.steps
			.map((s) => Math.max(s.target?.points.length ?? 0, s.origin?.points.length ?? 0)),
		4,
	);

	const runtime = useRef<ManimRuntime>({
		stepIndex:    0,
		stepStart:    0,
		delayEnd:     0,
		alpha:        0,
		interpBuffer: new Float32Array(maxPoints),
		loopCount:    0,
	});

	return (
		<EngineCanvas
			mode="2d"
			width={width}
			height={height}
			responsive={!width && !height}
			adaptive
			pauseWhenOffscreen
			className={className}
			style={style}
			onSetup={(ctx) => {
				const bg = compiledRef.current.settings.background;
				if (bg !== "transparent") {
					(ctx as CanvasRenderingContext2D).fillStyle = bg;
				}
				runtime.current.stepStart = performance.now();
				runtime.current.delayEnd  = performance.now()
					+ (compiledRef.current.steps[0]?.delay ?? 0);
			}}
			onDraw={(ctx, canvas, _delta, frameTime) => {
				const rt       = runtime.current;
				const c        = compiledRef.current;
				const step     = c.steps[rt.stepIndex];
				if (!step) return;

				const now = frameTime;

				// Delay not expired yet — hold
				if (now < rt.delayEnd) return;

				const elapsed  = now - rt.stepStart;
				const rawT     = Math.min(elapsed / step.durationMs, 1);
				const t        = applyEasing(rawT, step.easing);
				const ctx2d    = ctx as CanvasRenderingContext2D;

				ctx2d.clearRect(0, 0, canvas.width, canvas.height);

				switch (step.action) {
					case "Create": {
						if (!step.target) break;
						// Draw-on: reveal progressively by drawing first (t*pointCount) points
						const drawCount = Math.max(2, Math.floor(step.target.pointCount * t));
						drawPoints(
							ctx2d,
							step.target.points,
							drawCount,
							step.target.isBezier,
							1,
							step.target.strokeColor,
							step.target.fillColor,
							step.target.strokeWidth,
						);
						break;
					}

					case "FadeIn": {
						if (!step.target) break;
						drawPoints(
							ctx2d, step.target.points, step.target.pointCount,
							step.target.isBezier, t,
							step.target.strokeColor, step.target.fillColor, step.target.strokeWidth,
						);
						break;
					}

					case "FadeOut": {
						if (!step.target) break;
						drawPoints(
							ctx2d, step.target.points, step.target.pointCount,
							step.target.isBezier, 1 - t,
							step.target.strokeColor, step.target.fillColor, step.target.strokeWidth,
						);
						break;
					}

					case "Transform": {
						if (!step.origin || !step.target) break;
						// Normalise both shapes to the same point count
						const [fromPts, toPts] = equalisePoints(
							step.origin.points,
							step.target.points,
						);
						// Ensure interp buffer is large enough
						if (rt.interpBuffer.length < fromPts.length) {
							rt.interpBuffer = new Float32Array(fromPts.length);
						}
						interpolatePoints(fromPts, toPts, t, rt.interpBuffer);
						drawPoints(
							ctx2d,
							rt.interpBuffer,
							fromPts.length / 2,
							step.origin.isBezier,
							1,
							step.target.strokeColor,
							step.target.fillColor,
							step.target.strokeWidth,
						);
						break;
					}

					case "Wait":
						// Keep previous frame visible — nothing to draw
						break;
				}

				// ── Advance to next step when complete ──────────────────────────
				if (rawT >= 1) {
					rt.stepIndex++;

					if (rt.stepIndex >= c.steps.length) {
						if (c.settings.loop) {
							rt.stepIndex  = 0;
							rt.loopCount++;
						} else {
							rt.stepIndex  = c.steps.length - 1; // hold last frame
							return;
						}
					}

					const nextStep    = c.steps[rt.stepIndex];
					rt.stepStart      = now;
					rt.delayEnd       = now + (nextStep.delay ?? 0);
				}
			}}
		/>
	);
});
