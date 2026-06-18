"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineLink
//
//  Styled anchor primitive. Routing logic (external / page-to-page / native)
//  lives in EngineNav → renderEngineAnchor — EngineLink delegates entirely.
// ─────────────────────────────────────────────────────────────────────────────

import React, { forwardRef, memo, type ReactNode } from "react";
import { usePropStyles, cpropClass }               from "../hooks/usePropStyles";
import { useHandler }                              from "../providers/EngineProvider";
import { renderEngineAnchor }                      from "./EngineNav";
import type { BaseNodeProps }                      from "../schema/types";

export interface EngineLinkConfig {
	href?:       string;
	transition?: "page-to-page" | "instant" | string;
	styles?:     React.CSSProperties & Record<string, unknown>;
}

export interface EngineLinkProps extends Omit<BaseNodeProps, "onClick"> {
	children?:  ReactNode;
	href?:      string;
	target?:    string;
	content?:   string;
	cprop?:     any;
	onClick?:   string | React.MouseEventHandler<HTMLAnchorElement>;
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
			...restProps
		} = props;

		const linkConfig: EngineLinkConfig | undefined = cprop?.link;

		// Fallback resolution cascade
		const targetHref = linkConfig?.href ?? basicHref ?? "#";

		// Style resolution
		const compiledStyles = {
			...(cprop?.styles  ?? {}),
			...(linkConfig?.styles ?? {}),
		};

		const resolvedStyle = usePropStyles(props as any, compiledStyles);
		const hoverClass    = cpropClass(cprop);
		const finalClass    = [resolvedStyle, hoverClass, className].filter(Boolean).join(" ") || undefined;

		// Handler resolution
		const contextHandler = useHandler(typeof onClick === "string" ? onClick : "");
		const handleClick    = (typeof onClick === "function" || contextHandler)
			? (e: React.MouseEvent<HTMLAnchorElement>) => {
				if (typeof onClick === "function") onClick(e);
				else contextHandler?.(e);
			}
			: undefined;

		// Delegate entirely to EngineNav's shared routing pipeline
		return renderEngineAnchor({
			href:       targetHref,
			target,
			transition: linkConfig?.transition,
			className:  finalClass,
			children:   content ?? children,
			onClick:    handleClick,
			ref,
		});
	}),
);

EngineLink.displayName = "EngineLink";
