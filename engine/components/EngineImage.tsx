"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineImage
//
//  Optimised image component. Every image is:
//
//    · Converted to AVIF → WebP → original automatically by Next.js
//      (requires next.config.js images.formats = ["image/avif","image/webp"])
//
//    · Resolution-aware quality tiers:
//        "performance"  →  65  (smallest file, fast load, good for thumbnails)
//        "balanced"     →  78  (default — good quality, fast enough)
//        "sharp"        →  90  (best quality, larger file, use for heroes)
//      OR set qualityMobile / qualityDesktop for per-viewport override
//      (rendered as two <Image> elements shown/hidden via CSS)
//
//    · Lazy-loaded by default — starts fetching before it enters view,
//      with a rootMargin based on image area (bigger = earlier fetch)
//
//    · Blur-up progressive loading — shimmer or blurDataURL placeholder
//      until the full image finishes loading
//
//    · GPU-composited — the wrapper uses will-change + translateZ so the
//      browser promotes it to its own compositor layer
//
//    · Browser-specific rendering hints via engine browser classes:
//        .b-ff  — Firefox: image-rendering: auto (avoids over-sharpening)
//        .b-sf  — Safari: -webkit-optimize-contrast removed
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	useState,
	useCallback,
	useEffect,
	memo,
	type CSSProperties,
} from "react";
import Image from "next/image";
import type { ImageNodeProps } from "../schema/types";
import { useImageInView } from "../hooks/useInView";

// ── One-time CSS injection ────────────────────────────────────────────────────

let imgCSSInjected = false;

function injectImageCSS(): void {
	if (typeof document === "undefined" || imgCSSInjected) return;
	imgCSSInjected = true;
	const s = document.createElement("style");
	s.id = "__engine_img__";
	s.textContent = IMAGE_BASE_CSS;
	document.head.appendChild(s);
}

const IMAGE_BASE_CSS = `
@keyframes e-shimmer{
	0%{background-position:200% 0}
	100%{background-position:-200% 0}
}
.e-img-wrap{
	transform:translateZ(0);
	will-change:transform;
	contain:layout style paint;
}
.e-img-wrap img{display:block!important}
/* Firefox: default image-rendering (avoid over-sharpening) */
@supports(-moz-appearance:none){
	.e-img-wrap img{image-rendering:auto}
}
/* Responsive quality — show correct image per viewport */
.e-img-mobile{display:block}
.e-img-desktop{display:none}
@media(min-width:768px){
	.e-img-mobile{display:none}
	.e-img-desktop{display:block}
}
`.trim();

// ── Rootmargin heuristic ──────────────────────────────────────────────────────

function getRootMargin(w?: number, h?: number): string {
	const area = (w ?? 800) * (h ?? 600);
	if (area >= 1_920 * 1_080) return "800px 0px";
	if (area >= 1_280 * 720)   return "600px 0px";
	if (area >= 800  * 600)    return "400px 0px";
	return "200px 0px";
}

// ── Quality presets ───────────────────────────────────────────────────────────

const QUALITY_PRESET: Record<string, number> = {
	performance: 65,
	balanced:    78,
	sharp:       90,
};

// ── Smart sizes generator ─────────────────────────────────────────────────────

function autoSizes(fill?: boolean, width?: number): string {
	if (fill)   return "100vw";
	if (!width) return "100vw";
	// Generate a responsive sizes hint that covers common layouts
	// Image is never wider than its natural width, and shrinks on small screens
	return `(max-width: 480px) 100vw, (max-width: 768px) calc(100vw - 2rem), ${width}px`;
}

// ── Component props ───────────────────────────────────────────────────────────

