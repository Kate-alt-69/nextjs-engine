"use client";

import React, { memo, type CSSProperties } from "react";
import {
	normalizeEngineUrlIconSize,
	resolveEngineFaviconUrl,
	type EngineUrlIconSize,
} from "../core/engineUrlIcon";

export interface EngineUrlIconProps {
	href: string;
	size?: EngineUrlIconSize;
	className?: string;
	style?: CSSProperties;
}

/**
 * Small opt-in favicon for an external URL.
 * The domain-only provider request has a stable URL that can be HTTP-cached.
 */
export const EngineUrlIcon = memo(function EngineUrlIcon({
	href,
	size = "auto",
	className,
	style,
}: EngineUrlIconProps) {
	const src = resolveEngineFaviconUrl(href, size);
	if (!src) return null;

	const renderedSize = normalizeEngineUrlIconSize(size);
	const dimension = typeof renderedSize === "number" ? renderedSize : 16;
	return (
		<img
			src={src}
			alt=""
			aria-hidden="true"
			data-engine-url-icon=""
			width={dimension}
			height={dimension}
			loading="lazy"
			decoding="async"
			referrerPolicy="no-referrer"
			draggable={false}
			className={className}
			style={{
				display: "inline-block",
				flex: "0 0 auto",
				width: renderedSize,
				height: renderedSize,
				objectFit: "contain",
				verticalAlign: "-0.125em",
				marginInlineEnd: "0.32em",
				...style,
			}}
		/>
	);
});

EngineUrlIcon.displayName = "EngineUrlIcon";
