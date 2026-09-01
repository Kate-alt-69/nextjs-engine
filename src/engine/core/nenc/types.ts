// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — NENC command contracts
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAPIResolver } from "../EngineAPIResolver";

export type EngineCommandRuntime = "client" | "server" | "auto";
export type EngineCommandAuth = "anonymous" | "account" | (string & {});

export interface EngineCommandExecutionContext<Input = unknown> {
	name: string;
	input: Input;
	api: EngineAPIResolver;
	request?: Request;
	origin?: string;
	signal?: AbortSignal;
}

export interface EngineCommandDefinition<Input = unknown, Output = unknown> {
	run?: EngineCommandRuntime;
	auth?: EngineCommandAuth;
	permissions?: readonly string[];
	validate?: (input: unknown) => Input;
	execute(context: EngineCommandExecutionContext<Input>): Output | Promise<Output>;
}

export interface EngineCommandDescriptor {
	name: string;
	run: EngineCommandRuntime;
	auth: EngineCommandAuth;
	permissions: readonly string[];
}

export interface EngineCommandHandle<Input = unknown, Output = unknown> {
	readonly name: string;
	run(input: Input): Promise<Output>;
}

export type EngineCommandTransport = (name: string, input: unknown) => Promise<unknown>;

export interface EngineCommandServerContext {
	api: EngineAPIResolver;
	request?: Request;
	origin?: string;
	signal?: AbortSignal;
}
