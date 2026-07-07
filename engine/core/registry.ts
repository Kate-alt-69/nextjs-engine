// ─────────────────────────────────────────────────────────────────────────────
//  Engine — Component Registry
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import type { NodeType } from "../schema/types";
import {
	EngineBox, EngineStack, EngineGrid, EngineText, EngineHeading,
	EngineSection, EngineButton, EngineCard, EngineSpacer, EngineDivider,
	EngineOption, EngineOptGroup, EngineSlot,
} from "../components/primitives";
import { EngineImage }    from "../components/EngineImage";
import { EngineVideo }    from "../components/EngineVideo";
import { EngineMarkdown } from "../components/EngineMarkdown";
import { EngineCanvas }   from "../components/EngineCanvas";
import { EngineScroll }   from "../components/EngineScroll";
import { CustomSelect }    from "../components/CustomSelect";
import { EngineSuspense } from "../components/EngineSuspense";
import { EngineHero }     from "../components/EngineHero";
import { EngineForm, EngineInput, EngineTextarea, EngineCheckbox, EngineLabel } from "../components/EngineForms";
import { EngineLink }                                                       from "../components/EngineLink";
import { EngineNav }                                                        from "../components/EngineNav";
import { EngineManim, EngineManim3D }                                       from "../components/EngineManim";

export type EngineComponent = ComponentType<Record<string, unknown> & { children?: React.ReactNode }>;
export type ComponentRegistry = Map<NodeType, EngineComponent>;

function buildDefaultRegistry(): ComponentRegistry {
	const r: ComponentRegistry = new Map();
	r.set("box",           EngineBox as EngineComponent);
	r.set("stack",         EngineStack as EngineComponent);
	r.set("grid",          EngineGrid as EngineComponent);
	r.set("section",       EngineSection as EngineComponent);
	r.set("hero",          EngineHero as unknown as EngineComponent);
	r.set("text",          EngineText as EngineComponent);
	r.set("heading",       EngineHeading as EngineComponent);
	r.set("markdown",      EngineMarkdown as EngineComponent);
	r.set("card",          EngineCard as EngineComponent);
	r.set("image",         EngineImage as unknown as EngineComponent);
	r.set("video",         EngineVideo as unknown as EngineComponent);
	r.set("canvas",        EngineCanvas as unknown as EngineComponent);
	r.set("scroll",        EngineScroll as unknown as EngineComponent);
	r.set("button",        EngineButton as EngineComponent);
	r.set("spacer",        EngineSpacer as EngineComponent);
	r.set("divider",       EngineDivider as EngineComponent);
	r.set("custom-select", CustomSelect as unknown as EngineComponent);
	r.set("suspense",      EngineSuspense as unknown as EngineComponent);
	r.set("slot",          EngineSlot as unknown as EngineComponent);
	r.set("option",   	  (EngineOption as unknown) as EngineComponent);
	r.set("optgroup", 	  (EngineOptGroup as unknown) as EngineComponent);
	r.set("form",          EngineForm as EngineComponent);
	r.set("input",         EngineInput as EngineComponent);
	r.set("textarea",      EngineTextarea as EngineComponent);
	r.set("checkbox",      EngineCheckbox as EngineComponent);
	r.set("label",         EngineLabel as EngineComponent);
	r.set("link",          EngineLink   as EngineComponent);
	r.set("EngineLink",    EngineLink   as EngineComponent);
	r.set("nav",           EngineNav    as EngineComponent);
	r.set("EngineNav",     EngineNav    as EngineComponent);
	r.set("manim",         EngineManim  as unknown as EngineComponent);
	r.set("EngineManim",   EngineManim  as unknown as EngineComponent);
	r.set("manim3d",       EngineManim3D as unknown as EngineComponent);
	r.set("EngineManim3D", EngineManim3D as unknown as EngineComponent);
	return r;
}

const _registry: ComponentRegistry = buildDefaultRegistry();

export function registerComponent(type: NodeType, component: EngineComponent): void { _registry.set(type, component); }
export function unregisterComponent(type: NodeType): void { _registry.delete(type); }
export function getComponent(type: NodeType): EngineComponent | undefined { return _registry.get(type); }
export function hasComponent(type: NodeType): boolean { return _registry.has(type); }
export function registeredTypes(): NodeType[] { return [..._registry.keys()]; }
export function getRegistry(): ComponentRegistry { return _registry; }