"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  Engine — SchemaRenderer
// ─────────────────────────────────────────────────────────────────────────────

import React, { lazy, memo, Suspense, useEffect, type CSSProperties, type ReactNode } from "react";
import {
	BREAKPOINTS,
	BREAKPOINT_ORDER,
	type Breakpoint,
	type PageSchema,
	type SchemaNode,
} from "../schema/types";
import type { EngineShaderInput } from "./engineshader/EngineShaderTypes";
import { getComponent, isSplitComponent } from "./registry";
import { validatePageSchema } from "./validateSchema";
import { decideLazy } from "./lazyDetect";
import { globalStyleCollector } from "./StyleCollector";
import { EngineScrollPointManager } from "./enginescroll";
import { LazyMount, LazySection } from "../components/LazyMount";
import { useSlot } from "../providers/EngineProvider";

interface VisibilityRule {
	className: string;
	css: string;
}

const visibilityRuleCache = new Map<string, VisibilityRule>();
const SHADER_SURFACE_TYPES = new Set(["box", "stack", "grid", "section", "hero", "card"]);
const SHADER_PENDING_CLASS = "e-shader-pending";
const SHADER_PENDING_CSS = [
	`.${SHADER_PENDING_CLASS}:not([data-engine-shader-ready="true"]){opacity:0!important}`,
	`@media (scripting: none){.${SHADER_PENDING_CLASS}{opacity:1!important}}`,
].join("\n");
const LazyEngineShaderSurface = lazy(() =>
	import("../components/EngineShaderSurface").then((module) => ({ default: module.EngineShaderSurface })),
);

function shortHash(value: string): string {
	let hashValue = 5381;
	for (let index = 0; index < value.length; index++) {
		hashValue = ((hashValue << 5) + hashValue + value.charCodeAt(index)) | 0;
	}
	return Math.abs(hashValue).toString(36).slice(0, 7);
}

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

function SlotNode({
	name,
	fallback,
	depth,
	path,
}: {
	name: string;
	fallback?: SchemaNode;
	depth: number;
	path: string;
}) {
	const slotContent = useSlot(name);
	if (slotContent != null) return <>{slotContent}</>;
	if (fallback) return <NodeRenderer node={fallback} depth={depth} path={`${path}.fallback`} />;
	return null;
}

function PointRegistration({ name, domId }: { name: string; domId: string }) {
	useEffect(() => {
		const element = document.getElementById(domId);
		if (!element) return;

		EngineScrollPointManager.registerElement(name, element);
		return () => {
			const registered = EngineScrollPointManager.get(name);
			if (registered?.element === element) {
				EngineScrollPointManager.unregister(name);
			}
		};
	}, [domId, name]);
	return null;
}

function buildVisibilityClass(props: Record<string, unknown>): string | undefined {
	const hideOn = Array.isArray(props.hideOn) ? props.hideOn as Breakpoint[] : [];
	const showOnly = Array.isArray(props.showOnly) ? props.showOnly as Breakpoint[] : [];
	if (hideOn.length === 0 && showOnly.length === 0) return undefined;

	const hiddenBreakpoints = BREAKPOINT_ORDER.filter((breakpoint) => {
		const allowedByShowOnly = showOnly.length === 0 || showOnly.includes(breakpoint);
		return !allowedByShowOnly || hideOn.includes(breakpoint);
	});
	if (hiddenBreakpoints.length === 0) return undefined;

	const signature = hiddenBreakpoints.join("|");
	let cachedRule = visibilityRuleCache.get(signature);
	if (!cachedRule) {
		const className = `e-v-${shortHash(signature)}`;
		const cssRules: string[] = [];

		for (const breakpoint of hiddenBreakpoints) {
			const breakpointIndex = BREAKPOINT_ORDER.indexOf(breakpoint);
			const minWidth = BREAKPOINTS[breakpoint];
			const nextBreakpoint = BREAKPOINT_ORDER[breakpointIndex + 1];
			const maxWidth = nextBreakpoint ? BREAKPOINTS[nextBreakpoint] - 0.02 : undefined;
			const selectorRule = `.${className}{display:none!important}`;

			if (minWidth === 0 && maxWidth !== undefined) {
				cssRules.push(`@media(max-width:${maxWidth}px){${selectorRule}}`);
			} else if (maxWidth === undefined) {
				cssRules.push(`@media(min-width:${minWidth}px){${selectorRule}}`);
			} else {
				cssRules.push(`@media(min-width:${minWidth}px) and (max-width:${maxWidth}px){${selectorRule}}`);
			}
		}

		cachedRule = { className, css: cssRules.join("\n") };
		visibilityRuleCache.set(signature, cachedRule);
	}

	globalStyleCollector.add(cachedRule.css);
	return cachedRule.className;
}

