// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — granular origin/cookie/command trust policy
// ─────────────────────────────────────────────────────────────────────────────

import type {
	EngineCookieAccessDecision,
	EngineCookieAccessRequest,
	EngineCookieGrant,
	EngineTrustListConfig,
	EngineTrustRule,
} from "./types";

function normalizeOrigin(value: string): string | null {
	if (value === "*") return "*";
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
		return parsed.origin;
	} catch {
		return null;
	}
}

function copyGrant(grant: EngineCookieGrant): EngineCookieGrant {
	return Object.freeze({
		cookie: grant.cookie,
		actions: Object.freeze([...grant.actions]),
		commands: grant.commands ? Object.freeze([...grant.commands]) : undefined,
	});
}

function copyRule(rule: EngineTrustRule, origin: string): EngineTrustRule {
	return Object.freeze({
		origin,
		cors: rule.cors === true,
		commands: rule.commands ? Object.freeze([...rule.commands]) : undefined,
		cookies: rule.cookies ? Object.freeze(rule.cookies.map(copyGrant)) : undefined,
	});
}

function includesValue(values: readonly string[] | undefined, value: string): boolean {
	return values?.includes("*") === true || values?.includes(value) === true;
}

export class EngineTrustList {
	private readonly rules = new Map<string, EngineTrustRule>();

	constructor(config: EngineTrustListConfig) {
		for (const rawRule of config.rules) {
			const origin = normalizeOrigin(rawRule.origin);
			if (!origin) throw new Error(`[EngineCookies] Invalid trust-list origin: ${rawRule.origin}`);
			if (this.rules.has(origin)) throw new Error(`[EngineCookies] Duplicate trust-list origin: ${origin}`);
			if (origin === "*" && ((rawRule.commands?.length ?? 0) > 0 || (rawRule.cookies?.length ?? 0) > 0)) {
				throw new Error("[EngineCookies] Wildcard origins may grant CORS only; privileged cookie/command access requires an exact origin.");
			}
			this.rules.set(origin, copyRule(rawRule, origin));
		}
	}

	canCors(origin: string): boolean {
		const normalized = normalizeOrigin(origin);
		if (!normalized || normalized === "*") return false;
		return this.rules.get(normalized)?.cors === true || this.rules.get("*")?.cors === true;
	}

	authorizeCommand(origin: string, command: string): EngineCookieAccessDecision {
		const rule = this.getExactRule(origin);
		if (!rule) return { allowed: false, reason: "origin-not-trusted" };
		if (!includesValue(rule.commands, command)) {
			return { allowed: false, reason: "command-not-authorized", matchedOrigin: rule.origin };
		}
		return { allowed: true, reason: "command-authorized", matchedOrigin: rule.origin };
	}

	authorizeCookie(request: EngineCookieAccessRequest): EngineCookieAccessDecision {
		const rule = this.getExactRule(request.origin);
		if (!rule) return { allowed: false, reason: "origin-not-trusted" };

		const grant = rule.cookies?.find((candidate) => candidate.cookie === request.cookie || candidate.cookie === "*");
		if (!grant) return { allowed: false, reason: "cookie-not-authorized", matchedOrigin: rule.origin };
		if (!grant.actions.includes(request.action)) {
			return { allowed: false, reason: "cookie-action-not-authorized", matchedOrigin: rule.origin };
		}
		if (grant.commands && (!request.command || !includesValue(grant.commands, request.command))) {
			return { allowed: false, reason: "cookie-command-not-authorized", matchedOrigin: rule.origin };
		}
		return { allowed: true, reason: "cookie-authorized", matchedOrigin: rule.origin };
	}

	inspect(): readonly EngineTrustRule[] {
		return Object.freeze([...this.rules.values()]);
	}

	private getExactRule(origin: string): EngineTrustRule | undefined {
		const normalized = normalizeOrigin(origin);
		if (!normalized || normalized === "*") return undefined;
		return this.rules.get(normalized);
	}
}
