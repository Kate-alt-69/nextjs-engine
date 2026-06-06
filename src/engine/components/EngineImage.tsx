"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineImage
//
//  Smart image component with:
//    · Automatic next/image usage (WebP/AVIF, CDN-aware sizing)
//    · Progressive blur-up loading (tiny base64 placeholder → full res)
//    · Automatic lazy loading — always off for above-fold (priority)
//    · Size-threshold logic: wide/tall images get a lower rootMargin so
//      the browser starts fetching further before they enter view
//    · Intrinsic size preservation to prevent Cumulative Layout Shift (CLS)
//    · Optional caption with accessible <figure>/<figcaption>
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	useState,
	useCallback,
	memo,
	type CSSProperties,
} from "react";
import Image from "next/image";
import type { ImageNodeProps } from "../schema/types";
import { useImageInView } from "../hooks/useInView";

// ── Size-threshold heuristics ─────────────────────────────────────────────────

/**
 * Returns a rootMargin value based on how large the image is.
 * Larger images take more time to decode → pre-fetch from further away.
 */
function getRootMargin(width?: number, height?: number): string {
	const area = (width ?? 800) * (height ?? 600);
	if (area >= 1_920 * 1_080) return "800px 0px"; // Full HD — very early fetch
	if (area >= 1_280 * 720)   return "600px 0px"; // HD
	if (area >= 800 * 600)     return "400px 0px"; // Medium
	return "200px 0px";                             // Small — normal
}

// ── Blur placeholder ──────────────────────────────────────────────────────────

/** Tiny 1×1 gray pixel as base64 — shown while the real image loads. */
const BLANK_PLACEHOLDER =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// ── Component ─────────────────────────────────────────────────────────────────

export interface EngineImageProps extends Omit<ImageNodeProps, "type"> {
	/** Pixel width (required unless fill=true) */
	width?: number;
	/** Pixel height (required unless fill=true) */
	height?: number;
	/** Low-quality base64 placeholder for blur-up effect */
	blurDataURL?: string;
	/** Called when the full image finishes loading */
	onLoad?: () => void;
}

export const EngineImage = memo(function EngineImage({
	src,
	alt,
	width,
	height,
	fill = false,
	priority = false,
	quality = 85,
	objectFit = "cover",
	aspectRatio,
	sizes,
	rounded,
	caption,
	blurDataURL,
	onLoad,
	style,
	className,
}: EngineImageProps) {
	const [loaded, setLoaded] = useState(false);

	// Determine how far ahead to start loading based on image size
	const rootMarginForSize = getRootMargin(width, height);

	// Priority images are always "in-view" — skip IntersectionObserver entirely
	const { ref, inView } = useImageInView<HTMLDivElement>(priority);

	const handleLoad = useCallback(() => {
		setLoaded(true);
		onLoad?.();
	}, [onLoad]);

	// ── Wrapper styles ─────────────────────────────────────────────────────────

	const borderRadius =
		rounded === true
			? "8px"
			: typeof rounded === "string"
			? rounded
			: undefined;

	const wrapperStyle: CSSProperties = {
		position: "relative",
		overflow: "hidden",
		borderRadius,
		...(aspectRatio && !fill
			? { aspectRatio, width: "100%", height: undefined }
			: {}),
		...(fill ? { width: "100%", height: "100%" } : {}),
		...(style ?? {}),
	};

	// ── Sizes attribute ────────────────────────────────────────────────────────
	// Auto-generate a sensible sizes string if not provided
	const resolvedSizes =
		sizes ??
		(fill
			? "100vw"
			: width
			? `(max-width: ${width}px) 100vw, ${width}px`
			: "100vw");

	// ── Placeholder blur style ─────────────────────────────────────────────────
	const imageStyle: CSSProperties = {
		objectFit,
		transition: "opacity 0.4s ease",
		opacity: loaded ? 1 : 0,
	};

	const wrapper = (
		<div ref={ref} style={wrapperStyle} className={className}>
			{/* Placeholder — shown until real image loads */}
			{!loaded && (
				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage: blurDataURL
							? `url(${blurDataURL})`
							: `linear-gradient(90deg, var(--e-skeleton-a,#e2e8f0) 25%, var(--e-skeleton-b,#f1f5f9) 50%, var(--e-skeleton-a,#e2e8f0) 75%)`,
						backgroundSize: blurDataURL ? "cover" : "200% 100%",
						backgroundPosition: "center",
						filter: blurDataURL ? "blur(20px) scale(1.1)" : undefined,
						animation: blurDataURL
							? undefined
							: "e-shimmer 1.6s ease-in-out infinite",
					}}
				/>
			)}

			{/* Only render the actual <img> once the wrapper is in-view */}
			{inView && (
				<Image
					src={src}
					alt={alt}
					{...(fill ? { fill: true } : { width: width ?? 800, height: height ?? 600 })}
					quality={quality}
					priority={priority}
					sizes={resolvedSizes}
					onLoad={handleLoad}
					style={imageStyle}
					// next/image handles loading="lazy" internally when priority=false
				/>
			)}
		</div>
	);

	if (caption) {
		return (
			<figure style={{ margin: 0, padding: 0 }}>
				{wrapper}
				<figcaption
					style={{
						textAlign: "center",
						fontSize: "0.85rem",
						color: "var(--e-caption-color, #64748b)",
						marginTop: "0.5rem",
					}}
				>
					{caption}
				</figcaption>
			</figure>
		);
	}

	return wrapper;
});