function getLazyAspectRatio(node: SchemaNode, props: Record<string, unknown>): string | undefined {
	if (props.aspectRatio !== undefined && props.aspectRatio !== null) return String(props.aspectRatio);
	if (node.type === "video") return "16 / 9";
	if (node.type === "image" && typeof props.width === "number" && typeof props.height === "number" && props.height > 0) {
		return `${props.width} / ${props.height}`;
	}
	return undefined;
}

function normalizeFallbackSize(value: unknown): string | undefined {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) return `${value}px`;
	if (typeof value === "string" && value.length > 0 && value !== "auto") return value;
	return undefined;
}

function SplitModuleFallback({
	node,
	props,
	placeholderHeight,
	className,
}: {
	node: SchemaNode;
	props: Record<string, unknown>;
	placeholderHeight: string;
	className?: string;
}) {
	const aspectRatio = getLazyAspectRatio(node, props);
	const minHeight = normalizeFallbackSize(placeholderHeight)
		?? normalizeFallbackSize(props.height)
		?? normalizeFallbackSize(props.minH)
		?? normalizeFallbackSize(props.minHeight);

	if (!aspectRatio && !minHeight) return null;
	return (
		<div
			aria-hidden="true"
			className={className}
			style={{
				width: "100%",
				...(aspectRatio ? { aspectRatio } : {}),
				...(minHeight ? { minHeight } : {}),
			}}
		/>
	);
}

interface NodeRendererProps {
	node: SchemaNode;
	depth: number;
	path: string;
}

function NodeRenderer({ node, depth, path }: NodeRendererProps) {
	if (node.type === "slot") {
		const props = (node.props ?? {}) as { name?: string; fallback?: SchemaNode };
		return (
			<SlotNode
				name={props.name ?? ""}
				fallback={props.fallback}
				depth={depth}
				path={path}
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
				path={`${path}.${child.key ?? index}`}
			/>
		));
	}

	const Component = getComponent(node.type);
	if (!Component) return <UnknownNodeWarning type={node.type} />;
	const splitComponent = isSplitComponent(Component);

	const lazy = decideLazy(node, depth);
	const extraStyle: CSSProperties = lazy.contentVisibility && !lazy.lazy
		? {
			contentVisibility: "auto" as CSSProperties["contentVisibility"],
			containIntrinsicHeight: lazy.placeholderHeight,
		}
		: {};

	const originalProps = (node.props ?? {}) as Record<string, unknown>;
	const shader = originalProps.shader as EngineShaderInput | undefined;
	const hasShader = shader !== undefined && shader !== null && SHADER_SURFACE_TYPES.has(String(node.type));
	const componentProps = { ...originalProps };
	delete componentProps.shader;
	if (hasShader) globalStyleCollector.add(SHADER_PENDING_CSS);

	const visibilityClass = buildVisibilityClass(originalProps);
	const originalClassName = typeof originalProps.className === "string" ? originalProps.className : undefined;
	const mergedClassName = [
		originalClassName,
		visibilityClass,
		hasShader ? SHADER_PENDING_CLASS : undefined,
	].filter(Boolean).join(" ") || undefined;
	const pointName = typeof originalProps.point === "string" && originalProps.point.length > 0
		? originalProps.point
		: undefined;
	const explicitId = typeof originalProps.id === "string" && originalProps.id.length > 0
		? originalProps.id
		: undefined;
	const shaderId = hasShader ? `e-shader-${shortHash(`${path}|${String(node.type)}|${node.name ?? ""}`)}` : undefined;
	const resolvedDomId = explicitId ?? pointName ?? shaderId;
	const nodeProps = {
		...componentProps,
		...(resolvedDomId ? { id: resolvedDomId } : {}),
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
	const element = <Component {...nodeProps}>{effectiveChildren}</Component>;
	const shaderSurface = hasShader && resolvedDomId
		? (
			<Suspense fallback={null}>
				<LazyEngineShaderSurface targetId={resolvedDomId} shader={shader!} />
			</Suspense>
		)
		: null;
	const anchoredElement = pointName && resolvedDomId
		? (
			<>
				<PointRegistration name={pointName} domId={resolvedDomId} />
				{element}
				{shaderSurface}
			</>
		)
		: <>{element}{shaderSurface}</>;

	if (!lazy.lazy) {
		if (!splitComponent) return anchoredElement;
		return (
			<Suspense
				fallback={(
					<SplitModuleFallback
						node={node}
						props={originalProps}
						placeholderHeight={lazy.placeholderHeight}
						className={visibilityClass}
					/>
				)}
			>
				{anchoredElement}
			</Suspense>
		);
	}

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
				{anchoredElement}
			</LazySection>
		);
	}

	return (
		<LazyMount
			className={visibilityClass}
			height={lazy.placeholderHeight}
			aspectRatio={getLazyAspectRatio(node, originalProps)}
			rootMargin={lazy.rootMargin}
		>
			{anchoredElement}
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

	return <NodeRenderer node={schema.root} depth={0} path="root" />;
});
