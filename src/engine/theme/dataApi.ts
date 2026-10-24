import type {
	EngineThemeDataEvent,
	EngineThemeDataEventBinding,
	EngineThemeDataEventContext,
	EngineThemeDataEventType,
	EngineThemeDataHandler,
	EngineThemeDataHandlerResult,
	EngineThemeJsonValue,
} from "../schema/types";
import { parseEngineThemeId } from "./createTheme";

const HANDLER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COMPONENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RESERVED_IDS = new Set(["prototype", "constructor"]);
const EVENT_TYPES = new Set<EngineThemeDataEventType>([
	"join:left",
	"join:right",
	"join:top",
	"join:bottom",
]);
const MAX_CONTEXT_NODES = 5_000;
const MAX_CONTEXT_DEPTH = 24;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const handlers = new Map<string, EngineThemeDataHandler>();

function assertJsonPayload(value: unknown, label: string): asserts value is EngineThemeJsonValue {
	let nodes = 0;
	const active = new Set<object>();

	function visit(current: unknown, path: string, depth: number): void {
		nodes += 1;
		if (nodes > MAX_CONTEXT_NODES) throw new TypeError("EngineTheme Data-API " + label + " exceeds the value limit.");
		if (depth > MAX_CONTEXT_DEPTH) throw new TypeError("EngineTheme Data-API " + label + " exceeds the nesting limit.");
		if (current === null || typeof current === "string" || typeof current === "boolean") return;
		if (typeof current === "number") {
			if (!Number.isFinite(current)) throw new TypeError("EngineTheme Data-API " + path + " contains a non-finite number.");
			return;
		}
		if (typeof current !== "object") throw new TypeError("EngineTheme Data-API " + path + " must be JSON data.");
		if (active.has(current)) throw new TypeError("EngineTheme Data-API " + path + " contains a cycle.");
		if (Object.getOwnPropertySymbols(current).length > 0) throw new TypeError("EngineTheme Data-API " + path + " cannot contain symbol keys.");
		if (Array.isArray(current)) {
			const keys = Object.keys(current);
			if (keys.length !== current.length || keys.some((key, index) => key !== String(index))) {
				throw new TypeError("EngineTheme Data-API " + path + " contains a sparse or extended array.");
			}
			active.add(current);
			for (let index = 0; index < current.length; index += 1) visit(current[index], path + "[" + index + "]", depth + 1);
			active.delete(current);
			return;
		}
		const prototype = Object.getPrototypeOf(current);
		if (prototype !== Object.prototype && prototype !== null) throw new TypeError("EngineTheme Data-API " + path + " must be a plain object.");
		active.add(current);
		for (const key of Object.keys(current as Record<string, unknown>)) {
			if (RESERVED_KEYS.has(key)) throw new TypeError("EngineTheme Data-API " + path + " contains a reserved key.");
			const descriptor = Object.getOwnPropertyDescriptor(current, key);
			if (!descriptor || !("value" in descriptor) || descriptor.get || descriptor.set) {
				throw new TypeError("EngineTheme Data-API " + path + "." + key + " cannot be an accessor.");
			}
			visit(descriptor.value, path + "." + key, depth + 1);
		}
		active.delete(current);
	}

	visit(value, label, 0);
}

function normalizeBinding(binding: string | EngineThemeDataEventBinding): string {
	const id = typeof binding === "string" ? binding : binding?.handlerId;
	if (typeof id !== "string" || !HANDLER_ID.test(id) || RESERVED_IDS.has(id)) {
		throw new TypeError("EngineTheme Data-API binding requires a safe, registered handler ID.");
	}
	return id;
}

function cloneAndFreezeJson(value: EngineThemeJsonValue): EngineThemeJsonValue {
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) {
		return Object.freeze(value.map((item) => cloneAndFreezeJson(item))) as unknown as EngineThemeJsonValue;
	}
	// assertJsonPayload rejects prototype-sensitive keys before cloning, so a
	// normal JSON object preserves consumer expectations without reintroducing
	// prototype-pollution inputs.
	const output: Record<string, EngineThemeJsonValue> = {};
	for (const [key, child] of Object.entries(value)) output[key] = cloneAndFreezeJson(child);
	return Object.freeze(output);
}

