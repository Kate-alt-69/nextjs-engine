"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineSuspense
//
//  Schema-native React.Suspense wrapper with delayed loading presets and a
//  timeout fallback resolved through the page-level slot registry.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	Suspense,
	memo,
	useEffect,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import { useSlot } from "../providers/EngineProvider";
import type { BaseNodeProps } from "../schema/types";

export type SuspensePreset = "skeleton" | "spinner" | "shimmer" | "pulse" | "blur";

export interface EngineSuspenseProps extends BaseNodeProps {
	children?: ReactNode;
	/** Built-in loading fallback preset. */
	preset?: SuspensePreset;
	/** Minimum height of the placeholder area. */
	minHeight?: string | number;
	/** Number of skeleton lines. */
	skeletonLines?: number;
	/** Delay before the loading fallback becomes visible. */
	delay?: number;
	/** Maximum time the Suspense fallback may remain mounted before timeout UI. */
	timeout?: number;
	/** Page slot name rendered after timeout. Falls back to a built-in alert. */
	errorFallback?: string;
	/** Direct React loading fallback override. */
	fallback?: ReactNode;
}

const SUSPENSE_STYLE_ID = "__engine_suspense_css__";
let keyframesInjected = false;

function injectKeyframes(): void {
	if (typeof document === "undefined") return;
	if (keyframesInjected || document.getElementById(SUSPENSE_STYLE_ID)) {
		keyframesInjected = true;
		return;
	}
	keyframesInjected = true;
	const style = document.createElement("style");
	style.id = SUSPENSE_STYLE_ID;
	style.textContent = `
		@keyframes e-shimmer {
			0% { background-position: -400px 0; }
			100% { background-position: 400px 0; }
		}
		@keyframes e-pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}
		@keyframes e-spin { to { transform: rotate(360deg); } }
		@keyframes e-skeleton-wave {
			0% { background-position: -200% 0; }
			100% { background-position: 200% 0; }
		}
		@media (prefers-reduced-motion: reduce) {
			.e-suspense-motion { animation: none !important; }
		}
	`;
	document.head.appendChild(style);
}

function resolveMinHeight(value: string | number | undefined, fallback?: string): string | undefined {
	if (typeof value === "number") return `${value}px`;
	return value ?? fallback;
}

function SkeletonFallback({
	lines = 4,
	minHeight,
}: {
	lines?: number;
	minHeight?: string | number;
}) {
	useEffect(() => { injectKeyframes(); }, []);
	const widths = ["100%", "85%", "90%", "70%", "95%", "60%", "80%", "75%"];
	const safeLines = Math.max(0, Math.floor(lines));

	return (
		<div
			style={{
				padding: "1.25rem",
				minHeight: resolveMinHeight(minHeight),
				display: "flex",
				flexDirection: "column",
				gap: "0.75rem",
			}}
			aria-busy="true"
			aria-label="Loading..."
			role="status"
		>
			{Array.from({ length: safeLines }, (_, index) => (
				<div
					key={index}
					className="e-suspense-motion"
					style={{
						height: "14px",
						borderRadius: "6px",
						width: widths[index % widths.length],
						background: "linear-gradient(90deg, var(--e-skeleton-base, #e2e8f0) 25%, var(--e-skeleton-shine, #f1f5f9) 50%, var(--e-skeleton-base, #e2e8f0) 75%)",
						backgroundSize: "200% 100%",
						animation: "e-skeleton-wave 1.5s ease-in-out infinite",
					}}
				/>
			))}
		</div>
	);
}

function SpinnerFallback({ minHeight }: { minHeight?: string | number }) {
	useEffect(() => { injectKeyframes(); }, []);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				minHeight: resolveMinHeight(minHeight, "80px"),
			}}
			role="status"
			aria-label="Loading..."
		>
			<div
				className="e-suspense-motion"
				style={{
					width: "32px",
					height: "32px",
					borderRadius: "50%",
					border: "3px solid var(--e-skeleton-base, #e2e8f0)",
					borderTopColor: "var(--e-accent, #4f46e5)",
					animation: "e-spin 0.7s linear infinite",
				}}
				aria-hidden="true"
			/>
		</div>
	);
}

function ShimmerFallback({ minHeight }: { minHeight?: string | number }) {
	useEffect(() => { injectKeyframes(); }, []);
	return (
		<div
			className="e-suspense-motion"
			style={{
				minHeight: resolveMinHeight(minHeight, "120px"),
				borderRadius: "8px",
				background: "linear-gradient(90deg, var(--e-skeleton-base, #e2e8f0) 0%, var(--e-skeleton-shine, #f8fafc) 50%, var(--e-skeleton-base, #e2e8f0) 100%)",
				backgroundSize: "400px 100%",
				animation: "e-shimmer 1.5s ease-in-out infinite",
			}}
			role="status"
			aria-label="Loading..."
			aria-busy="true"
		/>
	);
}

