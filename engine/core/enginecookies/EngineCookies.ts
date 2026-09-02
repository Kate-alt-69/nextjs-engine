// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineCookie metadata/index facade
// ─────────────────────────────────────────────────────────────────────────────

import { EngineTrustList } from "./EngineTrustList";
import type {
	EngineCookieIndexEntry,
	EngineCookieRegistration,
	EngineTrustListConfig,
} from "./types";

const ALIAS_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;

function randomStorageId(): string {
	if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
		throw new Error("[EngineCookies] Secure random generation is unavailable in this runtime.");
	}
	const bytes = new Uint8Array(18);
	crypto.getRandomValues(bytes);
	const opaque = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `ec_${opaque}`;
}

function cloneEntry(entry: EngineCookieIndexEntry): EngineCookieIndexEntry {
	return Object.freeze({
		...entry,
		commands: Object.freeze([...entry.commands]),
		device: entry.device
			? Object.freeze({ ...entry.device, publicKey: Object.freeze({ ...entry.device.publicKey }) })
			: undefined,
	});
}

export class EngineCookieIndex {
	private readonly byAlias = new Map<string, EngineCookieIndexEntry>();
	private readonly byStorageId = new Map<string, string>();

	register(input: EngineCookieRegistration): EngineCookieIndexEntry {
		const alias = input.alias.trim();
		if (!ALIAS_PATTERN.test(alias)) {
			throw new Error(`[EngineCookies] Invalid cookie alias "${input.alias}".`);
		}
		if (!input.owner.trim()) throw new Error(`[EngineCookies] "${alias}" requires an owner.`);
		if (!input.creator.trim()) throw new Error(`[EngineCookies] "${alias}" requires a creator.`);
		if (this.byAlias.has(alias)) throw new Error(`[EngineCookies] Cookie alias "${alias}" is already registered.`);

		const storageId = input.storageId?.trim() || randomStorageId();
		if (this.byStorageId.has(storageId)) throw new Error("[EngineCookies] Duplicate opaque storage id.");

		const entry = cloneEntry({
			alias,
			storageId,
			owner: input.owner.trim(),
			creator: input.creator.trim(),
			purpose: input.purpose?.trim() || undefined,
			createdAt: Date.now(),
			expiresAt: input.expiresAt,
			binding: input.binding ?? "none",
			commands: input.commands ?? [],
			device: input.device,
			environmentHash: input.environmentHash,
		});
		this.byAlias.set(alias, entry);
		this.byStorageId.set(storageId, alias);
		return entry;
	}

	get(alias: string): EngineCookieIndexEntry | undefined {
		this.pruneExpired();
		const entry = this.byAlias.get(alias);
		return entry ? cloneEntry(entry) : undefined;
	}

	findByStorageId(storageId: string): EngineCookieIndexEntry | undefined {
		this.pruneExpired();
		const alias = this.byStorageId.get(storageId);
		return alias ? this.get(alias) : undefined;
	}

	list(): readonly EngineCookieIndexEntry[] {
		this.pruneExpired();
		return Object.freeze([...this.byAlias.values()].map(cloneEntry));
	}

	remove(alias: string): boolean {
		const entry = this.byAlias.get(alias);
		if (!entry) return false;
		this.byAlias.delete(alias);
		this.byStorageId.delete(entry.storageId);
		return true;
	}

	clear(): void {
		this.byAlias.clear();
		this.byStorageId.clear();
	}

	private pruneExpired(now = Date.now()): void {
		for (const entry of this.byAlias.values()) {
			if (entry.expiresAt !== undefined && entry.expiresAt <= now) this.remove(entry.alias);
		}
	}
}

export const EngineCookies = Object.freeze({
	createIndex(): EngineCookieIndex {
		return new EngineCookieIndex();
	},
	trust(config: EngineTrustListConfig): EngineTrustList {
		return new EngineTrustList(config);
	},
});
