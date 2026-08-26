"use client";
// ─────────────────────────────────────────────────────────────────────────────
// EngineHero
// ─────────────────────────────────────────────────────────────────────────────

import React, {
	forwardRef,
	memo,
	useEffect,
	useRef,
	type CSSProperties,
	type ReactNode,
} from "react";
import { cpropClass, usePropStyles } from "../hooks/usePropStyles";
import type { HeroProps } from "../schema/types";

export interface EngineHeroProps extends HeroProps {
	children?: ReactNode;
}

export const EngineHero = memo(
	forwardRef<HTMLElement, EngineHeroProps>(function EngineHero(
		{
			children,
			variant = "centered",
			overlay,
			parallax = false,
			contentMaxWidth = "1200px",
			centered = true,
			fullViewport = true,
			snapAlign,
			style,
			className,
			id,
			point,
			href,
			cprop,
			px,
			py,
			backgroundImage,
			backgroundSize,
			backgroundPosition,
			backgroundRepeat,
			...props
		},
		ref,
	) {
		const heroRef = useRef<HTMLElement | null>(null);

		useEffect(() => {
			if (!parallax) return;
			const element = heroRef.current;
			if (!element) return;

			const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
			if (reducedMotion?.matches) return;

			const userAgent = navigator.userAgent;
			const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
			const safariVersion = isSafari
				? parseInt((userAgent.match(/version\/(\d+)/i)?.[1]) ?? "99", 10)
				: 99;
			if (isSafari && safariVersion < 16) return;

			const originalBackgroundPositionY = element.style.backgroundPositionY;
			let animationFrame = 0;
			let nearViewport = true;

			const updateParallax = (): void => {
				animationFrame = 0;
				if (!nearViewport) return;
				const offset = element.getBoundingClientRect().top * 0.3;
				element.style.backgroundPositionY = `calc(50% + ${offset}px)`;
			};

			const requestUpdate = (): void => {
				if (!nearViewport || animationFrame !== 0) return;
				animationFrame = requestAnimationFrame(updateParallax);
			};

			let observer: IntersectionObserver | undefined;
			if (typeof IntersectionObserver !== "undefined") {
				observer = new IntersectionObserver(([entry]) => {
					nearViewport = entry.isIntersecting;
					if (nearViewport) requestUpdate();
				}, { rootMargin: "300px 0px" });
				observer.observe(element);
			}

			requestUpdate();
			window.addEventListener("scroll", requestUpdate, { passive: true });
			return () => {
				window.removeEventListener("scroll", requestUpdate);
				observer?.disconnect();
				if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
				element.style.backgroundPositionY = originalBackgroundPositionY;
			};
		}, [parallax]);

		const handleRef = (element: HTMLElement | null): void => {
			heroRef.current = element;
			if (typeof ref === "function") ref(element);
			else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = element;
		};

		const sectionBase: CSSProperties = {
			position: "relative",
			width: "100%",
			overflow: "hidden",
			...(fullViewport ? { minHeight: "100svh" } : {}),
			...(snapAlign ? { scrollSnapAlign: snapAlign } : {}),
		};

		const innerBase: CSSProperties = {
			position: "relative",
			zIndex: 1,
			width: "100%",
		};

		if (centered && variant !== "fullbleed") {
			innerBase.marginLeft = "auto";
			innerBase.marginRight = "auto";
		}

		if (variant === "centered") {
			innerBase.display = "flex";
			innerBase.flexDirection = "column";
			innerBase.alignItems = "center";
			innerBase.textAlign = "center";
		} else if (variant === "split") {
			innerBase.display = "grid";
			innerBase.alignItems = "center";
		}

		const resolvedInner = usePropStyles(
			{
				px: px ?? (variant === "fullbleed" ? "0" : "1.5rem"),
				py: py ?? "6rem",
				...(variant !== "fullbleed" ? { maxW: contentMaxWidth } : {}),
				...(variant === "split"
					? {
						columns: { xs: 1, md: 2 },
						gap: { xs: "2rem", lg: "4rem" },
					}
					: {}),
			} as any,
			innerBase,
		);

		// Background controls are routed through usePropStyles so breakpoint maps
		// compile to CSS variables instead of being forced into CSSProperties.
		const resolvedOuter = usePropStyles(
			{
				...props,
				backgroundImage,
				backgroundSize: backgroundImage ? (backgroundSize ?? "cover") : backgroundSize,
				backgroundPosition: backgroundImage ? (backgroundPosition ?? "center") : backgroundPosition,
				backgroundRepeat: backgroundImage ? (backgroundRepeat ?? "no-repeat") : backgroundRepeat,
				...(backgroundImage && parallax ? { backgroundAttachment: "fixed" } : {}),
			} as any,
			{ ...sectionBase, ...style },
		);
		const hoverClass = cpropClass(cprop);
		const mergedClass = [className, hoverClass].filter(Boolean).join(" ") || undefined;
		const resolvedId = id ?? point;

		const element = (
			<section ref={handleRef} id={resolvedId} className={mergedClass} style={resolvedOuter}>
				{overlay && (
					<div
						aria-hidden="true"
						style={{
							position: "absolute",
							inset: 0,
							background: overlay,
							zIndex: 0,
							pointerEvents: "none",
						}}
					/>
				)}
				<div style={resolvedInner}>{children}</div>
			</section>
		);

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
