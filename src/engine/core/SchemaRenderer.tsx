"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — SchemaRenderer
//
//  Walks a PageSchema tree and renders each node to React elements.
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, type ReactNode, type CSSProperties } from "react";
import type { SchemaNode, PageSchema } from "../schema/types";
import { getComponent } from "./registry";
import { validatePageSchema } from "./validateSchema";
import { decideLazy } from "./lazyDetect";
import { LazyMount, LazySection } from "../components/LazyMount";
import { useSlot } from "../providers/EngineProvider";

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
	const nodeProps = {
		...originalProps,
		...(Object.keys(extraStyle).length > 0
			? {
				style: {
					...((originalProps.style as CSSProperties) ?? {}),
					...extraStyle,
				},
			}
			: {}),
	};

	// Some existing schemas use props.children for leaf-like primitives such as
	// label. JSX children used to overwrite that value with null whenever the
	// SchemaNode.children field was absent. Preserve it as a backwards-compatible
	// fallback while still giving the real tree-level children field priority.
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
		<LazyMount height={lazy.placeholderHeight} rootMargin={lazy.rootMargin}>
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
