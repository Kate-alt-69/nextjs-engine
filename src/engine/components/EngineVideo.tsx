"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EngineVideo — EngineScheduler-aware video loading
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { useEngineSchedule } from "../hooks/useEngineScheduler";

export interface VideoSource {
	src: string;
	type?: "video/mp4" | "video/webm" | "application/x-mpegURL" | string;
}

export interface EngineVideoProps {
	src: string | VideoSource[];
	poster?: string;
	aspectRatio?: string;
	autoPlay?: boolean;
	muted?: boolean;
	loop?: boolean;
	controls?: boolean;
	playsInline?: boolean;
	preload?: "none" | "metadata" | "auto";
	rootMargin?: string;
	eager?: boolean;
	className?: string;
	style?: CSSProperties;
	borderRadius?: string;
	onCanPlay?: () => void;
	onEnded?: () => void;
}

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
				pointerEvents: "none",
			}}
		>
			<svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ animation: "e-spin 0.8s linear infinite" }}>
				<circle cx="24" cy="24" r="20" stroke="white" strokeWidth="4" strokeOpacity="0.3" />
				<path d="M24 4 A20 20 0 0 1 44 24" stroke="white" strokeWidth="4" strokeLinecap="round" />
			</svg>
		</div>
	);
}

let spinInjected = false;
function injectSpinCSS(): void {
	if (typeof document === "undefined" || spinInjected) return;
	spinInjected = true;
	const style = document.createElement("style");
	style.textContent = `
		@keyframes e-spin { to { transform:rotate(360deg) } }
		@media (prefers-reduced-motion: reduce) {
			[aria-label="Loading video…"] svg { animation: none !important; }
		}
	`;
	document.head.appendChild(style);
}

export const EngineVideo = memo(function EngineVideo({
	src,
	poster,
	aspectRatio = "16/9",
	autoPlay = false,
	muted = true,
	loop = false,
	controls = true,
	playsInline = true,
	preload,
	rootMargin = "800px 0px",
	eager = false,
	className,
	style,
	borderRadius,
	onCanPlay,
	onEnded,
}: EngineVideoProps) {
	const [activated, setActivated] = useState(eager);
	const [videoReady, setVideoReady] = useState(false);
	const [buffering, setBuffering] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const schedule = useEngineSchedule<HTMLDivElement>({
		priority: eager,
		nearMargin: rootMargin,
		releaseWhenFar: true,
	});
	const inView = eager || schedule.visible;

	useEffect(() => {
		injectSpinCSS();
	}, []);

	useEffect(() => {
		if (
			schedule.state === "critical"
			|| schedule.visible
			|| (schedule.near && !schedule.underFramePressure)
		) {
			setActivated(true);
		}
	}, [schedule.near, schedule.state, schedule.underFramePressure, schedule.visible]);

	const resolvedPreload = preload ?? (autoPlay ? "auto" : "metadata");
	const sources = useMemo<VideoSource[]>(() => Array.isArray(src)
		? src
		: [{ src, type: src.endsWith(".webm") ? "video/webm" : "video/mp4" }], [src]);
	const sourceKey = useMemo(() => sources
		.map((source, index) => `${index}\u001f${source.src}\u001f${source.type ?? ""}`)
		.join("\u001e"), [sources]);

	useEffect(() => {
		setVideoReady(false);
		setBuffering(false);
	}, [sourceKey]);

	useEffect(() => {
		if (!inView || !autoPlay) return;
		setBuffering(true);
	}, [autoPlay, inView, sourceKey]);

	useEffect(() => {
		if (!activated || !autoPlay) return;
		const video = videoRef.current;
		if (!video) return;

		if (!inView) {
			video.pause();
			setBuffering(false);
			return;
		}

		const playResult = video.play();
		if (playResult && typeof playResult.catch === "function") {
			void playResult.catch(() => {
				// Browser autoplay policy may reject playback; native controls remain usable.
			});
		}
	}, [activated, autoPlay, inView, sourceKey]);

	const handleCanPlay = useCallback(() => {
		setVideoReady(true);
		setBuffering(false);
		onCanPlay?.();
	}, [onCanPlay]);

	const wrapperStyle: CSSProperties = {
		position: "relative",
		width: "100%",
		aspectRatio,
		overflow: "hidden",
		background: "#0a0a0a",
		borderRadius: borderRadius ?? undefined,
		...style,
	};
	const showExternalPoster = Boolean(poster && !videoReady && (!activated || autoPlay));

	return (
		<div ref={schedule.ref} className={className} style={wrapperStyle}>
			{showExternalPoster && (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={poster}
					alt="Video thumbnail"
					style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
				/>
			)}
			{buffering && !videoReady && <VideoSpinner />}
			{activated && (
				<video
					ref={videoRef}
					key={sourceKey}
					autoPlay={autoPlay}
					muted={muted}
					loop={loop}
					controls={controls}
					playsInline={playsInline}
					preload={resolvedPreload}
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
						opacity: autoPlay ? (videoReady ? 1 : 0) : 1,
						transition: "opacity 0.25s ease",
					}}
				>
					{sources.map((source, index) => (
						<source key={`${source.src}-${index}`} src={source.src} type={source.type} />
					))}
					Your browser does not support HTML5 video.
				</video>
			)}
		</div>
	);
});
