// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineCommand registry + client facade
// ─────────────────────────────────────────────────────────────────────────────

import type {
	EngineCommandDefinition,
	EngineCommandDescriptor,
	EngineCommandHandle,
	EngineCommandServerContext,
	EngineCommandTransport,
} from "./types";

const COMMAND_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const registry = new Map<string, EngineCommandDefinition<any, any>>();
let transport: EngineCommandTransport | null = null;

function normalizeName(name: string): string {
	const normalized = name.trim();
	if (!COMMAND_PATTERN.test(normalized)) {
		throw new Error(`[EngineCommand] Invalid command name "${name}".`);
	}
	return normalized;
}

function descriptor(name: string, definition: EngineCommandDefinition<any, any>): EngineCommandDescriptor {
	return Object.freeze({
		name,
		run: definition.run ?? "auto",
		auth: definition.auth ?? "anonymous",
		permissions: Object.freeze([...(definition.permissions ?? [])]),
	});
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

export function inspectEngineCommands(): readonly EngineCommandDescriptor[] {
	if (process.env.NODE_ENV === "production") {
		throw new Error("[EngineCommand] Command inspection is development-only.");
	}
	return Object.freeze([...registry.entries()].map(([name, definition]) => descriptor(name, definition)));
}

export async function executeRegisteredEngineCommand(
	name: string,
	input: unknown,
	context: EngineCommandServerContext,
): Promise<unknown> {
	const definition = registry.get(name);
	if (!definition) throw new Error("[EngineCommand] Invalid command request.");
	const validatedInput = definition.validate ? definition.validate(input) : input;
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
		if (!transport) {
			throw new Error("[EngineCommand] NENC transport is not configured for this runtime.");
		}
		return transport(normalized, input) as Promise<Output>;
	},
});
