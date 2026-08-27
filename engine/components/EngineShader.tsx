"use client";

import React, { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { EngineScroll } from "../core/enginescroll";
import {
	EngineShaderScheduler,
	loadEngineShader,
	normalizeEngineShaderName,
	subscribeEngineShaderHotReload,
} from "../core/engineshader/EngineShaderRuntime";
import type {
	EngineShaderConfig,
	EngineShaderInput,
	EngineShaderRenderPlan,
	EngineShaderVariableDefinition,
	EngineShaderVariableValue,
} from "../core/engineshader/EngineShaderTypes";

export interface EngineShaderProps extends Omit<Partial<EngineShaderConfig>, "src"> {
	shader?: EngineShaderInput;
	src?: string;
	layer?: boolean;
	onReady?: () => void;
	onError?: (reason: unknown) => void;
}

type GLContext = WebGLRenderingContext;

function normalizeConfig(props: EngineShaderProps): EngineShaderConfig | null {
	const nested: Partial<EngineShaderConfig> = typeof props.shader === "string"
		? { src: props.shader }
		: (props.shader ?? {});
	const src = props.src ?? nested.src;
	if (!src) return null;
	const direct = props as Partial<EngineShaderConfig>;
	return {
		...nested,
		...direct,
		src: normalizeEngineShaderName(src),
		variables: { ...(nested.variables ?? {}), ...(props.variables ?? {}) },
	};
}

function createShader(gl: GLContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("[EngineShader] Failed to create WebGL shader object.");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) || "Unknown shader compiler error.";
		gl.deleteShader(shader);
		throw new Error(`[EngineShader] GPU shader compilation failed:\n${log}`);
	}
	return shader;
}

function createProgram(gl: GLContext, plan: EngineShaderRenderPlan): WebGLProgram {
	const vertex = createShader(gl, gl.VERTEX_SHADER, plan.vertex);
	const fragment = createShader(gl, gl.FRAGMENT_SHADER, plan.fragment);
	const program = gl.createProgram();
	if (!program) {
		gl.deleteShader(vertex);
		gl.deleteShader(fragment);
		throw new Error("[EngineShader] Failed to create WebGL program.");
	}
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) || "Unknown shader linker error.";
		gl.deleteProgram(program);
		throw new Error(`[EngineShader] GPU shader link failed:\n${log}`);
	}
	return program;
}

