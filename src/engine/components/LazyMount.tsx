"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — LazyMount
//
//  Generic lazy-mounting wrapper.
//  Children are NOT rendered to the DOM at all until the container enters
//  the viewport (or within rootMargin of it).  This is the correct strategy
//  for heavy content — React never calls the child render function, no JS
//  runs, no network requests fire.
//
//  Compare to lazy-loading images which still create DOM nodes immediately:
//    <img loading="lazy" />  →  DOM node exists, browser decides network timing
//    <LazyMount>…</LazyMount> →  Zero DOM, zero network, zero JS until in-view
//
//  Usage:
//    <LazyMount height="600px" skeleton={<VideoSkeleton />}>
//      <HeavyVideoPlayer src="…" />
//    </LazyMount>
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	type ReactNode,
	type CSSProperties,
	memo,
	Suspense,
} from "react";
import { useSectionInView } from "../hooks/useInView";

export interface LazyMountProps {
	children: ReactNode;
	/**
	 * Reserved height before the element mounts.
	 * Prevents layout shift (CLS) by holding space.
	 * Accepts any CSS height value.
	 */
	height?: string | number;
	/**
	 * Reserved width (default: 100%)
	 */
	width?: string | number;
	/**
	 * Custom placeholder shown before mount.
	 * If omitted, a shimmer skeleton is rendered using the height/width above.
	 */
	skeleton?: ReactNode;
	/**
	 * Pre-load distance above viewport in pixels.
	 * Default: 600 — start mounting 600px before entering view.
	 */
	rootMargin?: string;
	/**
	 * Skip lazy mounting entirely — renders children immediately.
	 * Set this for above-fold content.
	 */
	eager?: boolean;
	className?: string;
	style?: CSSProperties;
}

function DefaultSkeleton({
	height,
	width,
}: {
	height?: string | number;
	width?: string | number;
}) {
	const h = typeof height === "number" ? `${height}px` : (height ?? "200px");
	const w = typeof width === "number" ? `${width}px` : (width ?? "100%");

	return (
		<div
			aria-hidden="true"
			style={{
				width: w,
				height: h,
				borderRadius: "8px",
				background:
					"linear-gradient(90deg, var(--e-skeleton-a,#e2e8f0) 25%, var(--e-skeleton-b,#f1f5f9) 50%, var(--e-skeleton-a,#e2e8f0) 75%)",
				backgroundSize: "200% 100%",
				animation: "e-shimmer 1.6s ease-in-out infinite",
			}}
		/>
	);
}

// Inject shimmer keyframes once into the document
let shimmerInjected = false;
function injectShimmerCSS() {
	if (typeof document === "undefined" || shimmerInjected) return;
	shimmerInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes e-shimmer {
			0%   { background-position: 200% 0 }
			100% { background-position: -200% 0 }
		}
	`;
	document.head.appendChild(style);
}

export const LazyMount = memo(function LazyMount({
	children,
	height,
	width,
	skeleton,
	rootMargin = "600px 0px",
	eager = false,
	className,
	style,
}: LazyMountProps) {
	const { ref, inView } = useSectionInView<HTMLDivElement>(eager);

	// Inject shimmer CSS on first client render
	React.useEffect(() => {
		injectShimmerCSS();
	}, []);

	const containerStyle: CSSProperties = {
		width: typeof width === "number" ? `${width}px` : (width ?? "100%"),
		...style,
	};

	return (
		<div ref={ref} className={className} style={containerStyle}>
			{inView ? (
				// Wrap in Suspense so any lazy-loaded child (React.lazy, next/dynamic)
				// also gets a boundary — no unhandled suspense errors
				<Suspense
					fallback={
						skeleton ?? (
							<DefaultSkeleton height={height} width={width} />
						)
					}
				>
					{children}
				</Suspense>
			) : (
				(skeleton ?? (
					<DefaultSkeleton height={height} width={width} />
				))
			)}
		</div>
	);
});

// ── LazySection ───────────────────────────────────────────────────────────────
// Specialised variant for full page sections.
// Also applies content-visibility: auto as a CSS hint to the browser to skip
// paint/layout work for off-screen sections even before JS decides to mount.

export interface LazySectionProps extends LazyMountProps {
	/**
	 * Hint to the browser's rendering engine to skip layout/paint for this
	 * section until it enters the viewport.
	 * Default: true — disable only for sections with position:sticky children.
	 */
	contentVisibility?: boolean;
	/** Intrinsic size hint for content-visibility — prevents scroll jump. */
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
