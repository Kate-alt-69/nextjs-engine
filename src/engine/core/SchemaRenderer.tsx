"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — SchemaRenderer
//
//  Walks a PageSchema tree and renders each node to React elements.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, type ReactNode, type CSSProperties } from "react";
import {
	BREAKPOINTS,
	BREAKPOINT_ORDER,
	type Breakpoint,
	type SchemaNode,
	type PageSchema,
} from "../schema/types";
import { getComponent } from "./registry";
import { validatePageSchema } from "./validateSchema";
import { decideLazy } from "./lazyDetect";
import { LazyMount, LazySection } from "../components/LazyMount";
import { useSlot } from "../providers/EngineProvider";
import { mediaClass } from "../hooks/usePropStyles";

function UnknownNodeWarning({ type }: { type: string }) {
	if (process.env.NODE_ENV === "production") return null;
	return (
		<div
			style={{
				border: "2px dashed #f59e0b",
				borderRadius: "6px",
				padding: "0.75rem 1rem",
				background: "#fffbeb",
				color: "#92400e",
				fontFamily: "monospace",
				fontSize: "0.8rem",
			}}
		>
			⚠ Engine: Unknown node type <strong>"{type}"</strong> — register it with{" "}
			<code>registerComponent("{type}", YourComponent)</code>
		</div>
	);
}

function SlotNode({ name, fallback, depth }: { name: string; fallback?: SchemaNode; depth: number }) {
	const slotContent = useSlot(name);
	if (slotContent != null) return <>{slotContent}</>;
	if (fallback) return <NodeRenderer node={fallback} depth={depth} />;
	return null;
}

function buildVisibilityClass(props: Record<string, unknown>): string | undefined {
	const hideOn = Array.isArray(props.hideOn) ? props.hideOn as Breakpoint[] : [];
	const showOnly = Array.isArray(props.showOnly) ? props.showOnly as Breakpoint[] : [];
	if (hideOn.length === 0 && showOnly.length === 0) return undefined;

	const isVisible = (breakpoint: Breakpoint): boolean => {
		const allowedByShowOnly = showOnly.length === 0 || showOnly.includes(breakpoint);
		return allowedByShowOnly && !hideOn.includes(breakpoint);
	};

	const baseStyle: CSSProperties = { display: isVisible("xs") ? "revert" : "none" };
	const responsiveStyles = BREAKPOINT_ORDER
		.filter((breakpoint) => breakpoint !== "xs")
		.map((breakpoint) => [
			`${BREAKPOINTS[breakpoint]}px`,
			{ display: isVisible(breakpoint) ? "revert" : "none" } as CSSProperties,
		] as [string, CSSProperties]);

	return mediaClass(baseStyle, ...responsiveStyles);
}

interface NodeRendererProps {
	node: SchemaNode;
	depth: number;
}

function NodeRenderer({ node, depth }: NodeRendererProps) {
	if (node.type === "slot") {
		const props = (node.props ?? {}) as { name?: string; fallback?: SchemaNode };
		return (
			<SlotNode
				name={props.name ?? ""}
				fallback={props.fallback}
				depth={depth}
			/>
		);
	}

	let renderedChildren: ReactNode = null;
	const hasTreeChildren = node.children !== undefined;

	if (typeof node.children === "string") {
		renderedChildren = node.children;
	} else if (Array.isArray(node.children) && node.children.length > 0) {
		renderedChildren = node.children.map((child, index) => (
			<NodeRenderer
				key={child.key ?? `${child.type}-${index}`}
				node={child}
				depth={depth + 1}
			/>
		));
	}

	const Component = getComponent(node.type);
	if (!Component) return <UnknownNodeWarning type={node.type} />;

	const lazy = decideLazy(node, depth);
	const extraStyle: CSSProperties = lazy.contentVisibility && !lazy.lazy
		? {
			contentVisibility: "auto" as CSSProperties["contentVisibility"],
			containIntrinsicHeight: lazy.placeholderHeight,
		}
		: {};

	const originalProps = node.props ?? {};
	const visibilityClass = buildVisibilityClass(originalProps);
	const originalClassName = typeof originalProps.className === "string" ? originalProps.className : undefined;
	const mergedClassName = [originalClassName, visibilityClass].filter(Boolean).join(" ") || undefined;
	const nodeProps = {
		...originalProps,
		...(mergedClassName ? { className: mergedClassName } : {}),
		...(Object.keys(extraStyle).length > 0
			? {
				style: {
					...((originalProps.style as CSSProperties) ?? {}),
					...extraStyle,
				},
			}
			: {}),
	};

	const effectiveChildren = hasTreeChildren
		? renderedChildren
		: (originalProps.children as ReactNode | undefined) ?? null;

	const element = (
		<Component {...nodeProps}>
			{effectiveChildren}
		</Component>
	);

	if (!lazy.lazy) return element;

	const isSection = node.type === "section" || node.type === "hero";
	if (isSection) {
		return (
			<LazySection
				className={visibilityClass}
				height={lazy.placeholderHeight}
				rootMargin={lazy.rootMargin}
				contentVisibility={lazy.contentVisibility}
				containIntrinsicHeight={lazy.placeholderHeight}
			>
				{element}
			</LazySection>
		);
	}

	return (
		<LazyMount
			className={visibilityClass}
			height={lazy.placeholderHeight}
			rootMargin={lazy.rootMargin}
		>
			{element}
		</LazyMount>
	);
}

interface SchemaRendererProps {
	schema: PageSchema;
}

export const SchemaRenderer = memo(function SchemaRenderer({ schema }: SchemaRendererProps) {
	if (
		process.env.NODE_ENV !== "production" ||
		process.env.NEXT_PUBLIC_ENGINE_VALIDATE === "1"
	) {
		validatePageSchema(schema);
	}

	return <NodeRenderer node={schema.root} depth={0} />;
});
