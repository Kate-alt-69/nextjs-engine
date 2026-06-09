// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Component Registry
//
//  Maps NodeType string keys → React components.
//  Built-ins are registered by default.
//  Users can register custom components via registerComponent().
//
//  All components stored here are assumed to be memo()-wrapped already.
//  The renderer will NOT double-wrap — don't store non-memo components.
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import type { NodeType } from "../schema/types";
import {
	EngineBox,
	EngineStack,
	EngineGrid,
	EngineText,
	EngineHeading,
	EngineSection,
	EngineButton,
	EngineCard,
	EngineSpacer,
	EngineDivider,
} from "../components/primitives";
import { EngineImage } from "../components/EngineImage";
import { EngineVideo } from "../components/EngineVideo";
import { EngineMarkdown } from "../components/EngineMarkdown";
import { EngineCanvas } from "../components/EngineCanvas";
import { EngineScroll } from "../components/EngineScroll";

// ── Registry type ─────────────────────────────────────────────────────────────

export type EngineComponent = ComponentType<Record<string, unknown> & {
	children?: React.ReactNode;
}>;

export type ComponentRegistry = Map<NodeType, EngineComponent>;

// ── Create and populate the registry ─────────────────────────────────────────

function buildDefaultRegistry(): ComponentRegistry {
	const r: ComponentRegistry = new Map();

	// Layout
	r.set("box",     EngineBox as EngineComponent);
	r.set("stack",   EngineStack as EngineComponent);
	r.set("grid",    EngineGrid as EngineComponent);
	r.set("section", EngineSection as EngineComponent);
	r.set("hero",    EngineSection as EngineComponent);

	// Content
	r.set("text",    EngineText as EngineComponent);
	r.set("heading", EngineHeading as EngineComponent);
	r.set("markdown", EngineMarkdown as EngineComponent);
	r.set("card",    EngineCard as EngineComponent);

	// Media
	r.set("image",   EngineImage as unknown as EngineComponent);
	r.set("video",   EngineVideo as unknown as EngineComponent);
	r.set("canvas",  EngineCanvas as unknown as EngineComponent);

	// Scroll system
	r.set("scroll",  EngineScroll as unknown as EngineComponent);

	// Decoration / utility
	r.set("button",  EngineButton as EngineComponent);
	r.set("spacer",  EngineSpacer as EngineComponent);
	r.set("divider", EngineDivider as EngineComponent);

	return r;
}

// Module-level registry — shared across the app
const _registry: ComponentRegistry = buildDefaultRegistry();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a custom component under a NodeType key.
 * If the key already exists, it will be overridden.
 *
 * IMPORTANT: wrap your component in React.memo() before registering.
 *
 * @example
 * import { memo } from "react";
 * const MyCard = memo(function MyCard({ title, children }) { … });
 * registerComponent("my-card", MyCard);
 */
export function registerComponent(type: NodeType, component: EngineComponent): void {
	_registry.set(type, component);
}

export function unregisterComponent(type: NodeType): void {
	_registry.delete(type);
}

export function getComponent(type: NodeType): EngineComponent | undefined {
	return _registry.get(type);
}

export function hasComponent(type: NodeType): boolean {
	return _registry.has(type);
}

export function registeredTypes(): NodeType[] {
	return [..._registry.keys()];
}

export function getRegistry(): ComponentRegistry {
	return _registry;
}
