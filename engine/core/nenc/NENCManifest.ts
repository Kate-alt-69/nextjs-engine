// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — compiled NENC wire manifest types
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandAuth, EngineCommandRuntime } from "./types";

export interface NENCWireHeaders {
	selector: string;
	nonce: string;
	timestamp: string;
	signature: string;
}

export interface NENCClientCommand {
	id: string;
	args: Readonly<Record<string, string>>;
}

export interface NENCClientManifest {
	version: 1;
	endpoint: "/_static/command";
	buildId: string;
	headers: NENCWireHeaders;
	commands: Readonly<Record<string, NENCClientCommand>>;
}

export interface NENCServerCommand {
	id: string;
	name: string;
	run: EngineCommandRuntime;
	auth: EngineCommandAuth;
	permissions: readonly string[];
	argsByName: Readonly<Record<string, string>>;
	argsById: Readonly<Record<string, string>>;
}

export interface NENCServerManifest {
	version: 1;
	endpoint: "/_static/command";
	buildId: string;
	headers: NENCWireHeaders;
	commandsById: Readonly<Record<string, NENCServerCommand>>;
}
