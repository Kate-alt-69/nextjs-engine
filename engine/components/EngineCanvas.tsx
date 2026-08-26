"use client";
// ─────────────────────────────────────────────────────────────────────────────
//	EngineCanvas compatibility facade
//
//	The primary implementation lives in core/enginecanvas so the schema
//	registry, direct component imports, EngineManim, and the public package all
//	share one rendering runtime instead of drifting between two implementations.
// ─────────────────────────────────────────────────────────────────────────────

export { EngineCanvas, useEngineCanvas } from "../core/enginecanvas/EngineCanvas";
export type { EngineCanvasProps } from "../core/enginecanvas/EngineCanvas";
