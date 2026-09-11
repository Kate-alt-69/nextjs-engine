// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — request-scoped command API resolver factory
// ─────────────────────────────────────────────────────────────────────────────

import { EngineAPIResolver } from "../EngineAPIResolver";
import type { EngineAPIConfig } from "../EngineAPIResolver";
import type { EngineCommandAuth } from "./types";

export interface NENCCommandAPIContext {
	readonly commandName: string;
	readonly auth: EngineCommandAuth;
	readonly permissions: readonly string[];
	readonly principal: unknown;
	readonly origin: string;
	readonly signal: AbortSignal;
}

export type NENCCommandAPIResolverFactory = (
	context: NENCCommandAPIContext,
) => EngineAPIResolver | Promise<EngineAPIResolver>;

export interface NENCCommandAPIResolverFactoryOptions {
	readonly resolve: (
		context: NENCCommandAPIContext,
	) => EngineAPIResolver | EngineAPIConfig | Promise<EngineAPIResolver | EngineAPIConfig>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function cloneConfig(config: EngineAPIConfig): EngineAPIConfig {
	const endpoint = config.endpoint;
	return {
		...config,
		...(config.auth ? { auth: { ...config.auth } } : {}),
		...(config.headers ? { headers: { ...config.headers } } : {}),
		...(config.versionMacros ? { versionMacros: { ...config.versionMacros } } : {}),
		...(typeof endpoint === "object" && endpoint !== null
			? { endpoint: { static: endpoint.static, ...(endpoint.operation ? { operation: endpoint.operation } : {}) } }
			: {}),
	};
}

export function createNENCCommandAPIResolverFactory(
	options: NENCCommandAPIResolverFactoryOptions,
): NENCCommandAPIResolverFactory {
	if (!options || typeof options.resolve !== "function") {
		throw new Error("[NENCCommandAPI] resolve() is required.");
	}
	return async (context: NENCCommandAPIContext): Promise<EngineAPIResolver> => {
		const resolved = await options.resolve(context);
		if (resolved instanceof EngineAPIResolver) return resolved;
		if (!isPlainObject(resolved)) {
			throw new Error("[NENCCommandAPI] Resolver configuration must be a plain object.");
		}
		return new EngineAPIResolver(cloneConfig(resolved as EngineAPIConfig));
	};
}
