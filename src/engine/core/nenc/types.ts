// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — NENC command contracts
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAPIResolver } from "../EngineAPIResolver";

export type EngineCommandRuntime = "client" | "server" | "auto";
export type EngineCommandAuth = "anonymous" | "account" | (string & {});
export type EngineCommandInputType = "string" | "number" | "boolean" | "object" | "array" | "unknown";

export interface EngineCommandInputField {
	type: EngineCommandInputType;
	optional?: boolean;
	default?: unknown;
	min?: number;
	max?: number;
	maxLength?: number;
}

export type EngineCommandInputSchema = Record<string, EngineCommandInputType | EngineCommandInputField>;

export interface EngineCommandReplayPolicy {
	/** Maximum accepted age of a request timestamp, in milliseconds. */
	maxAgeMs?: number;
	/** Maximum accepted amount that a request timestamp may be ahead of the server clock. */
	maxFutureSkewMs?: number;
}

export interface EngineCommandRateLimit {
	limit: number;
	windowMs: number;
}

export interface EngineCommandExecutionContext<Input = unknown> {
	name: string;
	input: Input;
	api: EngineAPIResolver;
	principal?: unknown;
	request?: Request;
	origin?: string;
	signal?: AbortSignal;
}

export interface EngineCommandDefinition<Input = unknown, Output = unknown> {
	run?: EngineCommandRuntime;
	auth?: EngineCommandAuth;
	permissions?: readonly string[];
	replay?: EngineCommandReplayPolicy;
	rateLimit?: EngineCommandRateLimit;
	input?: EngineCommandInputSchema;
	validate?: (input: unknown) => Input;
	execute(context: EngineCommandExecutionContext<Input>): Output | Promise<Output>;
}

export interface EngineCommandDescriptor {
	name: string;
	run: EngineCommandRuntime;
	auth: EngineCommandAuth;
	permissions: readonly string[];
	replay?: EngineCommandReplayPolicy;
	rateLimit?: EngineCommandRateLimit;
	input: EngineCommandInputSchema;
}

export interface EngineCommandHandle<Input = unknown, Output = unknown> {
	readonly name: string;
	run(input: Input): Promise<Output>;
}

export type EngineCommandTransport = (name: string, input: unknown) => Promise<unknown>;

export interface EngineCommandServerContext {
	api: EngineAPIResolver;
	principal?: unknown;
	request?: Request;
	origin?: string;
	signal?: AbortSignal;
}
