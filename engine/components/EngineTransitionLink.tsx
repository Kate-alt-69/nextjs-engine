"use client";

import React, { forwardRef, memo, type CSSProperties, type ReactNode } from "react";
import NextLink from "next/link";
import {
	resolveEngineTransition,
	useEngineTransitions,
	type EngineTransitionInput,
} from "../core/enginetransitions";

export interface EngineTransitionLinkProps {
	href: string;
	transition: EngineTransitionInput;
	target?: string;
	className?: string;
	children?: ReactNode;
	onClick?: React.MouseEventHandler<HTMLAnchorElement>;
	style?: CSSProperties;
	"aria-label"?: string;
	"aria-current"?: React.AriaAttributes["aria-current"];
}

function shouldKeepNativeClick(event: React.MouseEvent<HTMLAnchorElement>, target?: string): boolean {
	return event.button !== 0
		|| event.metaKey
		|| event.ctrlKey
		|| event.shiftKey
		|| event.altKey
		|| (target !== undefined && target !== "_self");
}

function isHashOnlyNavigation(href: string): boolean {
	try {
		const nextUrl = new URL(href, window.location.href);
		const currentUrl = new URL(window.location.href);
		return nextUrl.origin === currentUrl.origin
			&& nextUrl.pathname === currentUrl.pathname
			&& nextUrl.search === currentUrl.search
			&& nextUrl.hash !== currentUrl.hash;
	} catch {
		return false;
	}
}

export const EngineTransitionLink = memo(
	forwardRef<HTMLAnchorElement, EngineTransitionLinkProps>((props, ref) => {
		const {
			href,
			transition,
			target,
			className,
			children,
			onClick,
			style,
			"aria-label": ariaLabel,
			"aria-current": ariaCurrent,
		} = props;
		const transitions = useEngineTransitions();

		const handleClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
			onClick?.(event);
			if (event.defaultPrevented || shouldKeepNativeClick(event, target)) return;

			const resolved = resolveEngineTransition(transition, {
				pointer: { x: event.clientX, y: event.clientY },
			});
			if (resolved.type === "instant" || isHashOnlyNavigation(href)) return;

			event.preventDefault();
			void transitions.push(href, transition, {
				pointer: { x: event.clientX, y: event.clientY },
			});
		};

		return (
			<NextLink
				ref={ref}
				href={href}
				target={target}
				className={className}
				onClick={handleClick}
				style={style}
				aria-label={ariaLabel}
				aria-current={ariaCurrent}
			>
				{children}
			</NextLink>
		);
	}),
);

EngineTransitionLink.displayName = "EngineTransitionLink";
