"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EngineCanvas compatibility + EngineShader facade
//
// Generation 3 keeps visual resolution stable by default. The legacy adaptive
// DPR path remains available only when a developer explicitly opts into it.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useCallback, useEffect, type CSSProperties } from "react";
import {
	EngineCanvas as CoreEngineCanvas,
	useEngineCanvas as useCoreEngineCanvas,
	type EngineCanvasProps as CoreEngineCanvasProps,
} from "../core/enginecanvas/EngineCanvas";
import { EngineScheduler } from "../core/enginescheduler";
import { EngineShader } from "./EngineShader";
import type { EngineShaderInput } from "../core/engineshader/EngineShaderTypes";

export interface EngineCanvasProps extends CoreEngineCanvasProps {
	/** Use a compiled `data/shader/public/*.shed` program as the canvas renderer. */
	shader?: EngineShaderInput;
}

function resolveShaderMaxDpr(
	dpr: number | "auto",
	maxDpr: number,
): number {
	if (dpr === "auto") return maxDpr;
	return Math.min(maxDpr, Math.max(0.5, dpr));
}

export const EngineCanvas = memo(function EngineCanvas({
	shader,
	adaptive: adaptiveProp,
	...props
}: EngineCanvasProps) {
	const adaptive = adaptiveProp ?? false;

	useEffect(() => EngineScheduler.acquireFrameMonitor(), []);

	if (!shader) return <CoreEngineCanvas {...props} adaptive={adaptive} />;

	const {
		width,
		height,
		responsive,
		dpr = "auto",
		maxDpr = 2,
		pauseWhenOffscreen = true,
		pauseWhenHidden = true,
		powerPreference = "high-performance",
		className,
		style,
	} = props;
	const isResponsive = responsive ?? (width === undefined && height === undefined);
	const shaderStyle: CSSProperties = {
		transform: "translateZ(0)",
		contain: "strict",
		display: "block",
		...(isResponsive ? { width: "100%", height: "100%", minHeight: "150px" } : {}),
		...(width !== undefined ? { width: `${width}px` } : {}),
		...(height !== undefined ? { height: `${height}px` } : {}),
		...style,
	};

	return (
		<EngineShader
			shader={shader}
			className={className}
			style={shaderStyle}
			maxDpr={resolveShaderMaxDpr(dpr, maxDpr)}
			adaptive={adaptive}
			pauseWhenOffscreen={pauseWhenOffscreen}
			pauseWhenHidden={pauseWhenHidden}
			powerPreference={powerPreference}
		/>
	);
});

/**
 * Generation 3 low-level Canvas hook.
 *
 * The v2 core hook keeps its historical adaptive-DPR default for compatibility.
 * The public Gen 3 facade changes only the default: resolution stays stable unless
 * the caller explicitly passes `adaptive: true` to setup().
 */
export function useEngineCanvas(
	options: Parameters<typeof useCoreEngineCanvas>[0] = {},
) {
	const runtime = useCoreEngineCanvas(options);
	const setup = useCallback((handlers: Parameters<typeof runtime.setup>[0]) => {
		const releaseFrameMonitor = EngineScheduler.acquireFrameMonitor();
		const cleanup = runtime.setup({
			...handlers,
			adaptive: handlers.adaptive ?? false,
		});
		return () => {
			cleanup();
			releaseFrameMonitor();
		};
	}, [runtime.setup]);

	return {
		canvasRef: runtime.canvasRef,
		setup,
	};
}

export type { EngineCanvasFrameInfo } from "../core/enginecanvas/EngineCanvas";