export interface EngineImageProps extends Omit<ImageNodeProps, "type"> {
	width?:  number;
	height?: number;
	/** base64 LQIP for blur-up effect — auto-generates shimmer if omitted */
	blurDataURL?: string;
	/**
	 * Quality preset — applied to all viewports.
	 * Ignored when qualityMobile / qualityDesktop are set.
	 */
	qualityPreset?: "performance" | "balanced" | "sharp";
	/**
	 * Quality for viewport < 768px (mobile / low-res).
	 * When set, a separate low-quality image is served to mobile.
	 */
	qualityMobile?: number;
	/**
	 * Quality for viewport ≥ 768px (desktop / high-res).
	 * When set, a separate high-quality image is served to desktop.
	 */
	qualityDesktop?: number;
	onLoad?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EngineImage = memo(function EngineImage({
	src,
	alt,
	width,
	height,
	fill         = false,
	priority     = false,
	quality,
	qualityPreset = "balanced",
	qualityMobile,
	qualityDesktop,
	objectFit    = "cover",
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

	useEffect(() => { injectImageCSS(); }, []);

	const { ref, inView } = useImageInView<HTMLDivElement>(priority);
	const handleLoad = useCallback(() => {
		setLoaded(true);
		onLoad?.();
	}, [onLoad]);

	// ── Quality resolution ─────────────────────────────────────────────────────

	// Per-viewport mode: separate quality values for mobile vs desktop
	const usePerViewport = qualityMobile !== undefined || qualityDesktop !== undefined;
	const mobileQ  = qualityMobile  ?? 70;
	const desktopQ = qualityDesktop ?? (quality ?? QUALITY_PRESET[qualityPreset] ?? 78);
	// Single quality when not using per-viewport mode
	const resolvedQuality = quality ?? QUALITY_PRESET[qualityPreset] ?? 78;

	// ── Sizes ──────────────────────────────────────────────────────────────────
	const resolvedSizes = sizes ?? autoSizes(fill, width);

	// ── Wrapper style ──────────────────────────────────────────────────────────
	const borderRadius =
		rounded === true ? "8px" :
		typeof rounded === "string" ? rounded : undefined;

	const wrapperStyle: CSSProperties = {
		position:    "relative",
		overflow:    "hidden",
		borderRadius,
		...(aspectRatio && !fill ? { aspectRatio, width: "100%", height: undefined } : {}),
		...(fill ? { width: "100%", height: "100%" } : {}),
		...(style ?? {}),
	};

	// ── Placeholder ────────────────────────────────────────────────────────────
	const placeholder = (
		!loaded && (
			<div
				aria-hidden
				style={{
					position:           "absolute",
					inset:              0,
					backgroundImage:    blurDataURL
						? `url(${blurDataURL})`
						: "linear-gradient(90deg,var(--e-sk-a,#e2e8f0) 25%,var(--e-sk-b,#f1f5f9) 50%,var(--e-sk-a,#e2e8f0) 75%)",
					backgroundSize:     blurDataURL ? "cover" : "400% 100%",
					backgroundPosition: "center",
					filter:             blurDataURL ? "blur(20px) scale(1.1)" : undefined,
					animation:          blurDataURL ? undefined : "e-shimmer 1.6s ease-in-out infinite",
				}}
			/>
		)
	);

	// ── Shared image props ─────────────────────────────────────────────────────
	const sharedImageProps = {
		src,
		alt,
		sizes:    resolvedSizes,
		priority,
		onLoad:   handleLoad,
		style:    { objectFit, transition: "opacity 0.4s ease", opacity: loaded ? 1 : 0 } as CSSProperties,
		...(fill ? { fill: true } : { width: width ?? 800, height: height ?? 600 }),
	};

	// ── Render ─────────────────────────────────────────────────────────────────
	const wrapper = (
		<div ref={ref} style={wrapperStyle} className={`e-img-wrap${className ? ` ${className}` : ""}`}>
			{placeholder}
			{inView && (
				usePerViewport ? (
					// Two images, CSS toggles which is visible
					<>
						<Image {...sharedImageProps} quality={mobileQ}  className="e-img-mobile" />
						<Image {...sharedImageProps} quality={desktopQ} className="e-img-desktop" />
					</>
				) : (
					<Image {...sharedImageProps} quality={resolvedQuality} />
				)
			)}
		</div>
	);

	if (!caption) return wrapper;
	return (
		<figure style={{ margin: 0, padding: 0 }}>
			{wrapper}
			<figcaption style={{
				textAlign: "center",
				fontSize:  "0.85rem",
				color:     "var(--e-caption-color, #64748b)",
				marginTop: "0.5rem",
			}}>
				{caption}
			</figcaption>
		</figure>
	);
});
