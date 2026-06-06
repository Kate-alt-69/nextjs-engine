"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineVideo
//
//  Videos are the heaviest asset type — they should NEVER start loading until
//  the user is about to see them.
//
//  Strategy:
//    1. Render an empty <div> placeholder (with poster image if provided)
//    2. When the container enters the viewport (rootMargin 800px ahead),
//       inject the <video> element with the real src
//    3. The browser starts buffering only at that point
//    4. While buffering, show the poster image + optional loading ring
//    5. Once metadata is loaded, fade in the video
//
//  Supports:
//    · MP4, WebM, HLS (via <source> tags)
//    · Autoplay muted (safe — no browser block)
//    · Poster image
//    · Loop / controls toggle
//    · Aspect ratio preservation (no CLS)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	useRef,
	useState,
	useCallback,
	useEffect,
	memo,
	type CSSProperties,
} from "react";
import { useInView } from "../hooks/useInView";

// ── Source type ───────────────────────────────────────────────────────────────

export interface VideoSource {
	src: string;
	type?: "video/mp4" | "video/webm" | "application/x-mpegURL" | string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EngineVideoProps {
	/** Single src string or array of <source> objects */
	src: string | VideoSource[];
	/** Poster image shown while video is loading */
	poster?: string;
	/** Aspect ratio CSS value — default "16/9" */
	aspectRatio?: string;
	autoPlay?: boolean;
	muted?: boolean;
	loop?: boolean;
	controls?: boolean;
	playsInline?: boolean;
	preload?: "none" | "metadata" | "auto";
	/** Distance above viewport to start loading. Default: 800px */
	rootMargin?: string;
	/** Skip lazy loading — load immediately (above-fold videos) */
	eager?: boolean;
	className?: string;
	style?: CSSProperties;
	borderRadius?: string;
	/** Called when the video can play */
	onCanPlay?: () => void;
	/** Called when the video ends */
	onEnded?: () => void;
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function VideoSpinner() {
	return (
		<div
			aria-label="Loading video…"
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(0,0,0,0.35)",
			}}
		>
			<svg
				width="48"
				height="48"
				viewBox="0 0 48 48"
				fill="none"
				style={{ animation: "e-spin 0.8s linear infinite" }}
			>
				<circle
					cx="24"
					cy="24"
					r="20"
					stroke="white"
					strokeWidth="4"
					strokeOpacity="0.3"
				/>
				<path
					d="M24 4 A20 20 0 0 1 44 24"
					stroke="white"
					strokeWidth="4"
					strokeLinecap="round"
				/>
			</svg>
		</div>
	);
}

// Inject spin keyframe once
let spinInjected = false;
function injectSpinCSS() {
	if (typeof document === "undefined" || spinInjected) return;
	spinInjected = true;
	const s = document.createElement("style");
	s.textContent = `@keyframes e-spin { to { transform:rotate(360deg) } }`;
	document.head.appendChild(s);
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EngineVideo = memo(function EngineVideo({
	src,
	poster,
	aspectRatio = "16/9",
	autoPlay = false,
	muted = true,
	loop = false,
	controls = true,
	playsInline = true,
	preload = "none",
	rootMargin = "800px 0px",
	eager = false,
	className,
	style,
	borderRadius,
	onCanPlay,
	onEnded,
}: EngineVideoProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [videoReady, setVideoReady] = useState(false);
	const [buffering, setBuffering] = useState(false);

	useEffect(() => {
		injectSpinCSS();
	}, []);

	// Trigger IntersectionObserver — start loading 800px before entry
	const { ref: wrapperRef, inView } = useInView<HTMLDivElement>({
		rootMargin,
		once: true,
		initialInView: eager,
	});

	// When the video element is injected and starts buffering, show spinner
	useEffect(() => {
		if (!inView) return;
		setBuffering(true);
	}, [inView]);

	const handleCanPlay = useCallback(() => {
		setVideoReady(true);
		setBuffering(false);
		onCanPlay?.();
		// Autoplay after buffer if requested
		if (autoPlay && videoRef.current) {
			videoRef.current.play().catch(() => {/* autoplay blocked — silent */});
		}
	}, [autoPlay, onCanPlay]);

	// ── Source resolution ──────────────────────────────────────────────────────

	const sources: VideoSource[] = Array.isArray(src)
		? src
		: [{ src, type: src.endsWith(".webm") ? "video/webm" : "video/mp4" }];

	// ── Render ─────────────────────────────────────────────────────────────────

	const wrapperStyle: CSSProperties = {
		position: "relative",
		width: "100%",
		aspectRatio,
		overflow: "hidden",
		background: "#0a0a0a",
		borderRadius: borderRadius ?? undefined,
		...style,
	};

	return (
		<div ref={wrapperRef} className={className} style={wrapperStyle}>
			{/* Poster image — always shown until video is ready */}
			{poster && !videoReady && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={poster}
					alt="Video thumbnail"
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "cover",
					}}
				/>
			)}

			{/* Buffering spinner */}
			{buffering && !videoReady && <VideoSpinner />}

			{/* Video — only injected into DOM when in-view */}
			{inView && (
				<video
					ref={videoRef}
					muted={muted}
					loop={loop}
					controls={controls}
					playsInline={playsInline}
					preload={preload}
					poster={poster}
					onCanPlay={handleCanPlay}
					onEnded={onEnded}
					onWaiting={() => setBuffering(true)}
					onPlaying={() => setBuffering(false)}
					style={{
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "cover",
						opacity: videoReady ? 1 : 0,
						transition: "opacity 0.4s ease",
					}}
				>
					{sources.map((s, i) => (
						<source key={i} src={s.src} type={s.type} />
					))}
					Your browser does not support HTML5 video.
				</video>
			)}
		</div>
	);
});
