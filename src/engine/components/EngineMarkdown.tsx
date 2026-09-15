"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Engine — legacy/client EngineMarkdown adapter
//
// Gen 3 schema pages render Markdown on the server. This small compatibility
// adapter keeps direct component imports and the existing client style hooks.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, useEffect } from "react";
import type { MarkdownProps } from "../schema/types";
import { useCpropClass } from "../hooks/usePropStyles";
import { usePrimitiveStyles } from "../hooks/usePrimitiveStyles";
import {
	ENGINE_MARKDOWN_CSS,
	EngineMarkdownRenderer,
} from "./EngineMarkdownRenderer";

const MARKDOWN_STYLE_ID = "__engine_md__";
let markdownCssInjected = false;

function injectMarkdownCSS(): void {
	if (typeof document === "undefined") return;
	if (markdownCssInjected || document.getElementById(MARKDOWN_STYLE_ID)) {
		markdownCssInjected = true;
		return;
	}
	markdownCssInjected = true;
	const style = document.createElement("style");
	style.id = MARKDOWN_STYLE_ID;
	style.textContent = ENGINE_MARKDOWN_CSS;
	document.head.appendChild(style);
}

function joinClassNames(...names: Array<string | undefined>): string | undefined {
	return names.filter(Boolean).join(" ") || undefined;
}

export const EngineMarkdown = memo(function EngineMarkdown({
	content = "",
	textColor = "#30475f",
	fontFamily,
	style,
	className,
	id,
	point,
	cprop,
	...props
}: MarkdownProps) {
	useEffect(() => { injectMarkdownCSS(); }, []);
	const resolvedStyle = usePrimitiveStyles(
		{ ...props, fontFamily } as never,
		{
			defaults: {
				display: "grid",
				gap: "1.25rem",
				minWidth: 0,
				color: textColor,
			},
			style,
		},
	);
	const stateClass = useCpropClass(cprop);

	return (
		<EngineMarkdownRenderer
			{...props}
			content={content}
			textColor={textColor}
			fontFamily={fontFamily}
			articleStyle={resolvedStyle}
			articleClassName={joinClassNames(className, stateClass)}
			articleId={id ?? point}
		/>
	);
});
