// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Component Registry
// ─────────────────────────────────────────────────────────────────────────────

import { lazy, type ComponentType } from "react";
import type { NodeType } from "../schema/types";
import {
	EngineBox, EngineStack, EngineGrid, EngineText, EngineHeading,
	EngineSection, EngineButton, EngineCard, EngineSpacer, EngineDivider,
	EngineOption, EngineOptGroup, EngineSlot,
} from "../components/primitives";

export type EngineComponent = ComponentType<Record<string, unknown> & { children?: React.ReactNode }>;
export type ComponentRegistry = Map<NodeType, EngineComponent>;

// Optional/heavier built-ins are real split points. The loader is not invoked
// until React actually renders that node, so a primitive-only page does not
// eagerly evaluate Markdown, Canvas, media, Nav, Forms, or Manim modules.
function lazyEngineComponent(
	loader: () => Promise<{ default: ComponentType<any> }>,
): EngineComponent {
	return lazy(loader) as unknown as EngineComponent;
}

const LazyEngineHero = lazyEngineComponent(() =>
	import("../components/EngineHero").then((module) => ({ default: module.EngineHero })),
);
const LazyEngineImage = lazyEngineComponent(() =>
	import("../components/EngineImage").then((module) => ({ default: module.EngineImage })),
);
const LazyEngineVideo = lazyEngineComponent(() =>
	import("../components/EngineVideo").then((module) => ({ default: module.EngineVideo })),
);
const LazyEngineMarkdown = lazyEngineComponent(() =>
	import("../components/EngineMarkdown").then((module) => ({ default: module.EngineMarkdown })),
);
const LazyEngineCanvas = lazyEngineComponent(() =>
	import("../components/EngineCanvas").then((module) => ({ default: module.EngineCanvas })),
);
const LazyLegacyEngineScroll = lazyEngineComponent(() =>
	import("../components/EngineScroll").then((module) => ({ default: module.EngineScroll })),
);
const LazyCustomSelect = lazyEngineComponent(() =>
	import("../components/CustomSelect").then((module) => ({ default: module.CustomSelect })),
);
const LazyEngineSuspense = lazyEngineComponent(() =>
	import("../components/EngineSuspense").then((module) => ({ default: module.EngineSuspense })),
);
const LazyEngineForm = lazyEngineComponent(() =>
	import("../components/EngineForms").then((module) => ({ default: module.EngineForm })),
);
const LazyEngineInput = lazyEngineComponent(() =>
	import("../components/EngineForms").then((module) => ({ default: module.EngineInput })),
);
const LazyEngineTextarea = lazyEngineComponent(() =>
	import("../components/EngineForms").then((module) => ({ default: module.EngineTextarea })),
);
const LazyEngineCheckbox = lazyEngineComponent(() =>
	import("../components/EngineForms").then((module) => ({ default: module.EngineCheckbox })),
);
const LazyEngineLabel = lazyEngineComponent(() =>
	import("../components/EngineForms").then((module) => ({ default: module.EngineLabel })),
);
const LazyEngineLink = lazyEngineComponent(() =>
	import("../components/EngineLink").then((module) => ({ default: module.EngineLink })),
);
const LazyEngineNav = lazyEngineComponent(() =>
	import("../components/EngineNav").then((module) => ({ default: module.EngineNav })),
);
const LazyEngineManim = lazyEngineComponent(() =>
	import("../components/EngineManim/EngineManim").then((module) => ({ default: module.EngineManim })),
);
const LazyEngineManim3D = lazyEngineComponent(() =>
	import("../components/EngineManim/EngineManim3D").then((module) => ({ default: module.EngineManim3D })),
);

function buildDefaultRegistry(): ComponentRegistry {
	const registry: ComponentRegistry = new Map();
	registry.set("box",           EngineBox as EngineComponent);
	registry.set("stack",         EngineStack as EngineComponent);
	registry.set("grid",          EngineGrid as EngineComponent);
	registry.set("section",       EngineSection as EngineComponent);
	registry.set("hero",          LazyEngineHero);
	registry.set("text",          EngineText as EngineComponent);
	registry.set("heading",       EngineHeading as EngineComponent);
	registry.set("markdown",      LazyEngineMarkdown);
	registry.set("card",          EngineCard as EngineComponent);
	registry.set("image",         LazyEngineImage);
	registry.set("video",         LazyEngineVideo);
	registry.set("canvas",        LazyEngineCanvas);
	registry.set("scroll",        LazyLegacyEngineScroll);
	registry.set("button",        EngineButton as EngineComponent);
	registry.set("spacer",        EngineSpacer as EngineComponent);
	registry.set("divider",       EngineDivider as EngineComponent);
	registry.set("custom-select", LazyCustomSelect);
	registry.set("suspense",      LazyEngineSuspense);
	registry.set("slot",          EngineSlot as unknown as EngineComponent);
	registry.set("option",        EngineOption as unknown as EngineComponent);
	registry.set("optgroup",      EngineOptGroup as unknown as EngineComponent);
	registry.set("form",          LazyEngineForm);
	registry.set("input",         LazyEngineInput);
	registry.set("textarea",      LazyEngineTextarea);
	registry.set("checkbox",      LazyEngineCheckbox);
	registry.set("label",         LazyEngineLabel);
	registry.set("link",          LazyEngineLink);
	registry.set("EngineLink",    LazyEngineLink);
	registry.set("nav",           LazyEngineNav);
	registry.set("EngineNav",     LazyEngineNav);
	registry.set("manim",         LazyEngineManim);
	registry.set("EngineManim",   LazyEngineManim);
	registry.set("manim3d",       LazyEngineManim3D);
	registry.set("EngineManim3D", LazyEngineManim3D);
	return registry;
}

const _registry: ComponentRegistry = buildDefaultRegistry();

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
