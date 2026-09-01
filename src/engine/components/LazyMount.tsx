"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Engine — LazyMount
// Generation 3 routes viewport preparation through EngineScheduler so lazy
// modules share one work policy instead of each subsystem inventing its own.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	Suspense,
	type CSSProperties,
	type ReactNode,
} from "react";
import { useEngineSchedule } from "../hooks/useEngineScheduler";

export interface LazyMountProps {
	children: ReactNode;
	height?: string | number;
	width?: string | number;
	/** Reserve responsive media space without forcing a fixed pixel height. */
	aspectRatio?: string;
	skeleton?: ReactNode;
	/** Distance around the viewport at which the child should start mounting. */
	rootMargin?: string;
	eager?: boolean;
	className?: string;
	style?: CSSProperties;
}

function DefaultSkeleton({
	height,
	width,
	aspectRatio,
}: {
	height?: string | number;
	width?: string | number;
	aspectRatio?: string;
}) {
	const resolvedHeight = height === "auto"
		? undefined
		: typeof height === "number"
			? `${height}px`
			: height;
	const resolvedWidth = typeof width === "number" ? `${width}px` : (width ?? "100%");

	return (
		<div
			aria-hidden="true"
			className="e-lazy-skeleton"
			style={{
				width: resolvedWidth,
				height: resolvedHeight ?? (aspectRatio ? "100%" : "200px"),
				aspectRatio,
				borderRadius: "8px",
				background:
					"linear-gradient(90deg, var(--e-skeleton-a,#e2e8f0) 25%, var(--e-skeleton-b,#f1f5f9) 50%, var(--e-skeleton-a,#e2e8f0) 75%)",
				backgroundSize: "200% 100%",
				animation: "e-shimmer 1.6s ease-in-out infinite",
			}}
		/>
	);
}

let shimmerInjected = false;
function injectShimmerCSS(): void {
	if (typeof document === "undefined" || shimmerInjected) return;
	shimmerInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes e-shimmer {
			0%   { background-position: 200% 0 }
			100% { background-position: -200% 0 }
		}
		@media (prefers-reduced-motion: reduce) {
			.e-lazy-skeleton { animation-duration: 0.001ms; animation-iteration-count: 1; }
		}
	`;
	document.head.appendChild(style);
}

export const LazyMount = memo(function LazyMount({
	children,
	height,
	width,
	aspectRatio,
	skeleton,
	rootMargin = "600px 0px",
	eager = false,
	className,
	style,
}: LazyMountProps) {
	const schedule = useEngineSchedule<HTMLDivElement>({
		priority: eager,
		nearMargin: rootMargin,
	});
	const [activated, setActivated] = React.useState(eager);

	React.useEffect(() => {
		if (schedule.near || schedule.visible || schedule.state === "critical") setActivated(true);
	}, [schedule.near, schedule.state, schedule.visible]);

	React.useEffect(() => {
		injectShimmerCSS();
	}, []);

	const resolvedHeight = height === "auto"
		? undefined
		: typeof height === "number"
			? `${height}px`
			: height;
	const containerStyle: CSSProperties = {
		width: typeof width === "number" ? `${width}px` : (width ?? "100%"),
		...(resolvedHeight ? { minHeight: resolvedHeight } : {}),
		...(aspectRatio ? { aspectRatio } : {}),
		...style,
	};
	const fallback = skeleton ?? (
		<DefaultSkeleton
			height={height}
			width={width}
			aspectRatio={aspectRatio}
		/>
	);

	return (
		<div
			ref={schedule.ref}
			className={className}
			style={containerStyle}
			data-engine-work={schedule.state}
		>
			{activated ? (
				<Suspense fallback={fallback}>{children}</Suspense>
			) : fallback}
		</div>
	);
});

export interface LazySectionProps extends LazyMountProps {
	contentVisibility?: boolean;
	containIntrinsicHeight?: string;
}

export const LazySection = memo(function LazySection({
	contentVisibility = true,
	containIntrinsicHeight,
	style,
	height,
	...rest
}: LazySectionProps) {
	const cvStyle: CSSProperties = contentVisibility
		? {
				contentVisibility: "auto" as CSSProperties["contentVisibility"],
				containIntrinsicHeight:
					containIntrinsicHeight ??
					(height
						? typeof height === "number"
							? `${height}px`
							: height
						: "500px"),
			}
		: {};

	return (
		<LazyMount
			height={height}
			style={{ ...cvStyle, ...style }}
			{...rest}
		/>
	);
});
