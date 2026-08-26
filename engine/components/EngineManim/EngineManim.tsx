"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineManim
//
//  Declarative Manim-style 2D animation. Geometry compilation and Transform
//  point-count normalisation happen outside the RAF hot path.
// ─────────────────────────────────────────────────────────────────────────────

import dynamic from "next/dynamic";
import { memo, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { ManimConfig } from "./manimTypes";
import {
	compileManimConfig,
	applyEasing,
	equalisePoints,
	interpolatePoints,
	drawPoints,
} from "./manimCompiler";

const EngineCanvas = dynamic(
	() => import("../EngineCanvas").then((module) => module.EngineCanvas),
	{ ssr: false },
);

export interface EngineManimProps {
	cprop: { manim: ManimConfig };
	width?: number;
	height?: number;
	className?: string;
	style?: CSSProperties;
}

interface ManimRuntime {
	stepIndex: number;
	stepStart: number;
	delayEnd: number;
	interpBuffer: Float32Array;
	loopCount: number;
}

type TransformPair = {
	from: Float32Array;
	to: Float32Array;
};

export const EngineManim = memo(function EngineManim({
	cprop,
	width,
	height,
	className,
	style,
}: EngineManimProps) {
	const compiled = compileManimConfig(cprop.manim);
	const compiledRef = useRef(compiled);
	compiledRef.current = compiled;

	const prepared = useMemo(() => {
		const transformPairs = new Map<number, TransformPair>();
		let maxPointBufferLength = 4;

		for (let index = 0; index < compiled.steps.length; index++) {
			const step = compiled.steps[index];
			maxPointBufferLength = Math.max(
				maxPointBufferLength,
				step.target?.points.length ?? 0,
				step.origin?.points.length ?? 0,
			);

			if (step.action !== "Transform" || !step.origin || !step.target) continue;
			const [from, to] = equalisePoints(step.origin.points, step.target.points);
			transformPairs.set(index, { from, to });
			maxPointBufferLength = Math.max(maxPointBufferLength, from.length, to.length);
		}

		return { transformPairs, maxPointBufferLength };
	}, [compiled]);

	const runtime = useRef<ManimRuntime>({
		stepIndex: 0,
		stepStart: 0,
		delayEnd: 0,
		interpBuffer: new Float32Array(prepared.maxPointBufferLength),
		loopCount: 0,
	});

	// Config changes can increase the required transform buffer, but resizing is
	// done during React render rather than from inside the animation callback.
	if (runtime.current.interpBuffer.length < prepared.maxPointBufferLength) {
		runtime.current.interpBuffer = new Float32Array(prepared.maxPointBufferLength);
	}

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
			onSetup={(ctx, canvas) => {
				const background = compiledRef.current.settings.background;
				if (background && background !== "transparent") {
					const context = ctx as CanvasRenderingContext2D;
					context.fillStyle = background;
					context.fillRect(0, 0, canvas.width, canvas.height);
				}
				const now = performance.now();
				runtime.current.stepStart = now;
				runtime.current.delayEnd = now + (compiledRef.current.steps[0]?.delay ?? 0);
			}}
			onDraw={(ctx, canvas) => {
				const currentRuntime = runtime.current;
				const currentTimeline = compiledRef.current;
				const step = currentTimeline.steps[currentRuntime.stepIndex];
				if (!step) return;

				const now = performance.now();
				if (now < currentRuntime.delayEnd) return;

				const elapsed = now - currentRuntime.stepStart;
				const rawProgress = Math.min(elapsed / step.durationMs, 1);
				const progress = applyEasing(rawProgress, step.easing);
				const context = ctx as CanvasRenderingContext2D;

				context.clearRect(0, 0, canvas.width, canvas.height);
				const background = currentTimeline.settings.background;
				if (background && background !== "transparent") {
					context.fillStyle = background;
					context.fillRect(0, 0, canvas.width, canvas.height);
				}

				switch (step.action) {
					case "Create": {
						if (!step.target) break;
						const drawCount = Math.max(2, Math.floor(step.target.pointCount * progress));
						drawPoints(
							context,
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

					case "FadeIn":
						if (step.target) {
							drawPoints(
								context, step.target.points, step.target.pointCount,
								step.target.isBezier, progress,
								step.target.strokeColor, step.target.fillColor, step.target.strokeWidth,
							);
						}
						break;

					case "FadeOut":
						if (step.target) {
							drawPoints(
								context, step.target.points, step.target.pointCount,
								step.target.isBezier, 1 - progress,
								step.target.strokeColor, step.target.fillColor, step.target.strokeWidth,
							);
						}
						break;

					case "Transform": {
						if (!step.origin || !step.target) break;
						const pair = prepared.transformPairs.get(currentRuntime.stepIndex);
						if (!pair) break;
						interpolatePoints(pair.from, pair.to, progress, currentRuntime.interpBuffer);
						drawPoints(
							context,
							currentRuntime.interpBuffer,
							pair.from.length / 2,
							step.origin.isBezier,
							1,
							step.target.strokeColor,
							step.target.fillColor,
							step.target.strokeWidth,
						);
						break;
					}

					case "Wait":
						break;
				}

				if (rawProgress >= 1) {
					currentRuntime.stepIndex++;
					if (currentRuntime.stepIndex >= currentTimeline.steps.length) {
						if (currentTimeline.settings.loop) {
							currentRuntime.stepIndex = 0;
							currentRuntime.loopCount++;
						} else {
							currentRuntime.stepIndex = Math.max(0, currentTimeline.steps.length - 1);
							return;
						}
					}

					const nextStep = currentTimeline.steps[currentRuntime.stepIndex];
					currentRuntime.stepStart = now;
					currentRuntime.delayEnd = now + (nextStep?.delay ?? 0);
				}
			}}
		/>
	);
});
