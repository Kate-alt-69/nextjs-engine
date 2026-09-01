// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineCommand registry + client facade
// ─────────────────────────────────────────────────────────────────────────────

import type {
	EngineCommandDefinition,
	EngineCommandDescriptor,
	EngineCommandHandle,
	EngineCommandInputField,
	EngineCommandInputSchema,
	EngineCommandInputType,
	EngineCommandServerContext,
	EngineCommandTransport,
} from "./types";

const COMMAND_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const registry = new Map<string, EngineCommandDefinition<any, any>>();
let transport: EngineCommandTransport | null = null;

function normalizeName(name: string): string {
	const normalized = name.trim();
	if (!COMMAND_PATTERN.test(normalized)) throw new Error(`[EngineCommand] Invalid command name "${name}".`);
	return normalized;
}

function normalizeField(field: EngineCommandInputType | EngineCommandInputField): EngineCommandInputField {
	return typeof field === "string" ? { type: field } : { ...field };
}

function cloneInputSchema(schema: EngineCommandInputSchema | undefined): EngineCommandInputSchema {
	if (!schema) return Object.freeze({});
	return Object.freeze(Object.fromEntries(
		Object.entries(schema).map(([name, field]) => [name, Object.freeze(normalizeField(field))]),
	));
}

function descriptor(name: string, definition: EngineCommandDefinition<any, any>): EngineCommandDescriptor {
	return Object.freeze({
		name,
		run: definition.run ?? "auto",
		auth: definition.auth ?? "anonymous",
		permissions: Object.freeze([...(definition.permissions ?? [])]),
		input: cloneInputSchema(definition.input),
	});
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function matchesType(value: unknown, type: EngineCommandInputType): boolean {
	if (type === "unknown") return true;
	if (type === "array") return Array.isArray(value);
	if (type === "object") return isPlainObject(value);
	if (type === "number") return typeof value === "number" && Number.isFinite(value);
	return typeof value === type;
}

function validateFieldValue(value: unknown, field: EngineCommandInputField): boolean {
	if (!matchesType(value, field.type)) return false;
	if (typeof value === "number") {
		if (field.min !== undefined && value < field.min) return false;
		if (field.max !== undefined && value > field.max) return false;
	}
	if ((typeof value === "string" || Array.isArray(value)) && field.maxLength !== undefined) {
		if (value.length > field.maxLength) return false;
	}
	return true;
}

export function validateEngineCommandInput(
	schema: EngineCommandInputSchema | undefined,
	input: unknown,
): unknown {
	if (!schema || Object.keys(schema).length === 0) return input;
	if (!isPlainObject(input)) throw new Error("[EngineCommand] Invalid command input.");
	const output: Record<string, unknown> = Object.create(null);

	for (const [name, rawField] of Object.entries(schema)) {
		if (name === "__proto__" || name === "constructor" || name === "prototype") {
			throw new Error("[EngineCommand] Invalid command input schema.");
		}
		const field = normalizeField(rawField);
		let value = input[name];
		if (value === undefined && field.default !== undefined) value = field.default;
		if (value === undefined && field.optional) continue;
		if (value === undefined || !validateFieldValue(value, field)) {
			throw new Error("[EngineCommand] Invalid command input.");
		}
		output[name] = value;
	}
	return output;
}

export function configureEngineCommandTransport(nextTransport: EngineCommandTransport | null): void {
	transport = nextTransport;
}

export function registerEngineCommand<Input, Output>(
	name: string,
	definition: EngineCommandDefinition<Input, Output>,
): EngineCommandHandle<Input, Output> {
	const normalized = normalizeName(name);
	if (registry.has(normalized)) throw new Error(`[EngineCommand] Command "${normalized}" is already registered.`);
	if (typeof definition.execute !== "function") throw new Error(`[EngineCommand] Command "${normalized}" requires execute().`);
	registry.set(normalized, definition);
	return Object.freeze({
		name: normalized,
		run: (input: Input) => EngineCommand.run<Input, Output>(normalized, input),
	});
}

export function getRegisteredEngineCommand(name: string): EngineCommandDefinition<any, any> | undefined {
	return registry.get(name);
}

export function getEngineCommandBuildDescriptors(): readonly EngineCommandDescriptor[] {
	return Object.freeze([...registry.entries()].map(([name, definition]) => descriptor(name, definition)));
}

export function inspectEngineCommands(): readonly EngineCommandDescriptor[] {
	if (process.env.NODE_ENV === "production") throw new Error("[EngineCommand] Command inspection is development-only.");
	return getEngineCommandBuildDescriptors();
}

export async function executeRegisteredEngineCommand(
	name: string,
	input: unknown,
	context: EngineCommandServerContext,
): Promise<unknown> {
	const definition = registry.get(name);
	if (!definition) throw new Error("[EngineCommand] Invalid command request.");
	const schemaInput = validateEngineCommandInput(definition.input, input);
	const validatedInput = definition.validate ? definition.validate(schemaInput) : schemaInput;
	return definition.execute({
		name,
		input: validatedInput,
		api: context.api,
		request: context.request,
		origin: context.origin,
		signal: context.signal,
	});
}

export const EngineCommand = Object.freeze({
	create: registerEngineCommand,
	async run<Input = unknown, Output = unknown>(name: string, input: Input): Promise<Output> {
		const normalized = normalizeName(name);
		if (!transport) throw new Error("[EngineCommand] NENC transport is not configured for this runtime.");
		return transport(normalized, input) as Promise<Output>;
	},
});
