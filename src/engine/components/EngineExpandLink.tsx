"use client";

import NextLink from "next/link";
import React, { forwardRef, memo, useRef, type CSSProperties, type ReactNode } from "react";
import { useEngineTransitions, type EngineTransitionInput } from "../core/enginetransitions";

export interface EngineExpandLinkProps {
	href: string;
	/** Existing DOM surface to visually expand. Defaults to this link. */
	sourceId?: string;
	/** Destination surface revealed during the final cross-fade. */
	targetId?: string;
	/** Optional media subtree that should stretch to cover the expanding surface. */
	mediaSelector?: string;
	/** Optional detail subtree that should fade away while the visual surface expands. */
	fadeSelector?: string;
	duration?: number;
	handoffDuration?: number;
	endRadius?: string;
	/** NE still owns navigation; instant is best when the expand animation owns the route change. */
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

let activeCleanup: (() => void) | null = null;

function shouldKeepNativeClick(event: React.MouseEvent<HTMLAnchorElement>, target?: string): boolean {
	return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
		|| (target !== undefined && target !== "_self");
}

function animationDone(animation: Animation | null): Promise<void> {
	return animation ? animation.finished.then(() => undefined).catch(() => undefined) : Promise.resolve();
}

function important(element: HTMLElement, property: string, value: string): void {
	element.style.setProperty(property, value, "important");
}

function neutralizeClone(root: HTMLElement): void {
	root.removeAttribute("id");
	root.setAttribute("aria-hidden", "true");
	root.querySelectorAll<HTMLElement>("[id]").forEach((node) => node.removeAttribute("id"));
	root.querySelectorAll<HTMLElement>("a,button,input,select,textarea,[tabindex]").forEach((node) => {
		node.setAttribute("tabindex", "-1");
		node.style.pointerEvents = "none";
	});
}

function viewportRect() {
	const viewport = window.visualViewport;
	return {
		top: viewport?.offsetTop ?? 0,
		left: viewport?.offsetLeft ?? 0,
		width: viewport?.width ?? window.innerWidth,
		height: viewport?.height ?? window.innerHeight,
	};
}

function pageBackground(): string {
	const body = window.getComputedStyle(document.body).backgroundColor;
	if (body && body !== "rgba(0, 0, 0, 0)" && body !== "transparent") return body;
	const root = window.getComputedStyle(document.documentElement).backgroundColor;
	return root && root !== "rgba(0, 0, 0, 0)" && root !== "transparent" ? root : "#07110e";
}

function prepareMediaCover(root: HTMLElement, selector?: string): void {
	if (!selector) return;
	root.querySelectorAll<HTMLElement>(selector).forEach((surface) => {
		important(surface, "position", "absolute");
		important(surface, "inset", "0");
		important(surface, "width", "100%");
		important(surface, "height", "100%");
		important(surface, "aspect-ratio", "auto");
		important(surface, "border-radius", "inherit");
		surface.querySelectorAll<HTMLElement>("picture,.e-img-wrap,img,video").forEach((media) => {
			important(media, "width", "100%");
			important(media, "height", "100%");
			important(media, "max-width", "none");
			if (media instanceof HTMLImageElement || media instanceof HTMLVideoElement) {
				important(media, "object-fit", "cover");
			}
		});
	});
}

async function waitForTarget(id: string | undefined, timeoutMs = 1000): Promise<HTMLElement | null> {
	if (!id) return null;
	const existing = document.getElementById(id);
	if (existing instanceof HTMLElement) return existing;
	return new Promise((resolve) => {
		let settled = false;
		const finish = (element: HTMLElement | null) => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			window.clearTimeout(timeout);
			resolve(element);
		};
		const observer = new MutationObserver(() => {
			const next = document.getElementById(id);
			if (next instanceof HTMLElement) finish(next);
		});
		observer.observe(document.documentElement, { childList: true, subtree: true });
		const timeout = window.setTimeout(() => {
			const next = document.getElementById(id);
			finish(next instanceof HTMLElement ? next : null);
		}, timeoutMs);
	});
}

/**
 * Cross-browser card -> page expansion.
 *
 * A visual clone survives the React route swap, so Firefox gets the same
 * spatial handoff as Chromium without depending on the native View Transition
 * API. NE still owns navigation and reduced-motion fallback.
 */
