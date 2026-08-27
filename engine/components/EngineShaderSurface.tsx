"use client";

import React, { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EngineShader } from "./EngineShader";
import type { EngineShaderInput } from "../core/engineshader/EngineShaderTypes";

export interface EngineShaderSurfaceProps {
	targetId: string;
	shader: EngineShaderInput;
	priority?: boolean;
}

export const EngineShaderSurface = memo(function EngineShaderSurface({
	targetId,
	shader,
}: EngineShaderSurfaceProps) {
	const [target, setTarget] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const element = document.getElementById(targetId);
		if (!element) return;
		setTarget(element);
		const previousPosition = element.style.position;
		const previousIsolation = element.style.isolation;
		if (getComputedStyle(element).position === "static") element.style.position = "relative";
		element.style.isolation = "isolate";
		element.setAttribute("data-engine-shader-surface", "true");
		element.removeAttribute("data-engine-shader-ready");
		return () => {
			setTarget(null);
			element.style.position = previousPosition;
			element.style.isolation = previousIsolation;
			element.removeAttribute("data-engine-shader-surface");
			element.removeAttribute("data-engine-shader-ready");
		};
	}, [targetId]);

	if (!target) return null;
	const reveal = () => target.setAttribute("data-engine-shader-ready", "true");
	return createPortal(
		<EngineShader
			shader={shader}
			layer
			onReady={reveal}
			onError={reveal}
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				zIndex: -1,
				pointerEvents: "none",
				borderRadius: "inherit",
			}}
		/>,
		target,
	);
});

export default EngineShaderSurface;
