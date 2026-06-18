// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineAPIConfigParser
//
//  Parses .EngineAPIConfig/*.api files (TOML-inspired syntax) into a compiled
//  JSON structure consumed at runtime by EngineAPIResolver.
//
//  File format:
//    # Comment
//    [provider.NAME]
//    endpoint = "https://api.example.com"
//    method   = "POST"
//    cache    = "no-cache"
//
//    [provider.NAME.auth]
//    type      = "hmac"
//    secret    = "$ENV_VAR"
//    algorithm = "sha-256"
//
//    [versions]
//    V1 = "/api/v1"
//    V2 = "/api/v2"
//
//  Environment variable substitution: $VAR_NAME → process.env.VAR_NAME
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAPIConfig, EngineAPIAuthConfig } from "../schema/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Public shape
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineAPICompiledConfig {
	providers: Record<string, EngineAPIConfig>;
	versions:  Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal: low-level tokeniser
// ─────────────────────────────────────────────────────────────────────────────

type ScalarValue = string | number | boolean;

interface ParsedConfig {
	[sectionKey: string]: Record<string, ScalarValue>;
}

function parseScalar(raw: string): ScalarValue {
	const t = raw.trim();
	if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
	if (t === "true")  return true;
	if (t === "false") return false;
	const n = Number(t);
	if (!Number.isNaN(n)) return n;
	return t;
}

function tokenise(source: string): ParsedConfig {
	const result: ParsedConfig = {};
	let section = "__root__";

	for (const rawLine of source.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const sectionMatch = line.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			if (!result[section]) result[section] = {};
			continue;
		}

		const kvMatch = line.match(/^([^=]+)=(.+)$/);
		if (kvMatch) {
			if (!result[section]) result[section] = {};
			result[section][kvMatch[1].trim()] = parseScalar(kvMatch[2]);
		}
	}

	return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal: environment variable substitution
// ─────────────────────────────────────────────────────────────────────────────

function substituteEnv(value: string): string {
	return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name: string) => {
		return (typeof process !== "undefined" ? process.env[name] : undefined) ?? "";
	});
}

function substituteSection(section: Record<string, ScalarValue>): Record<string, ScalarValue> {
	const out: Record<string, ScalarValue> = {};
	for (const [k, v] of Object.entries(section)) {
		out[k] = typeof v === "string" ? substituteEnv(v) : v;
	}
	return out;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Internal: auth config builder
// ─────────────────────────────────────────────────────────────────────────────

function buildAuth(section: Record<string, ScalarValue>): EngineAPIAuthConfig {
	const type = String(section["type"] ?? "none") as EngineAPIAuthConfig["type"];
	switch (type) {
		case "ak":
			return {
				type: "ak",
				key:    String(section["key"]    ?? ""),
				destinationHeader: String(section["header"] ?? section["destinationHeader"] ?? "X-Key"),
			};
		case "bearer":
			return { type: "bearer", token: String(section["token"] ?? "") };
		case "jwt":
			return { type: "jwt",    token: String(section["token"] ?? "") };
		case "basic":
			return {
				type:     "basic",
				username: String(section["username"] ?? ""),
				password: String(section["password"] ?? ""),
			};
		case "hmac":
			return {
				type:      "hmac",
				secret:    String(section["secret"]    ?? ""),
				algorithm: (section["algorithm"] as any) ?? "sha-256",
			};
		case "pnp":
			return {
				type:       "pnp",
				privateKey: String(section["privateKey"] ?? ""),
				algorithm:  (section["algorithm"] as any) ?? "Ed25519",
			};
		default:
			return { type: "none" };
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core compiler
// ─────────────────────────────────────────────────────────────────────────────

export function compileAPIConfig(source: string): EngineAPICompiledConfig {
	const parsed   = tokenise(source);
	const compiled: EngineAPICompiledConfig = { providers: {}, versions: {} };

	for (const [sectionKey, rawSection] of Object.entries(parsed)) {
		if (sectionKey === "__root__") continue;
		const section = substituteSection(rawSection);

		// [provider.NAME]
		const providerRoot = sectionKey.match(/^provider\.([^.]+)$/);
		if (providerRoot) {
			const name = providerRoot[1];
			if (!compiled.providers[name]) compiled.providers[name] = { endpoint: "" };
			const prov = compiled.providers[name];
			if (section["endpoint"]) prov.endpoint = String(section["endpoint"]);
			if (section["method"])   prov.method   = section["method"] as any;
			if (section["cache"] !== undefined) prov.cache = section["cache"] as any;
			if (section["headers"]) {
				try { prov.headers = JSON.parse(String(section["headers"])); } catch { /* noop */ }
			}
			continue;
		}

		// [provider.NAME.auth]
		const providerAuth = sectionKey.match(/^provider\.([^.]+)\.auth$/);
		if (providerAuth) {
			const name = providerAuth[1];
			if (!compiled.providers[name]) compiled.providers[name] = { endpoint: "" };
			compiled.providers[name].auth = buildAuth(section);
			continue;
		}

		// [versions]
		if (sectionKey === "versions") {
			for (const [k, v] of Object.entries(section)) {
				compiled.versions[k] = String(v);
			}
		}
	}

	return compiled;
}

// ─────────────────────────────────────────────────────────────────────────────
//  File system loader  (server-side only — uses dynamic import)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAPIConfigDir(
	configDir = ".EngineAPIConfig",
): Promise<EngineAPICompiledConfig> {
	try {
		const { readdir, readFile } = await import("fs/promises");
		const { join }              = await import("path");
		const dir                   = join(process.cwd(), configDir);
		let   combined              = "";

		try {
			const files = await readdir(dir);
			for (const file of files.filter((f) => f.endsWith(".api"))) {
				combined += await readFile(join(dir, file), "utf8") + "\n";
			}
		} catch {
			// Directory absent — return empty config without throwing
		}

		return compileAPIConfig(combined);
	} catch {
		return { providers: {}, versions: {} };
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  In-process config cache  (one compile per server lifecycle)
// ─────────────────────────────────────────────────────────────────────────────

let _cached: EngineAPICompiledConfig | null = null;

export function setCompiledAPIConfig(config: EngineAPICompiledConfig): void {
	_cached = config;
}

export function getCompiledAPIConfig(): EngineAPICompiledConfig | null {
	return _cached;
}

export async function ensureAPIConfig(
	configDir?: string,
): Promise<EngineAPICompiledConfig> {
	if (_cached) return _cached;
	_cached = await loadAPIConfigDir(configDir);
	return _cached;
}