function PulseFallback({ minHeight }: { minHeight?: string | number }) {
	useEffect(() => { injectKeyframes(); }, []);
	return (
		<div
			className="e-suspense-motion"
			style={{
				minHeight: resolveMinHeight(minHeight, "120px"),
				borderRadius: "8px",
				background: "var(--e-skeleton-base, #e2e8f0)",
				animation: "e-pulse 1.8s ease-in-out infinite",
			}}
			role="status"
			aria-label="Loading..."
			aria-busy="true"
		/>
	);
}

function BlurFallback({ minHeight }: { minHeight?: string | number }) {
	return (
		<div
			style={{
				minHeight: resolveMinHeight(minHeight, "120px"),
				borderRadius: "8px",
				background: "linear-gradient(135deg, var(--e-skeleton-base, #e2e8f0), var(--e-skeleton-shine, #f8fafc))",
				filter: "blur(8px)",
				opacity: 0.65,
				pointerEvents: "none",
			}}
			aria-busy="true"
			aria-label="Loading..."
			role="status"
		/>
	);
}

function DefaultTimeoutFallback({ minHeight }: { minHeight?: string | number }) {
	return (
		<div
			role="alert"
			style={{
				minHeight: resolveMinHeight(minHeight, "80px"),
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: "1rem",
				color: "var(--e-error, #b91c1c)",
			}}
		>
			Loading timed out.
		</div>
	);
}

type FallbackPhase = "hidden" | "loading" | "timeout";

function TimedFallback({
	delay,
	timeout,
	loadingFallback,
	timeoutFallback,
}: {
	delay: number;
	timeout?: number;
	loadingFallback: ReactNode;
	timeoutFallback: ReactNode;
}) {
	const normalizedDelay = Math.max(0, delay);
	const normalizedTimeout = timeout === undefined ? undefined : Math.max(0, timeout);
	const [phase, setPhase] = useState<FallbackPhase>(normalizedDelay > 0 ? "hidden" : "loading");

	useEffect(() => {
		setPhase(normalizedDelay > 0 ? "hidden" : "loading");
		const delayTimer = normalizedDelay > 0
			? window.setTimeout(() => setPhase("loading"), normalizedDelay)
			: undefined;
		const timeoutTimer = normalizedTimeout !== undefined
			? window.setTimeout(() => setPhase("timeout"), normalizedTimeout)
			: undefined;

		return () => {
			if (delayTimer !== undefined) window.clearTimeout(delayTimer);
			if (timeoutTimer !== undefined) window.clearTimeout(timeoutTimer);
		};
	}, [normalizedDelay, normalizedTimeout]);

	if (phase === "timeout") return <>{timeoutFallback}</>;
	if (phase === "hidden") return null;
	return <>{loadingFallback}</>;
}

export const EngineSuspense = memo(function EngineSuspense({
	children,
	preset = "skeleton",
	minHeight,
	skeletonLines = 4,
	delay = 0,
	timeout,
	errorFallback,
	fallback,
	style,
	className,
	id,
	point,
	cprop,
	...props
}: EngineSuspenseProps) {
	const resolvedStyle = usePropStyles(props as any, style);
	const hoverClass = cpropClass(cprop);
	const mergedClass = [className, hoverClass].filter(Boolean).join(" ") || undefined;
	const resolvedId = id ?? point;
	const errorSlot = useSlot(errorFallback ?? "");

	const presetFallback: ReactNode = fallback ?? (() => {
		switch (preset) {
			case "skeleton":
				return <SkeletonFallback lines={skeletonLines} minHeight={minHeight} />;
			case "spinner":
				return <SpinnerFallback minHeight={minHeight} />;
			case "shimmer":
				return <ShimmerFallback minHeight={minHeight} />;
			case "pulse":
				return <PulseFallback minHeight={minHeight} />;
			case "blur":
				return <BlurFallback minHeight={minHeight} />;
			default:
				return <SkeletonFallback lines={skeletonLines} minHeight={minHeight} />;
		}
	})();

	const timeoutFallback = errorSlot ?? <DefaultTimeoutFallback minHeight={minHeight} />;
	const wrappedFallback = delay > 0 || timeout !== undefined
		? (
			<TimedFallback
				delay={delay}
				timeout={timeout}
				loadingFallback={presetFallback}
				timeoutFallback={timeoutFallback}
			/>
		)
		: presetFallback;

	return (
		<div id={resolvedId} className={mergedClass} style={resolvedStyle}>
			<Suspense fallback={wrappedFallback}>{children}</Suspense>
		</div>
	);
});
