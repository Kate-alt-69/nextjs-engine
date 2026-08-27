// ─────────────────────────────────────────────────────────────────────────────
//  Engine — EngineAPIConfigParser
//
//  Parses .EngineAPIConfig/*.api files (TOML-inspired syntax) into a compiled
//  JSON structure consumed at runtime by EngineAPIResolver.
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAPIConfig, EngineAPIAuthConfig } from "../schema/types";

export interface EngineAPICompiledConfig {
	providers: Record<string, EngineAPIConfig>;
	versions: Record<string, string>;
}

type ScalarValue = string | number | boolean;

interface ParsedConfig {
	[sectionKey: string]: Record<string, ScalarValue>;
}

function parseScalar(raw: string): ScalarValue {
	const trimmed = raw.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	const numericValue = Number(trimmed);
	if (!Number.isNaN(numericValue)) return numericValue;
	return trimmed;
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

		const keyValueMatch = line.match(/^([^=]+)=(.+)$/);
		if (!keyValueMatch) continue;

		if (!result[section]) result[section] = {};
		result[section][keyValueMatch[1].trim()] = parseScalar(keyValueMatch[2]);
	}

	return result;
}

function substituteEnv(value: string): string {
	return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g, (_, bracedName: string | undefined, plainName: string | undefined) => {
		const name = bracedName ?? plainName;
		return name && typeof process !== "undefined" ? process.env[name] ?? "" : "";
	});
}

function substituteSection(section: Record<string, ScalarValue>): Record<string, ScalarValue> {
	const resolvedSection: Record<string, ScalarValue> = {};
	for (const [key, value] of Object.entries(section)) {
		resolvedSection[key] = typeof value === "string" ? substituteEnv(value) : value;
	}
	return resolvedSection;
}

function normalizeHmacAlgorithm(value: ScalarValue | undefined): string {
	return String(value ?? "SHA-256").toUpperCase().replace(/_/g, "-") === "SHA-512"
		? "SHA-512"
		: "SHA-256";
}

function normalizeAsymmetricAlgorithm(value: ScalarValue | undefined): string {
	return String(value ?? "Ed25519").toUpperCase() === "RS256" ? "RS256" : "Ed25519";
}

function buildAuth(section: Record<string, ScalarValue>): EngineAPIAuthConfig {
	const type = String(section.type ?? "none").toLowerCase() as EngineAPIAuthConfig["type"];

	switch (type) {
		case "ak":
			return {
				type: "ak",
				key: String(section.key ?? ""),
				destinationHeader: String(section.header ?? section.destinationHeader ?? "X-Key"),
			};
		case "bearer":
			return { type: "bearer", token: String(section.token ?? "") };
		case "jwt":
			return { type: "jwt", token: String(section.token ?? "") };
		case "basic":
			return {
				type: "basic",
				username: String(section.username ?? ""),
				password: String(section.password ?? ""),
			};
		case "hmac":
			return {
				type: "hmac",
				key: String(section.key ?? ""),
				secret: String(section.secret ?? ""),
				algorithm: normalizeHmacAlgorithm(section.algorithm),
			};
		case "pnp":
			return {
				type: "pnp",
				key: String(section.key ?? ""),
				privateKey: String(section.privateKey ?? ""),
				algorithm: normalizeAsymmetricAlgorithm(section.algorithm),
			};
		default:
			return { type: "none" };
	}
}

export function compileAPIConfig(source: string): EngineAPICompiledConfig {
	const parsed = tokenise(source);
	const compiled: EngineAPICompiledConfig = { providers: {}, versions: {} };

	for (const [sectionKey, rawSection] of Object.entries(parsed)) {
		if (sectionKey === "__root__") continue;
		const section = substituteSection(rawSection);

		const providerRoot = sectionKey.match(/^provider\.([^.]+)$/);
		if (providerRoot) {
			const providerName = providerRoot[1];
			if (!compiled.providers[providerName]) compiled.providers[providerName] = { endpoint: "" };
			const provider = compiled.providers[providerName];
			if (section.endpoint) provider.endpoint = String(section.endpoint);
			if (section.method) provider.method = String(section.method);
			if (section.cache !== undefined) provider.cache = String(section.cache) as RequestCache;
			if (section.headers) {
				try {
					const parsedHeaders = JSON.parse(String(section.headers));
					if (parsedHeaders && typeof parsedHeaders === "object" && !Array.isArray(parsedHeaders)) {
						provider.headers = Object.fromEntries(
							Object.entries(parsedHeaders).map(([key, value]) => [key, String(value)]),
						);
					}
				} catch {
					// Invalid optional headers JSON is ignored.
				}
			}
			continue;
		}

		const providerAuth = sectionKey.match(/^provider\.([^.]+)\.auth$/);
		if (providerAuth) {
			const providerName = providerAuth[1];
			if (!compiled.providers[providerName]) compiled.providers[providerName] = { endpoint: "" };
			compiled.providers[providerName].auth = buildAuth(section);
			continue;
		}

		if (sectionKey === "versions") {
			for (const [key, value] of Object.entries(section)) compiled.versions[key] = String(value);
		}
	}

	return compiled;
}

export async function loadAPIConfigDir(
	configDir = ".EngineAPIConfig",
): Promise<EngineAPICompiledConfig> {
	try {
		const { readdir, readFile } = await import("fs/promises");
		const { join } = await import("path");
		const directoryPath = join(process.cwd(), configDir);

		try {
			const files = (await readdir(directoryPath))
				.filter((entry) => entry.endsWith(".api"))
				.sort();
			const sources = await Promise.all(
				files.map((file) => readFile(join(directoryPath, file), "utf8")),
			);
			return compileAPIConfig(sources.join("\n"));
		} catch {
			// Missing/unreadable config directory means an empty config, not a runtime failure.
			return { providers: {}, versions: {} };
		}
	} catch {
		return { providers: {}, versions: {} };
	}
}

// The no-argument path preserves the existing build/default injected-config
// semantics. Explicit directory requests are cached independently so one custom
// config directory can never poison another one.
let cachedCompiledConfig: EngineAPICompiledConfig | null = null;
let defaultConfigLoad: Promise<EngineAPICompiledConfig> | null = null;
const directoryConfigLoads = new Map<string, Promise<EngineAPICompiledConfig>>();

function directoryCacheKey(configDir: string): string {
	const cwd = typeof process !== "undefined" ? process.cwd() : "";
	return `${cwd}\u0000${configDir}`;
}

export function setCompiledAPIConfig(config: EngineAPICompiledConfig): void {
	cachedCompiledConfig = config;
	defaultConfigLoad = Promise.resolve(config);
}

export function getCompiledAPIConfig(): EngineAPICompiledConfig | null {
	return cachedCompiledConfig;
}

export async function ensureAPIConfig(configDir?: string): Promise<EngineAPICompiledConfig> {
	if (configDir === undefined) {
		if (cachedCompiledConfig) return cachedCompiledConfig;
		if (!defaultConfigLoad) {
			defaultConfigLoad = loadAPIConfigDir().then((config) => {
				cachedCompiledConfig = config;
				return config;
			});
		}
		return defaultConfigLoad;
	}

	const cacheKey = directoryCacheKey(configDir);
	let load = directoryConfigLoads.get(cacheKey);
	if (!load) {
		load = loadAPIConfigDir(configDir);
		directoryConfigLoads.set(cacheKey, load);
	}
	return load;
}
