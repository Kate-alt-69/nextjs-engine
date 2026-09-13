import "server-only";

import type { EngineDevicePublicIdentity } from "../../engine/network";
import type { NENCAccountSession } from "../../engine/server";
import { hashNENCSessionToken } from "../../engine/server";

export const PRIVATE_SEARCH_COOKIE = "__Host-engine-session";
export const PRIVATE_SEARCH_DEMO_EMAIL = "kate@example.com";
export const PRIVATE_SEARCH_DEMO_PASSWORD = "engine-demo";

const SESSION_LIFETIME_MS = 15 * 60 * 1_000;
const TOKEN_BYTES = 32;

interface DemoSessionState {
	readonly sessions: Map<string, NENCAccountSession<{ readonly email: string }>>;
	readonly devices: Map<string, EngineDevicePublicIdentity>;
}

interface DemoStoreGlobal {
	__NEXTJS_ENGINE_PRIVATE_SEARCH_DEMO__?: DemoSessionState;
}

function demoState(): DemoSessionState {
	const root = globalThis as typeof globalThis & DemoStoreGlobal;
	if (!root.__NEXTJS_ENGINE_PRIVATE_SEARCH_DEMO__) {
		root.__NEXTJS_ENGINE_PRIVATE_SEARCH_DEMO__ = {
			sessions: new Map(),
			devices: new Map(),
		};
	}
	return root.__NEXTJS_ENGINE_PRIVATE_SEARCH_DEMO__;
}

function randomToken(): string {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function removeExpiredSessions(now = Date.now()): void {
	for (const [tokenHash, session] of demoState().sessions) {
		if (session.revoked || session.expiresAt <= now) demoState().sessions.delete(tokenHash);
	}
}

export async function issuePrivateSearchSession(
	identity: EngineDevicePublicIdentity,
	origin: string,
): Promise<{ readonly token: string; readonly session: NENCAccountSession<{ readonly email: string }> }> {
	removeExpiredSessions();
	const token = randomToken();
	const tokenHash = await hashNENCSessionToken(token);
	const session: NENCAccountSession<{ readonly email: string }> = Object.freeze({
		id: `demo-${crypto.randomUUID()}`,
		subject: "account-kate",
		permissions: Object.freeze(["catalog.read"]),
		commands: Object.freeze(["privateSearch"]),
		origins: Object.freeze([origin]),
		expiresAt: Date.now() + SESSION_LIFETIME_MS,
		deviceKeyId: identity.keyId,
		claims: Object.freeze({ email: PRIVATE_SEARCH_DEMO_EMAIL }),
	});
	demoState().devices.set(identity.keyId, identity);
	demoState().sessions.set(tokenHash, session);
	return { token, session };
}

export function resolvePrivateSearchSession(
	tokenHash: string,
): NENCAccountSession<{ readonly email: string }> | null {
	removeExpiredSessions();
	return demoState().sessions.get(tokenHash) ?? null;
}

export function resolvePrivateSearchDevice(keyId: string): EngineDevicePublicIdentity | null {
	return demoState().devices.get(keyId) ?? null;
}

export function readPrivateSearchCookie(request: Request): string | null {
	const cookieHeader = request.headers.get("Cookie");
	if (!cookieHeader) return null;
	let token: string | null = null;
	for (const segment of cookieHeader.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0 || segment.slice(0, separator).trim() !== PRIVATE_SEARCH_COOKIE) continue;
		if (token !== null) return null;
		token = segment.slice(separator + 1).trim();
	}
	return token;
}

export async function revokePrivateSearchSession(token: string | null): Promise<void> {
	if (!token) return;
	demoState().sessions.delete(await hashNENCSessionToken(token));
}
