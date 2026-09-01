// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineCookies contracts
// ─────────────────────────────────────────────────────────────────────────────

export type EngineCookieAction = "read" | "write" | "use" | "delete";
export type EngineCookieBindingMode = "none" | "device-key" | "device-key+environment" | "strict";

export interface NativeCookieOptions {
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: "strict" | "lax" | "none";
	domain?: string;
	path?: string;
	maxAge?: number;
	expires?: Date;
}

export interface EngineCookieGrant {
	cookie: string | "*";
	actions: readonly EngineCookieAction[];
	commands?: readonly string[];
}

export interface EngineTrustRule {
	origin: string;
	cors?: boolean;
	commands?: readonly string[];
	cookies?: readonly EngineCookieGrant[];
}

export interface EngineTrustListConfig {
	rules: readonly EngineTrustRule[];
}

export interface EngineCookieAccessRequest {
	origin: string;
	cookie: string;
	action: EngineCookieAction;
	command?: string;
}

export interface EngineCookieAccessDecision {
	allowed: boolean;
	reason: string;
	matchedOrigin?: string;
}

export interface EngineCookieRegistration {
	alias: string;
	owner: string;
	creator: string;
	purpose?: string;
	expiresAt?: number;
	binding?: EngineCookieBindingMode;
	commands?: readonly string[];
	storageId?: string;
}

/** Metadata only. Raw or sealed credential payloads never belong in this index. */
export interface EngineCookieIndexEntry {
	alias: string;
	storageId: string;
	owner: string;
	creator: string;
	purpose?: string;
	createdAt: number;
	expiresAt?: number;
	binding: EngineCookieBindingMode;
	commands: readonly string[];
}
