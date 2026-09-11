import {
	hashNENCSessionToken,
	type NENCAccountSession,
} from "../../src/engine/core/nenc/NENCSessionAuth";
import {
	isEngineDevicePublicIdentity,
} from "../../src/engine/core/enginecookies/EngineDeviceKey";
import type { EngineDevicePublicIdentity } from "../../src/engine/core/enginecookies/types";

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1_000;
const SESSION_COOKIE_NAME = "__Host-engine-session";
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface PrivateSearchAccount {
	id: string;
	displayName: string;
	permissions: readonly string[];
}

export interface IssuedPrivateSearchSession {
	cookie: string;
	expiresAt: number;
}

function randomToken(): string {
	if (!globalThis.crypto?.getRandomValues) {
		throw new Error("[private-search example] Secure random generation is unavailable.");
	}
	const bytes = new Uint8Array(32);
	globalThis.crypto.getRandomValues(bytes);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function validAccount(account: PrivateSearchAccount): boolean {
	return typeof account.id === "string" && account.id.length > 0
		&& typeof account.displayName === "string" && account.displayName.length > 0
		&& Array.isArray(account.permissions)
		&& account.permissions.every((permission) => typeof permission === "string" && permission.length > 0);
}

function cloneIdentity(identity: EngineDevicePublicIdentity): EngineDevicePublicIdentity {
	return Object.freeze({
		...identity,
		publicKey: Object.freeze({ ...identity.publicKey }),
	});
}

function readSessionToken(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	let token: string | null = null;
	for (const segment of cookieHeader.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0 || segment.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
		if (token !== null) return null;
		token = segment.slice(separator + 1).trim();
	}
	return token;
}

export class PrivateSearchSessionStore {
	private readonly sessions = new Map<string, NENCAccountSession>();
	private readonly sessionDevices = new Map<string, EngineDevicePublicIdentity>();
	private readonly now: () => number;
	private readonly sessionTTLms: number;

	constructor(options: { now?: () => number; sessionTTLms?: number } = {}) {
		this.now = options.now ?? Date.now;
		this.sessionTTLms = Math.floor(options.sessionTTLms ?? DEFAULT_SESSION_TTL_MS);
		if (!Number.isSafeInteger(this.sessionTTLms) || this.sessionTTLms < 60_000) {
			throw new Error("[private-search example] sessionTTLms must be at least 60000ms.");
		}
	}

	async issue(
		account: PrivateSearchAccount,
		identity: EngineDevicePublicIdentity,
	): Promise<IssuedPrivateSearchSession> {
		if (!validAccount(account)) throw new Error("[private-search example] Invalid backend account.");
		if (!isEngineDevicePublicIdentity(identity)) {
			throw new Error("[private-search example] Invalid device identity.");
		}
		const issuedAt = this.now();
		if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) {
			throw new Error("[private-search example] Invalid server clock.");
		}
		const expiresAt = issuedAt + this.sessionTTLms;
		if (!Number.isSafeInteger(expiresAt)) throw new Error("[private-search example] Session expiry overflow.");

		const token = randomToken();
		const tokenHash = await hashNENCSessionToken(token);
		this.sessionDevices.set(tokenHash, cloneIdentity(identity));
		this.sessions.set(tokenHash, Object.freeze({
			id: `session:${tokenHash.slice(0, 16)}`,
			subject: account.id,
			permissions: Object.freeze([...account.permissions]),
			commands: Object.freeze(["catalog.privateSearch"]),
			expiresAt,
			deviceKeyId: identity.keyId,
			claims: Object.freeze({ displayName: account.displayName }),
		}));

		const maxAge = Math.max(1, Math.floor(this.sessionTTLms / 1_000));
		return Object.freeze({
			cookie: `__Host-engine-session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`,
			expiresAt,
		});
	}

	resolveSession(tokenHash: string): NENCAccountSession | null {
		const session = this.sessions.get(tokenHash);
		if (!session) return null;
		if (session.expiresAt <= this.now()) {
			this.sessions.delete(tokenHash);
			this.sessionDevices.delete(tokenHash);
			return null;
		}
		return session;
	}

	async resolveRequestIdentity(
		cookieHeader: string | null,
		keyId: string,
	): Promise<EngineDevicePublicIdentity | null> {
		const token = readSessionToken(cookieHeader);
		if (!token || token.length < 32 || token.length > 512 || !SESSION_TOKEN_PATTERN.test(token)) return null;
		const tokenHash = await hashNENCSessionToken(token);
		const session = this.resolveSession(tokenHash);
		const identity = this.sessionDevices.get(tokenHash);
		if (!session || !identity || session.deviceKeyId !== keyId || identity.keyId !== keyId) return null;
		return cloneIdentity(identity);
	}
}
