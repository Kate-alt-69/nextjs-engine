"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EngineImage — viewport-aware Next image wrapper
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useState,
	type CSSProperties,
} from "react";
import Image, { getImageProps } from "next/image";
import type { ImageNodeProps } from "../schema/types";
import { useInView } from "../hooks/useInView";

let imgCSSInjected = false;

const IMAGE_BASE_CSS = `
@keyframes e-shimmer{
	0%{background-position:200% 0}
	100%{background-position:-200% 0}
}
.e-img-wrap img{display:block!important}
@supports(-moz-appearance:none){
	.e-img-wrap img{image-rendering:auto}
}
`.trim();

function injectImageCSS(): void {
	if (typeof document === "undefined" || imgCSSInjected) return;
	imgCSSInjected = true;
	const style = document.createElement("style");
	style.id = "__engine_img__";
	style.textContent = IMAGE_BASE_CSS;
	document.head.appendChild(style);
}

function getRootMargin(width?: number, height?: number): string {
	const area = (width ?? 800) * (height ?? 600);
	if (area >= 1920 * 1080) return "800px 0px";
	if (area >= 1280 * 720) return "600px 0px";
	if (area >= 800 * 600) return "400px 0px";
	return "200px 0px";
}

const QUALITY_PRESET: Record<string, number> = {
	performance: 65,
	balanced: 78,
	sharp: 90,
};

function autoSizes(fill?: boolean, width?: number): string {
	if (fill || !width) return "100vw";
	return `(max-width: 480px) 100vw, (max-width: 768px) calc(100vw - 2rem), ${width}px`;
}

export interface EngineImageProps extends Omit<ImageNodeProps, "type" | "objectFit"> {
	width?: number;
	height?: number;
	objectFit?: CSSProperties["objectFit"];
	blurDataURL?: string;
	qualityPreset?: "performance" | "balanced" | "sharp";
	qualityMobile?: number;
	qualityDesktop?: number;
	onLoad?: () => void;
}

export const EngineImage = memo(function EngineImage({
	src,
	alt,
	width,
	height,
	fill = false,
	priority = false,
	quality,
	qualityPreset = "balanced",
	qualityMobile,
	qualityDesktop,
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
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const loaded = loadedSrc === src;

	useEffect(() => {
		injectImageCSS();
	}, []);

	const { ref, inView } = useInView<HTMLDivElement>({
		rootMargin: getRootMargin(width, height),
		once: true,
		initialInView: priority,
	});
	const handleLoad = useCallback(() => {
		setLoadedSrc(src);
		onLoad?.();
	}, [onLoad, src]);

	const usePerViewport = qualityMobile !== undefined || qualityDesktop !== undefined;
	const mobileQuality = qualityMobile ?? 70;
	const desktopQuality = qualityDesktop ?? (quality ?? QUALITY_PRESET[qualityPreset] ?? 78);
	const resolvedQuality = quality ?? QUALITY_PRESET[qualityPreset] ?? 78;
	const resolvedSizes = sizes ?? autoSizes(fill, width);
	const resolvedAspectRatio = aspectRatio ?? (
		!fill &&
		typeof width === "number" && width > 0 &&
		typeof height === "number" && height > 0
			? `${width} / ${height}`
			: undefined
	);
	const borderRadius = rounded === true
		? "8px"
		: typeof rounded === "string"
			? rounded
			: undefined;

	const responsiveProps = useMemo(() => {
		if (!usePerViewport) return null;
		const sizing = fill
			? { fill: true as const }
			: { width: width ?? 800, height: height ?? 600 };
		const baseProps = {
			src,
			alt,
			sizes: resolvedSizes,
			priority,
			...sizing,
		};

		return {
			mobile: getImageProps({
				...baseProps,
				quality: mobileQuality,
			}),
			desktop: getImageProps({
				...baseProps,
				quality: desktopQuality,
			}),
		};
	}, [
		alt,
		desktopQuality,
		fill,
		height,
		mobileQuality,
		priority,
		resolvedSizes,
		src,
		usePerViewport,
		width,
	]);

	const wrapperStyle: CSSProperties = {
		position: "relative",
		overflow: "hidden",
		borderRadius,
		contain: "layout paint",
		...(resolvedAspectRatio && !fill ? { aspectRatio: resolvedAspectRatio, width: "100%" } : {}),
		...(fill ? { width: "100%", height: "100%" } : {}),
		...(style ?? {}),
	};

	const placeholder = !loaded ? (
		<div
			aria-hidden
			style={{
				position: "absolute",
				inset: 0,
				backgroundImage: blurDataURL
					? `url(${blurDataURL})`
					: "linear-gradient(90deg,var(--e-sk-a,#e2e8f0) 25%,var(--e-sk-b,#f1f5f9) 50%,var(--e-sk-a,#e2e8f0) 75%)",
				backgroundSize: blurDataURL ? "cover" : "400% 100%",
				backgroundPosition: "center",
				filter: blurDataURL ? "blur(20px) scale(1.1)" : undefined,
				animation: blurDataURL ? undefined : "e-shimmer 1.6s ease-in-out infinite",
			}}
		/>
	) : null;

	const imageStyle: CSSProperties = {
		objectFit,
		transition: "opacity 0.25s ease",
		opacity: loaded ? 1 : 0,
	};

	const commonImageProps = {
		src,
		alt,
		sizes: resolvedSizes,
		priority,
		style: imageStyle,
		...(fill ? { fill: true } : { width: width ?? 800, height: height ?? 600 }),
	};

	let imageNode: React.ReactNode = null;
	if (inView) {
		if (responsiveProps) {
			imageNode = (
				<picture>
					<source
						media="(max-width: 767px)"
						srcSet={responsiveProps.mobile.props.srcSet}
						sizes={responsiveProps.mobile.props.sizes}
					/>
					<source
						media="(min-width: 768px)"
						srcSet={responsiveProps.desktop.props.srcSet}
						sizes={responsiveProps.desktop.props.sizes}
					/>
					<img
						{...responsiveProps.desktop.props}
						style={imageStyle}
						onLoad={handleLoad}
					/>
				</picture>
			);
		} else {
			imageNode = (
				<Image
					{...commonImageProps}
					quality={resolvedQuality}
					onLoad={handleLoad}
				/>
			);
		}
	}

	const wrapper = (
		<div
			ref={ref}
			style={wrapperStyle}
			className={`e-img-wrap${className ? ` ${className}` : ""}`}
		>
			{placeholder}
			{imageNode}
		</div>
	);

	if (!caption) return wrapper;
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
});