export const EngineExpandLink = memo(
	forwardRef<HTMLAnchorElement, EngineExpandLinkProps>((props, ref) => {
		const {
			href,
			sourceId,
			targetId,
			mediaSelector = "[data-engine-expand-media]",
			fadeSelector = "[data-engine-expand-detail]",
			duration = 460,
			handoffDuration = 240,
			endRadius = "0px",
			transition = "instant",
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
			activeCleanup?.();
			const rect = source.getBoundingClientRect();
			const computed = window.getComputedStyle(source);
			const previousVisibility = source.style.visibility;
			const clone = source.cloneNode(true) as HTMLElement;
			neutralizeClone(clone);
			prepareMediaCover(clone, mediaSelector);

			important(clone, "position", "fixed");
			important(clone, "top", `${rect.top}px`);
			important(clone, "left", `${rect.left}px`);
			important(clone, "width", `${rect.width}px`);
			important(clone, "height", `${rect.height}px`);
			important(clone, "margin", "0");
			important(clone, "z-index", "2147483001");
			important(clone, "pointer-events", "none");
			important(clone, "overflow", "hidden");
			important(clone, "box-sizing", "border-box");
			important(clone, "transform", "translateZ(0)");
			important(clone, "transform-origin", "center center");
			important(clone, "transition", "none");
			important(clone, "animation", "none");
			important(clone, "border-radius", computed.borderRadius || "0px");
			important(clone, "will-change", "top,left,width,height,border-radius,opacity,transform");

			const scrim = document.createElement("div");
			scrim.setAttribute("aria-hidden", "true");
			important(scrim, "position", "fixed");
			important(scrim, "inset", "0");
			important(scrim, "z-index", "2147483000");
			important(scrim, "pointer-events", "none");
			important(scrim, "background", pageBackground());
			important(scrim, "opacity", "0");

			document.body.append(scrim, clone);
			source.style.visibility = "hidden";

			let cleaned = false;
			const cleanup = () => {
				if (cleaned) return;
				cleaned = true;
				clone.remove();
				scrim.remove();
				if (source.isConnected) source.style.visibility = previousVisibility;
				running.current = false;
				if (activeCleanup === cleanup) activeCleanup = null;
			};
			activeCleanup = cleanup;

			const view = viewportRect();
			const safeDuration = Math.max(260, Math.min(900, Number.isFinite(duration) ? duration : 460));
			const safeHandoff = Math.max(120, Math.min(500, Number.isFinite(handoffDuration) ? handoffDuration : 240));
			const pointer = { x: event.clientX, y: event.clientY };
			const easing = "cubic-bezier(.16,1,.3,1)";

			const expand = clone.animate([
				{
					top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`,
					borderRadius: computed.borderRadius || "0px", transform: "translateZ(0) scale(1)",
				},
				{
					top: `${view.top}px`, left: `${view.left}px`, width: `${view.width}px`, height: `${view.height}px`,
					borderRadius: endRadius, transform: "translateZ(0) scale(1)",
				},
			], { duration: safeDuration, easing, fill: "forwards" });
			const oldPageFade = scrim.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: Math.min(280, safeDuration), easing: "ease-in", fill: "forwards",
			});
			const detailFades = fadeSelector
				? [...clone.querySelectorAll<HTMLElement>(fadeSelector)].map((detail) => detail.animate(
					[{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(8px)" }],
					{ duration: Math.min(220, safeDuration * .55), easing: "ease-in", fill: "forwards" },
				))
				: [];

			void (async () => {
				try {
					await Promise.all([animationDone(expand), animationDone(oldPageFade), ...detailFades.map(animationDone)]);
					await transitions.push(href, transition, { pointer });
					const destination = await waitForTarget(targetId, 1100);
					const destinationIn = destination?.animate([
						{ opacity: .3, transform: "scale(1.012)" },
						{ opacity: 1, transform: "scale(1)" },
					], { duration: safeHandoff, easing: "cubic-bezier(.22,.8,.25,1)", fill: "both" }) ?? null;
					const cloneOut = clone.animate([{ opacity: 1 }, { opacity: 0 }], {
						duration: safeHandoff, easing: "ease-in-out", fill: "forwards",
					});
					const scrimOut = scrim.animate([{ opacity: 1 }, { opacity: 0 }], {
						duration: safeHandoff, easing: "ease-in-out", fill: "forwards",
					});
					await Promise.all([animationDone(destinationIn), animationDone(cloneOut), animationDone(scrimOut)]);
				} finally {
					cleanup();
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