function validateContext(
	type: EngineThemeDataEventType,
	context: EngineThemeDataEventContext,
): EngineThemeDataEventContext {
	// Validate the whole object before reading any field so getters/accessors can
	// never run as a side effect of dispatching an event.
	assertJsonPayload(context, "event context");
	if (!context || typeof context !== "object" || Array.isArray(context)) {
		throw new TypeError("EngineTheme Data-API event context must be an object.");
	}
	if (typeof context.themeId !== "string" || context.themeId.length > 240) {
		throw new TypeError("EngineTheme Data-API context needs a valid themeId.");
	}
	parseEngineThemeId(context.themeId);
	if (typeof context.componentId !== "string" || !COMPONENT_ID.test(context.componentId)) {
		throw new TypeError("EngineTheme Data-API context needs a valid componentId.");
	}
	if (typeof context.slotId !== "string" || !COMPONENT_ID.test(context.slotId)) {
		throw new TypeError("EngineTheme Data-API context needs a valid slotId.");
	}
	const expectedDirection = type.slice("join:".length) as EngineThemeDataEventContext["direction"];
	if (context.direction !== undefined && context.direction !== expectedDirection) {
		throw new TypeError("EngineTheme Data-API direction must match event " + type + ".");
	}
	if (context.existing !== undefined) assertJsonPayload(context.existing, "existing content");
	if (context.incoming !== undefined) assertJsonPayload(context.incoming, "incoming content");
	if (context.metadata !== undefined) assertJsonPayload(context.metadata, "metadata");
	return cloneAndFreezeJson(context as unknown as EngineThemeJsonValue) as unknown as EngineThemeDataEventContext;
}

/**
 * Register a trusted, project-local event handler. Remote .etr themes may
 * reference this stable ID, but cannot provide executable handler source.
 */
export function registerEngineThemeDataHandler(id: string, handler: EngineThemeDataHandler): void {
	if (typeof id !== "string" || !HANDLER_ID.test(id) || RESERVED_IDS.has(id)) {
		throw new TypeError("EngineTheme Data-API handler IDs must use safe alphanumeric, dot, underscore, or hyphen segments and cannot be reserved names.");
	}
	if (typeof handler !== "function") {
		throw new TypeError("EngineTheme Data-API handler must be a local function.");
	}
	const existing = handlers.get(id);
	if (existing && existing !== handler) {
		throw new Error("EngineTheme Data-API handler '" + id + "' is already registered.");
	}
	handlers.set(id, handler);
}

export function unregisterEngineThemeDataHandler(id: string): boolean {
	return handlers.delete(id);
}

export function listEngineThemeDataHandlers(): string[] {
	return [...handlers.keys()].sort();
}

/**
 * Dispatch a supported composition event to a handler registered by local
 * application code. Missing or invalid handlers fail clearly; no module is
 * imported based on a remote-provided ID.
 */
export function dispatchEngineThemeDataEvent(
	type: EngineThemeDataEventType,
	binding: string | EngineThemeDataEventBinding,
	context: EngineThemeDataEventContext,
): EngineThemeDataHandlerResult {
	if (!EVENT_TYPES.has(type)) throw new TypeError("Unsupported EngineTheme Data-API event: " + String(type));
	const handlerId = normalizeBinding(binding);
	const handler = handlers.get(handlerId);
	if (!handler) {
		throw new Error("EngineTheme Data-API handler '" + handlerId + "' is not registered in this project.");
	}
	const event: EngineThemeDataEvent = Object.freeze({
		type,
		context: Object.freeze(validateContext(type, context)),
	});
	try {
		return handler(event);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error("EngineTheme Data-API handler '" + handlerId + "' failed for " + type + ": " + reason);
	}
}
