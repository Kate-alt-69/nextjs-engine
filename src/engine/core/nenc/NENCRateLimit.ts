// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — command-specific rate limiting
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandRateLimit } from "./types";
import type { NENCAuthenticationContext } from "./NENCDispatcherTypes";

const RATE_KEY_PATTERN = /^[\x21-\x7E]{1,512}$/;

export interface NENCRateLimitContext extends NENCAuthenticationContext {
	principal: unknown;
}

export interface NENCRateLimitClaim {
	key: string;
	limit: number;
	windowMs: number;
	now: number;
}

export interface NENCRateLimitStoreDecision {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

export interface NENCRateLimitStore {
	/** Atomically consume one request from the fixed window represented by the claim. */
	consume(claim: NENCRateLimitClaim): NENCRateLimitStoreDecision | Promise<NENCRateLimitStoreDecision>;
}

export type NENCRateLimitReason = "ok" | "limit-exceeded" | "key-unavailable" | "store-error";

export interface NENCRateLimitDecision extends NENCRateLimitStoreDecision {
	reason: NENCRateLimitReason;
	retryAfterMs: number;
}

export interface NENCRateLimiterOptions {
	resolveKey(context: NENCRateLimitContext): string | null | undefined | Promise<string | null | undefined>;
	store?: NENCRateLimitStore;
	now?: () => number;
	onError?: (error: unknown, context: NENCRateLimitContext) => void;
}

interface MemoryRateEntry {
	count: number;
	resetAt: number;
}

export class NENCMemoryRateLimitStore implements NENCRateLimitStore {
	private readonly entries = new Map<string, MemoryRateEntry>();
	private operations = 0;

	consume(claim: NENCRateLimitClaim): NENCRateLimitStoreDecision {
		this.operations += 1;
		if (this.operations % 64 === 0) {
			for (const [key, entry] of this.entries) {
				if (entry.resetAt <= claim.now) this.entries.delete(key);
			}
		}

		let entry = this.entries.get(claim.key);
		if (!entry || entry.resetAt <= claim.now) {
			entry = { count: 0, resetAt: claim.now + claim.windowMs };
			this.entries.set(claim.key, entry);
		}
		if (entry.count >= claim.limit) {
			return { allowed: false, remaining: 0, resetAt: entry.resetAt };
		}
		entry.count += 1;
		return {
			allowed: true,
			remaining: Math.max(0, claim.limit - entry.count),
			resetAt: entry.resetAt,
		};
	}
}

function isValidPolicy(policy: EngineCommandRateLimit): boolean {
	return Number.isSafeInteger(policy.limit) && policy.limit >= 1
		&& Number.isSafeInteger(policy.windowMs) && policy.windowMs >= 1_000;
}

function isValidStoreDecision(decision: NENCRateLimitStoreDecision, now: number, limit: number): boolean {
	return typeof decision?.allowed === "boolean"
		&& Number.isSafeInteger(decision.remaining) && decision.remaining >= 0 && decision.remaining <= limit
		&& Number.isSafeInteger(decision.resetAt) && decision.resetAt >= now;
}

function reportError(options: NENCRateLimiterOptions, error: unknown, context: NENCRateLimitContext): void {
	try {
		options.onError?.(error, context);
	} catch {
		// A failed observability callback must not bypass the limiter.
	}
}

function denied(reason: NENCRateLimitReason): NENCRateLimitDecision {
	return { allowed: false, reason, remaining: 0, resetAt: 0, retryAfterMs: 1_000 };
}

export class NENCRateLimiter {
	private readonly options: NENCRateLimiterOptions;
	private readonly store: NENCRateLimitStore;

	constructor(options: NENCRateLimiterOptions) {
		if (typeof options.resolveKey !== "function") {
			throw new Error("[NENCRateLimiter] resolveKey() is required.");
		}
		this.options = options;
		this.store = options.store ?? new NENCMemoryRateLimitStore();
	}

	async check(policy: EngineCommandRateLimit, context: NENCRateLimitContext): Promise<NENCRateLimitDecision> {
		if (!isValidPolicy(policy)) return denied("store-error");
		const now = Math.floor(this.options.now?.() ?? Date.now());
		if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - policy.windowMs) {
			return denied("store-error");
		}

		let resolvedKey: string | null | undefined;
		try {
			resolvedKey = await this.options.resolveKey(context);
		} catch (error) {
			reportError(this.options, error, context);
			return denied("key-unavailable");
		}
		const key = typeof resolvedKey === "string" ? resolvedKey : "";
		if (!RATE_KEY_PATTERN.test(key)) return denied("key-unavailable");

		try {
			const decision = await this.store.consume({
				key: `${context.command.id}:${key}`,
				limit: policy.limit,
				windowMs: policy.windowMs,
				now,
			});
			if (!isValidStoreDecision(decision, now, policy.limit)) {
				reportError(this.options, new Error("[NENCRateLimiter] Store returned an invalid decision."), context);
				return denied("store-error");
			}
			return {
				...decision,
				reason: decision.allowed ? "ok" : "limit-exceeded",
				retryAfterMs: Math.max(0, decision.resetAt - now),
			};
		} catch (error) {
			reportError(this.options, error, context);
			return denied("store-error");
		}
	}
}
