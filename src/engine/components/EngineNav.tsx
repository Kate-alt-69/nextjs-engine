"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Engine — EngineLink
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, memo, type ReactNode } from "react";
import { usePropStyles, cpropClass } from "../hooks/usePropStyles";
import { useHandler } from "../providers/EngineProvider";
import { renderEngineAnchor } from "./EngineNav";
import type { BaseNodeProps } from "../schema/types";
import type { EngineTransitionInput } from "../core/enginetransitions";

export interface EngineLinkConfig {
	href?: string;
	transition?: EngineTransitionInput;
	styles?: React.CSSProperties & Record<string, unknown>;
}

export interface EngineLinkProps extends Omit<BaseNodeProps, "onClick"> {
	children?: ReactNode;
	href?: string;
	target?: string;
	content?: string;
	cprop?: any;
	onClick?: string | React.MouseEventHandler<HTMLAnchorElement>;
}

export const EngineLink = memo(
	forwardRef<HTMLAnchorElement, EngineLinkProps>((props, ref) => {
		const {
			href: basicHref,
			target,
			children,
			content,
			className,
			onClick,
			cprop,
			style,
			...restProps
		} = props;

		const linkConfig: EngineLinkConfig | undefined = cprop?.link;
		const targetHref = linkConfig?.href ?? basicHref ?? "#";
		const compiledStyles = {
			...(cprop?.styles ?? {}),
			...(linkConfig?.styles ?? {}),
			...(style ?? {}),
		};

		const resolvedStyle = usePropStyles(restProps as any, compiledStyles);
		const hoverClass = cpropClass(cprop);
		const finalClass = [hoverClass, className].filter(Boolean).join(" ") || undefined;
		const contextHandler = useHandler(typeof onClick === "string" ? onClick : "");
		const handleClick = (typeof onClick === "function" || contextHandler)
			? (event: React.MouseEvent<HTMLAnchorElement>) => {
				if (typeof onClick === "function") onClick(event);
				else contextHandler?.(event);
			}
			: undefined;

		return renderEngineAnchor({
			href: targetHref,
			target,
			transition: linkConfig?.transition,
			className: finalClass,
			style: resolvedStyle,
			children: content ?? children,
			onClick: handleClick,
			ref,
		});
	}),
);

EngineLink.displayName = "EngineLink";
