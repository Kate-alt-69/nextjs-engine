"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineHero
//
//  A dedicated hero section component with:
//    · Three layout variants: centered | split | fullbleed
//    · Overlay gradients and solid colour overlays
//    · CSS parallax backgrounds (with Safari <16 fallback)
//    · Responsive layouts via the engine shorthand prop system
//    · Full BaseNodeProps + SectionProps + HeroProps passthrough
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	forwardRef,
	memo,
	useEffect,
	useRef,
	type ReactNode,
	type CSSProperties,
} from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import type { HeroProps } from "../schema/types";

// ── EngineHero ────────────────────────────────────────────────────────────────

export interface EngineHeroProps extends HeroProps {
	children?: ReactNode;
}

export const EngineHero = memo(
	forwardRef<HTMLElement, EngineHeroProps>(function EngineHero(
		{
			children,
			variant       = "centered",
			overlay,
			parallax      = false,
			contentMaxWidth = "1200px",
			centered      = true,
			fullViewport  = true,
			snapAlign,
			style,
			className,
			id,
			point,
			href,
			cprop,
			// Extract px / py so the outer section doesn't receive padding —
			// they are applied only to the inner content container.
			px,
			py,
			// Extract background props so we can control them alongside
			// the parallax backgroundAttachment flag.
			backgroundImage,
			backgroundSize,
			backgroundPosition,
			backgroundRepeat,
			...props
		},
		ref,
	) {
		// ── Parallax scroll effect ────────────────────────────────────────────
		// Uses a passive scroll listener that adjusts backgroundPositionY.
		// Pure CSS `background-attachment: fixed` is used as the primary
		// mechanism but we supplement with JS for smoother results.
		// Disabled on Safari < 16 where `background-attachment: fixed` is
		// unreliable inside overflow:hidden containers.
		const heroRef = useRef<HTMLElement | null>(null);

		useEffect(() => {
			if (!parallax) return;

			const el =
				(ref as React.RefObject<HTMLElement>)?.current ?? heroRef.current;
			if (!el) return;

			// Safari < 16 detection — disable JS parallax on those versions.
			const ua = navigator.userAgent;
			const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
			const safariVersion = isSafari
				? parseInt((ua.match(/version\/(\d+)/i)?.[1]) ?? "99", 10)
				: 99;
			if (isSafari && safariVersion < 16) return;

			const onScroll = () => {
				const rect   = el.getBoundingClientRect();
				const offset = rect.top * 0.3;
				el.style.backgroundPositionY = `calc(50% + ${offset}px)`;
			};

			window.addEventListener("scroll", onScroll, { passive: true });
			return () => window.removeEventListener("scroll", onScroll);
		}, [parallax, ref]);

		// ── Merged ref handler ────────────────────────────────────────────────
		const handleRef = (el: HTMLElement | null) => {
			(heroRef as React.MutableRefObject<HTMLElement | null>).current = el;
			if (typeof ref === "function") ref(el);
			else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = el;
		};

		// ── Outer section styles ──────────────────────────────────────────────
		const sectionBase: CSSProperties = {
			position : "relative",
			width    : "100%",
			overflow : "hidden",
			...(fullViewport ? { minHeight: "100svh" } : {}),
			...(snapAlign   ? { scrollSnapAlign: snapAlign } : {}),
			// Background image — parallax uses CSS fixed attachment as baseline
			...(backgroundImage
				? {
					backgroundImage,
					backgroundSize     : backgroundSize     ?? "cover",
					backgroundPosition : backgroundPosition ?? "center",
					backgroundRepeat   : backgroundRepeat   ?? "no-repeat",
					...(parallax ? { backgroundAttachment: "fixed" } : {}),
				  }
				: {}),
		};

		// ── Inner content container styles ────────────────────────────────────
		const innerBase: CSSProperties = {
			position : "relative",
			zIndex   : 1,
			width    : "100%",
		};

		// maxWidth is skipped for fullbleed — content spans the entire width.
		if (variant !== "fullbleed") {
			innerBase.maxWidth = typeof contentMaxWidth === "number"
				? `${contentMaxWidth}px`
				: (contentMaxWidth as CSSProperties["maxWidth"]);
		}

		if (centered && variant !== "fullbleed") {
			innerBase.marginLeft  = "auto";
			innerBase.marginRight = "auto";
		}

		// Variant-specific layout
		if (variant === "centered") {
			innerBase.display       = "flex";
			innerBase.flexDirection = "column";
			innerBase.alignItems    = "center";
			innerBase.textAlign     = "center";
		} else if (variant === "split") {
			innerBase.display = "grid";
			(innerBase as Record<string, unknown>).gridTemplateColumns = "1fr 1fr";
			innerBase.gap     = "4rem";
			innerBase.alignItems = "center";
		}
		// fullbleed: no layout constraints — children fill freely

		// ── Padding for inner container ───────────────────────────────────────
		// Use usePropStyles for the inner container so responsive px/py values
		// work correctly via the engine's CSS-var responsive system.
		const resolvedInner = usePropStyles(
			{
				px: px ?? (variant === "fullbleed" ? "0" : "1.5rem"),
				py: py ?? "6rem",
			} as any,
			innerBase,
		);

		// ── Outer section — engine prop resolution ────────────────────────────
		const resolvedOuter = usePropStyles(props as any, { ...sectionBase, ...style });
		const hoverClass    = cpropClass(cprop);
		const mergedClass   = [className, hoverClass].filter(Boolean).join(" ") || undefined;
		const resolvedId    = id ?? point;

		// ── Render ────────────────────────────────────────────────────────────
		const element = (
			<section
				ref={handleRef}
				id={resolvedId}
				className={mergedClass}
				style={resolvedOuter}
			>
				{/* Overlay layer — rendered below content (z-index 0) */}
				{overlay && (
					<div
						aria-hidden="true"
						style={{
							position     : "absolute",
							inset        : 0,
							background   : overlay,
							zIndex       : 0,
							pointerEvents: "none",
						}}
					/>
				)}

				{/* Content layer — always above overlay */}
				<div style={resolvedInner}>{children}</div>
			</section>
		);

		// Respect the same href-wrapping convention as other engine primitives
		if (href) {
			const isExternal = /^https?:\/\//.test(href);
			return (
				<a
					href={href}
					target={isExternal ? "_blank" : undefined}
					rel={isExternal ? "noopener noreferrer" : undefined}
					style={{ display: "contents", textDecoration: "none", color: "inherit" }}
				>
					{element}
				</a>
			);
		}

		return element;
	}),
);