function parseColor(value: string): number[] | null {
	const normalized = value.trim().replace(/^#/, "");
	if (![3, 4, 6, 8].includes(normalized.length) || !/^[0-9a-f]+$/i.test(normalized)) return null;
	const expanded = normalized.length <= 4
		? normalized.split("").map((character) => `${character}${character}`).join("")
		: normalized;
	return [
		parseInt(expanded.slice(0, 2), 16) / 255,
		parseInt(expanded.slice(2, 4), 16) / 255,
		parseInt(expanded.slice(4, 6), 16) / 255,
		expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
	];
}

function numericValues(value: EngineShaderVariableValue): number[] {
	if (Array.isArray(value)) return value.map(Number);
	if (typeof value === "number") return [value];
	if (typeof value === "boolean") return [value ? 1 : 0];
	if (typeof value === "string") return parseColor(value) ?? [Number(value) || 0];
	return [0];
}

function uploadVariable(
	gl: GLContext,
	location: WebGLUniformLocation | null,
	definition: EngineShaderVariableDefinition,
	value: EngineShaderVariableValue,
): void {
	if (!location) return;
	const values = numericValues(value);
	switch (definition.type) {
		case "bool":
		case "float":
			gl.uniform1f(location, values[0] ?? 0);
			break;
		case "vec2":
			gl.uniform2f(location, values[0] ?? 0, values[1] ?? 0);
			break;
		case "vec3":
			gl.uniform3f(location, values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
			break;
		case "vec4":
		case "color":
			gl.uniform4f(location, values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1);
			break;
	}
}

function variableSignature(value: EngineShaderVariableValue): string {
	return Array.isArray(value) ? value.join(",") : String(value);
}

function boundedFps(value: number | undefined, layer: boolean): number {
	const fallback = layer ? 30 : 60;
	if (!Number.isFinite(value)) return fallback;
	return Math.max(1, Math.min(120, Number(value)));
}

function desiredDpr(maxDpr: number, resolutionScale: number): number {
	const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
	return Math.max(0.125, Math.min(deviceDpr, maxDpr) * resolutionScale);
}

export const EngineShader = memo(function EngineShader(props: EngineShaderProps) {
	const config = normalizeConfig(props);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const variablesRef = useRef<Record<string, EngineShaderVariableValue>>(config?.variables ?? {});
	const requestDrawRef = useRef<() => void>(() => {});
	const readyRef = useRef(false);
	const [plan, setPlan] = useState<EngineShaderRenderPlan | null>(null);
	const [contextVersion, setContextVersion] = useState(0);
	variablesRef.current = config?.variables ?? {};

	useEffect(() => {
		if (!config) return;
		let alive = true;
		const load = async (forceManifest = false) => {
			try {
				const result = await loadEngineShader(config.src, { forceManifest });
				if (alive) setPlan(result.plan);
			} catch (reason) {
				if (!alive) return;
				props.onError?.(reason);
				if (process.env.NODE_ENV !== "production") console.error(reason);
			}
		};
		void load(false);
		const unsubscribe = subscribeEngineShaderHotReload(config.src, () => void load(true));
		return () => {
			alive = false;
			unsubscribe();
		};
	}, [config?.src, props.onError]);

	useEffect(() => {
		requestDrawRef.current();
	}, [props.variables, props.shader]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !config || !plan) return;
		const gl = canvas.getContext("webgl", {
			alpha: true,
			antialias: false,
			depth: false,
			stencil: false,
			preserveDrawingBuffer: false,
			powerPreference: config.powerPreference ?? (props.layer ? "low-power" : "high-performance"),
		}) as GLContext | null;
		if (!gl) {
			props.onError?.(new Error("[EngineShader] WebGL is unavailable in this browser/device."));
			return;
		}

		let program: WebGLProgram;
		try {
			program = createProgram(gl, plan);
		} catch (reason) {
			props.onError?.(reason);
			if (process.env.NODE_ENV !== "production") console.error(reason);
			return;
		}

		const positionBuffer = gl.createBuffer();
		if (!positionBuffer) {
			gl.deleteProgram(program);
			props.onError?.(new Error("[EngineShader] Failed to allocate fullscreen triangle."));
			return;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const position = gl.getAttribLocation(program, "a_position");
		if (position < 0) {
			gl.deleteBuffer(positionBuffer);
			gl.deleteProgram(program);
			props.onError?.(new Error("[EngineShader] Compiled plan is missing a_position."));
			return;
		}
		gl.useProgram(program);
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

		const builtins = {
			resolution: gl.getUniformLocation(program, "e_resolution"),
			time: gl.getUniformLocation(program, "e_time"),
			delta: gl.getUniformLocation(program, "e_delta"),
			frame: gl.getUniformLocation(program, "e_frame"),
			pointer: gl.getUniformLocation(program, "e_pointer"),
			scroll: gl.getUniformLocation(program, "e_scroll"),
		};
		const variableStates = new Map(plan.variables.map((definition) => [definition.name, {
			definition,
			location: gl.getUniformLocation(program, `u_var_${definition.name}`),
			signature: "",
		}]));

		const dependencySet = new Set(plan.dependencies);
		const layer = props.layer === true;
		const targetFps = boundedFps(config.fps, layer);
		const frameInterval = 1000 / targetFps;
		const maxDpr = Math.max(0.5, config.maxDpr ?? (layer ? 1.5 : 2));
		const resolutionScale = Math.max(0.125, Math.min(2, plan.render.resolution || 1));
		const reducedMotion = (config.respectReducedMotion ?? true)
			&& window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
		const host = props.layer ? canvas.parentElement ?? canvas : canvas;
		let currentDpr = desiredDpr(maxDpr, resolutionScale);
		let cssWidth = Math.max(1, host.clientWidth || canvas.clientWidth || 1);
		let cssHeight = Math.max(1, host.clientHeight || canvas.clientHeight || 1);
		let lastTimestamp = 0;
		let lastDrawTimestamp = 0;
		let frameNumber = 0;
		let pointerX = 0.5;
		let pointerY = 0.5;
		let scrollProgress = 0;
		let offscreen = false;
		let disposed = false;
		let eventFrame = 0;
		let adaptiveWindowStart = performance.now();
		let adaptiveSamples = 0;
		let adaptiveTotal = 0;

		const resizeBackingStore = () => {
			const width = Math.max(1, Math.round(cssWidth * currentDpr));
			const height = Math.max(1, Math.round(cssHeight * currentDpr));
			if (canvas.width !== width) canvas.width = width;
			if (canvas.height !== height) canvas.height = height;
			gl.viewport(0, 0, width, height);
		};
		resizeBackingStore();

		const uploadVariables = () => {
			for (const [name, state] of variableStates) {
				const value = variablesRef.current[name] ?? state.definition.defaultValue;
				const signature = variableSignature(value);
				if (signature === state.signature) continue;
				uploadVariable(gl, state.location, state.definition, value);
				state.signature = signature;
			}
		};

		const draw = (timestamp: number) => {
			if (disposed || offscreen || ((config.pauseWhenHidden ?? true) && document.hidden)) return;
			const delta = lastDrawTimestamp === 0 ? 0 : timestamp - lastDrawTimestamp;
			lastDrawTimestamp = timestamp;
			frameNumber += 1;
			gl.useProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform2f(builtins.resolution, canvas.width, canvas.height);
			gl.uniform1f(builtins.time, timestamp / 1000);
			gl.uniform1f(builtins.delta, delta / 1000);
			gl.uniform1f(builtins.frame, frameNumber);
			gl.uniform2f(builtins.pointer, pointerX, pointerY);
			gl.uniform1f(builtins.scroll, scrollProgress);
			uploadVariables();
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			if (!readyRef.current) {
				readyRef.current = true;
				props.onReady?.();
			}
		};

		const requestEventDraw = () => {
			if (eventFrame !== 0) return;
			eventFrame = requestAnimationFrame((timestamp) => {
				eventFrame = 0;
				draw(timestamp);
			});
		};
		requestDrawRef.current = requestEventDraw;
		const cleanups: Array<() => void> = [];

		if (dependencySet.has("pointer.x") || dependencySet.has("pointer.y")) {
			const pointerMove = (event: PointerEvent) => {
				const rect = host.getBoundingClientRect();
				pointerX = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
				pointerY = rect.height > 0 ? 1 - (event.clientY - rect.top) / rect.height : 0.5;
				if (plan.execution === "event") requestEventDraw();
			};
			host.addEventListener("pointermove", pointerMove, { passive: true });
			cleanups.push(() => host.removeEventListener("pointermove", pointerMove));
		}
		if (dependencySet.has("scroll.position")) {
			EngineScroll.initialize();
			const updateScroll = () => {
				const total = Math.max(1, EngineScroll.totalPoints());
				scrollProgress = Math.max(0, Math.min(1, EngineScroll.currentPoint() / total));
				if (plan.execution === "event") requestEventDraw();
			};
			updateScroll();
			cleanups.push(EngineScroll.subscribe(updateScroll));
		}
		if (typeof ResizeObserver !== "undefined") {
			const resizeObserver = new ResizeObserver(([entry]) => {
				if (!entry) return;
				cssWidth = Math.max(1, entry.contentRect.width || host.clientWidth || 1);
				cssHeight = Math.max(1, entry.contentRect.height || host.clientHeight || 1);
				resizeBackingStore();
				if (plan.execution !== "animated") requestEventDraw();
			});
			resizeObserver.observe(host);
			cleanups.push(() => resizeObserver.disconnect());
		}
		if ((config.pauseWhenOffscreen ?? true) && typeof IntersectionObserver !== "undefined") {
			const intersectionObserver = new IntersectionObserver(([entry]) => {
				offscreen = !entry?.isIntersecting;
				if (!offscreen && plan.execution !== "animated") requestEventDraw();
			}, { rootMargin: "180px" });
			intersectionObserver.observe(host);
			cleanups.push(() => intersectionObserver.disconnect());
		}

		if (plan.execution === "animated" && !reducedMotion) {
			cleanups.push(EngineShaderScheduler.add((timestamp) => {
				if (lastTimestamp !== 0) {
					const interval = timestamp - lastTimestamp;
					if (interval + 0.5 < frameInterval) return;
					adaptiveTotal += interval;
					adaptiveSamples += 1;
				}
				lastTimestamp = timestamp;
				draw(timestamp);
				if ((config.adaptive ?? true) && timestamp - adaptiveWindowStart >= 1200 && adaptiveSamples > 0) {
					const average = adaptiveTotal / adaptiveSamples;
					const target = desiredDpr(maxDpr, resolutionScale);
					let nextDpr = currentDpr;
					if (average > frameInterval * 1.5 && currentDpr > 0.125) nextDpr = Math.max(0.125, currentDpr - 0.125);
					else if (average < frameInterval * 1.15 && currentDpr < target - 0.05) nextDpr = Math.min(target, currentDpr + 0.125);
					if (Math.abs(nextDpr - currentDpr) >= 0.05) {
						currentDpr = nextDpr;
						resizeBackingStore();
					}
					adaptiveWindowStart = timestamp;
					adaptiveSamples = 0;
					adaptiveTotal = 0;
				}
			}));
		} else {
			requestEventDraw();
		}

		const onContextLost = (event: Event) => event.preventDefault();
		const onContextRestored = () => setContextVersion((version) => version + 1);
		canvas.addEventListener("webglcontextlost", onContextLost);
		canvas.addEventListener("webglcontextrestored", onContextRestored);
		cleanups.push(() => {
			canvas.removeEventListener("webglcontextlost", onContextLost);
			canvas.removeEventListener("webglcontextrestored", onContextRestored);
		});

		return () => {
			disposed = true;
			requestDrawRef.current = () => {};
			if (eventFrame !== 0) cancelAnimationFrame(eventFrame);
			for (const cleanup of cleanups) cleanup();
			gl.deleteBuffer(positionBuffer);
			gl.deleteProgram(program);
		};
	}, [
		plan,
		config?.src,
		config?.fps,
		config?.maxDpr,
		config?.adaptive,
		config?.pauseWhenOffscreen,
		config?.pauseWhenHidden,
		config?.respectReducedMotion,
		config?.powerPreference,
		props.layer,
		props.onReady,
		props.onError,
		contextVersion,
	]);

	const fallback = plan?.fallback && plan.fallback !== "transparent" ? plan.fallback : undefined;
	const style: CSSProperties = {
		display: "block",
		width: "100%",
		height: "100%",
		background: fallback,
		imageRendering: plan?.render.filter === "nearest" ? "pixelated" : undefined,
		...config?.style,
	};
	return <canvas ref={canvasRef} aria-hidden="true" className={config?.className} style={style} />;
});
