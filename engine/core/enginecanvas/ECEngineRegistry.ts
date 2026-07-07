// ============================================================================
// ECEngineRegistry.ts — pluggable rendering engine registry
// ============================================================================
//
//  Maps a short engine name ("2d", "3d", "svg", "skia", or any custom name)
//  to a RenderingEngine factory. Components request an engine by name;
//  EngineCanvas never hardcodes which engines exist — new engines register
//  themselves the same way EngineSkia will when it graduates from a stub.
// ============================================================================

import { Engine2D }         from "./Engine2D";
import { Engine3D }         from "./Engine3D";
import { EngineSVGEngine }  from "./EngineSVG";
import { EngineSkiaEngine } from "./EngineSkia";
import type { RenderingEngine } from "./RenderingEngine";

type ECEngineFactory = () => RenderingEngine;

const registry = new Map<string, ECEngineFactory>([
	["2d",   () => new Engine2D()],
	["3d",   () => new Engine3D()],
	["svg",  () => new EngineSVGEngine()],
	["skia", () => new EngineSkiaEngine()],
]);

/** Register a custom rendering engine under a new name. */
export function registerRenderingEngine(name: string, factory: ECEngineFactory): void {
	registry.set(name, factory);
}

/** Instantiate a rendering engine by name. Throws if unregistered. */
export function createRenderingEngine(name: string): RenderingEngine {

	const factory = registry.get(name);

	if (!factory) {
		const known = Array.from(registry.keys()).join(", ");
		throw new Error(
			`[EngineCanvas] Unknown rendering engine "${name}". Registered engines: ${known}. ` +
			`Use registerRenderingEngine("${name}", factory) to add a custom one.`,
		);
	}

	return factory();

}

/** True if a rendering engine name is registered. */
export function hasRenderingEngine(name: string): boolean {
	return registry.has(name);
}
