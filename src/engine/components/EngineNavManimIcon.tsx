"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EngineManim } from "./EngineManim/EngineManim";
import type { ManimConfig } from "./EngineManim/manimTypes";

interface EngineNavManimIconProps {
	open: boolean;
	size?: number;
}

type Segment = [number, number, number, number];

const CLOSED_SEGMENTS: Segment[] = [
	[4, 6, 18, 6],
	[4, 11, 18, 11],
	[4, 16, 18, 16],
];

const OPEN_SEGMENTS: Segment[] = [
	[5, 5, 17, 17],
	[11, 11, 11, 11],
	[17, 5, 5, 17],
];

function segmentConfig(from: Segment, to: Segment, color: string): ManimConfig {
	return {
		mobjects: [
			{
				id: "from",
				type: "Line",
				x1: from[0],
				y1: from[1],
				x2: from[2],
				y2: from[3],
				strokeColor: color,
				strokeWidth: 1.9,
			},
			{
				id: "to",
				type: "Line",
				x1: to[0],
				y1: to[1],
				x2: to[2],
				y2: to[3],
				strokeColor: color,
				strokeWidth: 1.9,
			},
		],
		timeline: [
			{
				action: "Transform",
				origin: "from",
				target: "to",
				durationMs: 220,
				easing: "ease-in-out",
			},
		],
		settings: {
			loop: false,
			fpsLimit: 60,
			background: "transparent",
		},
	};
}

function StaticMenuIcon({ open, size }: { open: boolean; size: number }) {
	return open ? (
		<svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
			<path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	) : (
		<svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
			<path d="M4 6h14M4 11h14M4 16h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
		</svg>
	);
}

export function EngineNavManimIcon({ open, size = 22 }: EngineNavManimIconProps) {
	const hostRef = useRef<HTMLSpanElement>(null);
	const [strokeColor, setStrokeColor] = useState("rgb(255, 255, 255)");
	const [reduceMotion, setReduceMotion] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const updateMotion = () => setReduceMotion(media.matches);
		updateMotion();
		media.addEventListener?.("change", updateMotion);
		return () => media.removeEventListener?.("change", updateMotion);
	}, []);

	useEffect(() => {
		const updateColor = () => {
			const host = hostRef.current;
			if (!host) return;
			const next = getComputedStyle(host).color;
			if (next) setStrokeColor(next);
		};
		updateColor();
		const observer = new MutationObserver(updateColor);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style", "data-theme", "data-rv-theme"],
		});
		return () => observer.disconnect();
	}, []);

	const configs = useMemo(() => {
		const from = open ? CLOSED_SEGMENTS : OPEN_SEGMENTS;
		const to = open ? OPEN_SEGMENTS : CLOSED_SEGMENTS;
		return from.map((segment, index) => segmentConfig(segment, to[index], strokeColor));
	}, [open, strokeColor]);

	const canvasStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		width: "100%",
		height: "100%",
		pointerEvents: "none",
	};

	return (
		<span
			ref={hostRef}
			aria-hidden="true"
			style={{
				position: "relative",
				display: "block",
				width: size,
				height: size,
				color: "inherit",
			}}
		>
			{reduceMotion ? (
				<StaticMenuIcon open={open} size={size} />
			) : configs.map((config, index) => (
				<EngineManim
					key={`${open ? "open" : "closed"}-${index}-${strokeColor}`}
					cprop={{ manim: config }}
					width={size}
					height={size}
					style={canvasStyle}
				/>
			))}
		</span>
	);
}
