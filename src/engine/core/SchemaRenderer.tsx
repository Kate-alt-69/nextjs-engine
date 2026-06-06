"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — SchemaRenderer
//
//  Walks a PageSchema tree and renders each node to React elements.
//
//  Per-node pipeline:
//    1. Look up the component in the registry
//    2. Run lazyDetect() to decide if the node needs lazy mounting
//    3. If lazy → wrap in <LazyMount> or <LazySection>
//    4. If contentVisibility → inject CSS hint via style prop
//    5. Recursively render children — passing depth + 1
//    6. Handle "slot" nodes (pull from pageProps.slots)
//    7. Handle "raw" nodes (render a React component from pageProps.components)
//    8. Missing type → render a visible dev warning, nothing in production
// ─────────────────────────────────────────────────────────────────────────────

import React, { memo, type ReactNode, type CSSProperties } from "react";
import type { SchemaNode, PageSchema } from "../schema/types";
import { getComponent } from "./registry";
import { decideLazy } from "./lazyDetect";
import { LazyMount, LazySection } from "../components/LazyMount";
import { useSlot } from "../providers/EngineProvider";

// ── Dev warning ───────────────────────────────────────────────────────────────

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
			⚠ Engine: Unknown node type <strong>"{type}"</strong> — register it
			with <code>registerComponent("{type}", YourComponent)</code>
		</div>
	);
}

// ── Slot node ─────────────────────────────────────────────────────────────────

function SlotNode({ name, fallback, depth }: { name: string; fallback?: SchemaNode; depth: number }) {
	const slotContent = useSlot(name);
	if (slotContent != null) return <>{slotContent}</>;
	if (fallback) return <NodeRenderer node={fallback} depth={depth} />;
	return null;
}

// ── Single node renderer ──────────────────────────────────────────────────────

interface NodeRendererProps {
	node: SchemaNode;
	depth: number;
}

const NodeRenderer = memo(function NodeRenderer({ node, depth }: NodeRendererProps) {
	// ── Slot handling ────────────────────────────────────────────────────────
	if (node.type === "slot") {
		const p = (node.props ?? {}) as { name?: string; fallback?: SchemaNode };
		return (
			<SlotNode
				name={p.name ?? ""}
				fallback={p.fallback}
				depth={depth}
			/>
		);
	}

	// ── Resolve children first ────────────────────────────────────────────────
	let renderedChildren: ReactNode = null;

	if (typeof node.children === "string") {
		renderedChildren = node.children;
	} else if (Array.isArray(node.children) && node.children.length > 0) {
		renderedChildren = node.children.map((child, i) => (
			<NodeRenderer
				key={child.key ?? `${child.type}-${i}`}
				node={child}
				depth={depth + 1}
			/>
		));
	}

	// ── Look up component ─────────────────────────────────────────────────────
	const Component = getComponent(node.type);

	if (!Component) {
		return <UnknownNodeWarning type={node.type} />;
	}

	// ── Lazy detection ────────────────────────────────────────────────────────
	const lazy = decideLazy(node, depth);

	// ── Merge content-visibility hint into props ───────────────────────────────
	const extraStyle: CSSProperties = lazy.contentVisibility && !lazy.lazy
		? {
				contentVisibility: "auto" as CSSProperties["contentVisibility"],
				containIntrinsicHeight: lazy.placeholderHeight,
		  }
		: {};

	const nodeProps = {
		...(node.props ?? {}),
		...(Object.keys(extraStyle).length > 0
			? {
					style: {
						...((node.props?.style as CSSProperties) ?? {}),
						...extraStyle,
					},
			  }
			: {}),
	};

	// ── Render the element ────────────────────────────────────────────────────
	const element = (
		<Component {...nodeProps}>
			{renderedChildren}
		</Component>
	);

	// ── Wrap in lazy mount if needed ──────────────────────────────────────────
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
		<LazyMount
			height={lazy.placeholderHeight}
			rootMargin={lazy.rootMargin}
		>
			{element}
		</LazyMount>
	);
});

// ── Tree renderer ─────────────────────────────────────────────────────────────

interface SchemaRendererProps {
	schema: PageSchema;
}

export const SchemaRenderer = memo(function SchemaRenderer({
	schema,
}: SchemaRendererProps) {
	return <NodeRenderer node={schema.root} depth={0} />;
});
