"use client";

import NextLink from "next/link";
import React, { forwardRef, memo, useRef, type CSSProperties, type ReactNode } from "react";
import { useEngineTransitions, type EngineTransitionInput } from "../core/enginetransitions";

export interface EngineExpandLinkProps {
	href: string;
	sourceId?: string;
	duration?: number;
	endRadius?: string;
	transition?: EngineTransitionInput;
	target?: string;
	className?: string;
	children?: ReactNode;
	style?: CSSProperties;
	onClick?: React.MouseEventHandler<HTMLAnchorElement>;
	"aria-label"?: string;
	"aria-current"?: React.AriaAttributes["aria-current"];
	id?: string;
}

function shouldKeepNativeClick(event: React.MouseEvent<HTMLAnchorElement>, target?: string): boolean {
	return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
		|| (target !== undefined && target !== "_self");
}

function animationDone(animation: Animation): Promise<void> {
	return animation.finished.then(() => undefined).catch(() => undefined);
}

/**
 * Expands an existing visual surface to the viewport before handing navigation
 * to EngineTransitions. This gives card/detail interfaces a deterministic
 * cross-browser "open into page" motion without depending on shared-element
 * ViewTransition support.
 */
export const EngineExpandLink = memo(
	forwardRef<HTMLAnchorElement, EngineExpandLinkProps>((props, ref) => {
		const {
			href,
			sourceId,
			duration = 420,
			endRadius = "0px",
			transition = { type: "fade", duration: 220, easing: "ease-out" },
			target,
			className,
			children,
			style,
			onClick,
			"aria-label": ariaLabel,
			"aria-current": ariaCurrent,
			id,
		} = props;
		const transitions = useEngineTransitions();
		const running = useRef(false);

		const handleClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
			onClick?.(event);
			if (event.defaultPrevented || shouldKeepNativeClick(event, target) || running.current) return;
			event.preventDefault();

			const source = sourceId ? document.getElementById(sourceId) : event.currentTarget;
			const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
			if (!(source instanceof HTMLElement) || reduced || typeof source.animate !== "function") {
				void transitions.push(href, transition, { pointer: { x: event.clientX, y: event.clientY } });
				return;
			}

			running.current = true;
			const rect = source.getBoundingClientRect();
			const computed = window.getComputedStyle(source);
			const placeholder = document.createElement("div");
			placeholder.setAttribute("aria-hidden", "true");
			placeholder.style.width = `${rect.width}px`;
			placeholder.style.height = `${rect.height}px`;
			placeholder.style.visibility = "hidden";
			source.parentNode?.insertBefore(placeholder, source);

			const previous = source.getAttribute("style") ?? "";
			source.style.setProperty("position", "fixed", "important");
			source.style.setProperty("top", `${rect.top}px`, "important");
			source.style.setProperty("left", `${rect.left}px`, "important");
			source.style.setProperty("width", `${rect.width}px`, "important");
			source.style.setProperty("height", `${rect.height}px`, "important");
			source.style.setProperty("margin", "0", "important");
			source.style.setProperty("z-index", "2147483000", "important");
			source.style.setProperty("transform", "translateZ(0)", "important");
			source.style.setProperty("transform-origin", "center center", "important");
			source.style.setProperty("transition", "none", "important");
			source.style.setProperty("overflow", "hidden", "important");
			source.style.setProperty("will-change", "top,left,width,height,border-radius,box-shadow", "important");

			const viewport = window.visualViewport;
			const top = viewport?.offsetTop ?? 0;
			const left = viewport?.offsetLeft ?? 0;
			const width = viewport?.width ?? window.innerWidth;
			const height = viewport?.height ?? window.innerHeight;
			const safeDuration = Math.max(240, Math.min(900, Number.isFinite(duration) ? duration : 420));

			const expand = source.animate([
				{
					top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`,
					borderRadius: computed.borderRadius || "0px", boxShadow: computed.boxShadow,
				},
				{
					top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px`,
					borderRadius: endRadius, boxShadow: "0 32px 96px rgb(0 0 0 / .20)",
				},
			], { duration: safeDuration, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });

			void (async () => {
				try {
					await animationDone(expand);
					await transitions.push(href, transition, { pointer: { x: event.clientX, y: event.clientY } });
				} finally {
					placeholder.remove();
					if (source.isConnected) source.setAttribute("style", previous);
					running.current = false;
				}
			})();
		};

		return (
			<NextLink
				ref={ref}
				id={id}
				href={href}
				target={target}
				className={className}
				style={style}
				onClick={handleClick}
				aria-label={ariaLabel}
				aria-current={ariaCurrent}
			>
				{children}
			</NextLink>
		);
	}),
);

EngineExpandLink.displayName = "EngineExpandLink";
