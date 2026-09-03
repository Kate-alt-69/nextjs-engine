// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — command replay and fixed-window rate policy
// ─────────────────────────────────────────────────────────────────────────────

import type { NENCAuthorizationContext } from "./NENCDispatcherTypes";
import type { NENCReplayGuard } from "./NENCReplay";

const COMMAND_PATTERN = /^(?:\*|[A-Za-z][A-Za-z0-9._-]{0,127})$/;
const RATE_KEY_PATTERN = /^[^\u0000-\u001f\u007f]{1,512}$/;

export interface NENCRateLimitStore {
	consume(key: string, windowStart: number, expiresAt: number): number | Promise<number>;
}

export interface NENCRateLimiterOptions {
	limit: number;
	windowMs: number;
	store?: NENCRateLimitStore;
	namespace?: string;
}

export interface NENCRateLimitDecision {
	allowed: boolean;
	reason: "ok" | "limit-exceeded" | "invalid-key" | "store-failure";
	remaining: number;
	retryAfterMs: number;
}

export class NENCMemoryRateLimitStore implements NENCRateLimitStore {
	private readonly counters = new Map<string, { count: number; expiresAt: number }>();

	consume(key: string, windowStart: number, expiresAt: number): number {
		for (const [existingKey, counter] of this.counters) {
			if (counter.expiresAt <= windowStart) this.counters.delete(existingKey);
		}
		const current = this.counters.get(key);
		const count = current && current.expiresAt === expiresAt ? current.count + 1 : 1;
		this.counters.set(key, { count, expiresAt });
		return count;
	}
}

export class NENCRateLimiter {
	private readonly limit: number;
	private readonly windowMs: number;
	private readonly store: NENCRateLimitStore;
	private readonly namespace: string;

	constructor(options: NENCRateLimiterOptions) {
		if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
			throw new Error("[NENCCommandSecurity] Rate limit must be a positive safe integer.");
		}
		if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 1_000) {
			throw new Error("[NENCCommandSecurity] Rate window must be at least 1000ms.");
		}
		this.limit = options.limit;
		this.windowMs = options.windowMs;
		this.store = options.store ?? new NENCMemoryRateLimitStore();
		this.namespace = options.namespace?.trim() || "nenc";
		if (!RATE_KEY_PATTERN.test(this.namespace)) {
			throw new Error("[NENCCommandSecurity] Invalid rate-limit namespace.");
		}
	}

	async verify(key: string | null | undefined, now = Date.now()): Promise<NENCRateLimitDecision> {
		const normalizedKey = key?.trim();
		if (!normalizedKey || !RATE_KEY_PATTERN.test(normalizedKey) || !Number.isSafeInteger(now) || now < 0) {
			return { allowed: false, reason: "invalid-key", remaining: 0, retryAfterMs: 0 };
		}
		const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
		const expiresAt = windowStart + this.windowMs;
		let count: number;
		try {
			count = await this.store.consume(`${this.namespace}:${normalizedKey}`, windowStart, expiresAt);
		} catch {
			return { allowed: false, reason: "store-failure", remaining: 0, retryAfterMs: 0 };
		}
		if (!Number.isSafeInteger(count) || count < 1) {
			return { allowed: false, reason: "store-failure", remaining: 0, retryAfterMs: 0 };
		}
		return count <= this.limit
			? { allowed: true, reason: "ok", remaining: this.limit - count, retryAfterMs: 0 }
			: { allowed: false, reason: "limit-exceeded", remaining: 0, retryAfterMs: Math.max(1, expiresAt - now) };
	}
}

export interface NENCCommandRateRule {
	limiter: NENCRateLimiter;
	key(context: NENCAuthorizationContext): string | null | undefined | Promise<string | null | undefined>;
}

export interface NENCCommandSecurityRule {
	replay?: NENCReplayGuard;
	rate?: NENCCommandRateRule;
}

export interface NENCCommandSecurityPolicyOptions {
	rules: Readonly<Record<string, NENCCommandSecurityRule>>;
}

export class NENCCommandSecurityPolicy {
	private readonly rules: Readonly<Record<string, NENCCommandSecurityRule>>;

	constructor(options: NENCCommandSecurityPolicyOptions) {
		if (!options || !options.rules || typeof options.rules !== "object") {
			throw new Error("[NENCCommandSecurity] Command security rules are required.");
		}
		const rules: Record<string, NENCCommandSecurityRule> = Object.create(null);
		for (const [command, rule] of Object.entries(options.rules)) {
			if (!COMMAND_PATTERN.test(command)) {
				throw new Error(`[NENCCommandSecurity] Invalid command policy name "${command}".`);
			}
			if (!rule || typeof rule !== "object") {
				throw new Error(`[NENCCommandSecurity] Invalid policy for "${command}".`);
			}
			if (rule.replay && typeof rule.replay.verify !== "function") {
				throw new Error(`[NENCCommandSecurity] Invalid replay policy for "${command}".`);
			}
			if (rule.rate && (!(rule.rate.limiter instanceof NENCRateLimiter) || typeof rule.rate.key !== "function")) {
				throw new Error(`[NENCCommandSecurity] Invalid rate policy for "${command}".`);
			}
			rules[command] = Object.freeze({ ...rule, rate: rule.rate ? Object.freeze({ ...rule.rate }) : undefined });
		}
		this.rules = Object.freeze(rules);
	}

	private ruleFor(commandName: string): NENCCommandSecurityRule | undefined {
		return this.rules[commandName] ?? this.rules["*"];
	}

	replayFor(commandName: string): NENCReplayGuard | undefined {
		return this.ruleFor(commandName)?.replay;
	}

	async verifyRate(context: NENCAuthorizationContext): Promise<NENCRateLimitDecision | null> {
		const rate = this.ruleFor(context.command.name)?.rate;
		if (!rate) return null;
		let key: string | null | undefined;
		try {
			key = await rate.key(context);
		} catch {
			return { allowed: false, reason: "invalid-key", remaining: 0, retryAfterMs: 0 };
		}
		return rate.limiter.verify(key);
	}
}
