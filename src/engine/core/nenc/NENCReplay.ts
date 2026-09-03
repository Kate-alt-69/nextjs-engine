// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — NENC replay protection
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandReplayPolicy } from "./types";

export interface NENCReplayStore {
	claim(key: string, expiresAt: number): boolean | Promise<boolean>;
}

export interface NENCReplayGuardOptions {
	/** Backward-compatible default for both accepted age and future clock skew. */
	maxClockSkewMs?: number;
	maxAgeMs?: number;
	maxFutureSkewMs?: number;
	store?: NENCReplayStore;
}

export interface NENCReplayDecision {
	allowed: boolean;
	reason: "ok" | "invalid-timestamp" | "expired-timestamp" | "invalid-nonce" | "replayed-nonce";
}

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,192}$/;

export class NENCMemoryReplayStore implements NENCReplayStore {
	private readonly claims = new Map<string, number>();

	claim(key: string, expiresAt: number): boolean {
		const now = Date.now();
		for (const [existingKey, expiry] of this.claims) {
			if (expiry <= now) this.claims.delete(existingKey);
		}
		if (this.claims.has(key)) return false;
		this.claims.set(key, expiresAt);
		return true;
	}
}

export class NENCReplayGuard {
	private readonly maxAgeMs: number;
	private readonly maxFutureSkewMs: number;
	private readonly store: NENCReplayStore;

	constructor(options: NENCReplayGuardOptions = {}) {
		const legacyWindow = Math.max(1_000, Math.floor(options.maxClockSkewMs ?? 60_000));
		this.maxAgeMs = Math.max(1_000, Math.floor(options.maxAgeMs ?? legacyWindow));
		this.maxFutureSkewMs = Math.max(0, Math.floor(options.maxFutureSkewMs ?? legacyWindow));
		this.store = options.store ?? new NENCMemoryReplayStore();
	}

	async verify(
		timestampValue: string | null,
		nonce: string | null,
		now = Date.now(),
		policy: EngineCommandReplayPolicy = {},
	): Promise<NENCReplayDecision> {
		if (!timestampValue || !/^\d{10,16}$/.test(timestampValue)) {
			return { allowed: false, reason: "invalid-timestamp" };
		}
		const timestamp = Number(timestampValue);
		if (!Number.isSafeInteger(timestamp)) return { allowed: false, reason: "invalid-timestamp" };
		const maxAgeMs = Math.min(
			this.maxAgeMs,
			Math.max(1_000, Math.floor(policy.maxAgeMs ?? this.maxAgeMs)),
		);
		const maxFutureSkewMs = Math.min(
			this.maxFutureSkewMs,
			Math.max(0, Math.floor(policy.maxFutureSkewMs ?? this.maxFutureSkewMs)),
		);
		if (!Number.isSafeInteger(maxAgeMs) || !Number.isSafeInteger(maxFutureSkewMs)) {
			return { allowed: false, reason: "invalid-timestamp" };
		}
		if (timestamp < now - maxAgeMs || timestamp > now + maxFutureSkewMs) {
			return { allowed: false, reason: "expired-timestamp" };
		}
		if (!nonce || !NONCE_PATTERN.test(nonce)) return { allowed: false, reason: "invalid-nonce" };

		const expiry = Math.max(now + 1_000, timestamp + maxAgeMs);
		const claimed = await this.store.claim(`${timestamp}:${nonce}`, expiry);
		return claimed
			? { allowed: true, reason: "ok" }
			: { allowed: false, reason: "replayed-nonce" };
	}
}
