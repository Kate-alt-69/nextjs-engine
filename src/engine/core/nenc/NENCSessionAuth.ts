// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — fail-closed account session policy
// ─────────────────────────────────────────────────────────────────────────────

import { decodeEngineDeviceProof } from "../enginecookies/EngineDeviceKey";
import type { EngineCommandAuth } from "./types";
import type {
	NENCAuthenticationContext,
	NENCAuthenticationResult,
	NENCAuthorizationContext,
} from "./NENCDispatcherTypes";

const DEFAULT_COOKIE_NAME = "__Host-engine-session";
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface NENCAccountSession<Claims = unknown> {
	id: string;
	subject: string;
	permissions?: readonly string[];
	commands?: readonly string[];
	origins?: readonly string[];
	notBefore?: number;
	expiresAt: number;
	revoked?: boolean;
	deviceKeyId?: string;
	claims?: Claims;
}

export interface NENCAccountPrincipal<Claims = unknown> {
	sessionId: string;
	subject: string;
	permissions: readonly string[];
	deviceKeyId?: string;
	claims?: Claims;
}

export interface NENCAccountSessionLookupContext {
	origin: string;
	commandName: string;
	input: unknown;
	signature: string | null;
	signatureVerified: boolean;
	timestamp: string;
	nonce: string;
}

export type NENCAccountSessionResolver<Claims = unknown> = (
	tokenHash: string,
	context: NENCAccountSessionLookupContext,
) => NENCAccountSession<Claims> | null | undefined | Promise<NENCAccountSession<Claims> | null | undefined>;

export interface NENCAccountSessionPolicyOptions<Claims = unknown> {
	resolveSession: NENCAccountSessionResolver<Claims>;
	cookieName?: string;
	minTokenLength?: number;
	maxTokenLength?: number;
	now?: () => number;
	authenticateOther?: (
		auth: EngineCommandAuth,
		context: NENCAuthenticationContext,
	) => NENCAuthenticationResult | Promise<NENCAuthenticationResult>;
	authorizeOther?: (context: NENCAuthorizationContext) => boolean | Promise<boolean>;
}

export interface NENCAccountSessionPolicy {
	authenticate(
		auth: EngineCommandAuth,
		context: NENCAuthenticationContext,
	): Promise<NENCAuthenticationResult>;
	authorize(context: NENCAuthorizationContext): Promise<boolean>;
}

function webCrypto(): Crypto {
	if (typeof crypto === "undefined" || !crypto.subtle) {
		throw new Error("[NENCSessionAuth] Web Crypto is unavailable in this runtime.");
	}
	return crypto;
}

function bytesToBase64URL(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

export async function hashNENCSessionToken(token: string): Promise<string> {
	const digest = await webCrypto().subtle.digest(
		"SHA-256",
		asArrayBuffer(new TextEncoder().encode(token)),
	);
	return bytesToBase64URL(new Uint8Array(digest));
}

function readSingleCookie(header: string | null, name: string): string | null {
	if (!header) return null;
	let value: string | null = null;
	for (const segment of header.split(";")) {
		const separator = segment.indexOf("=");
		if (separator < 0 || segment.slice(0, separator).trim() !== name) continue;
		if (value !== null) return null;
		value = segment.slice(separator + 1).trim();
	}
	return value;
}

function validStringArray(value: unknown): value is readonly string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
}

function normalizeOrigin(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		return url.origin;
	} catch {
		return null;
	}
}

function isValidSession<Claims>(value: unknown): value is NENCAccountSession<Claims> {
	if (!value || typeof value !== "object") return false;
	const session = value as Partial<NENCAccountSession<Claims>>;
	return typeof session.id === "string" && session.id.length > 0
		&& typeof session.subject === "string" && session.subject.length > 0
		&& Number.isSafeInteger(session.expiresAt) && (session.expiresAt as number) >= 0
		&& (session.notBefore === undefined || Number.isSafeInteger(session.notBefore) && session.notBefore >= 0)
		&& (session.revoked === undefined || typeof session.revoked === "boolean")
		&& (session.deviceKeyId === undefined || typeof session.deviceKeyId === "string" && session.deviceKeyId.length > 0)
		&& (session.permissions === undefined || validStringArray(session.permissions))
		&& (session.commands === undefined || validStringArray(session.commands))
		&& (session.origins === undefined || validStringArray(session.origins)
			&& session.origins.every((origin) => normalizeOrigin(origin) !== null));
}

function originAllowed(origin: string, allowed: readonly string[] | undefined): boolean {
	if (!allowed) return true;
	const normalized = normalizeOrigin(origin);
	return normalized !== null && allowed.some((candidate) => normalizeOrigin(candidate) === normalized);
}

function hasPermission(granted: readonly string[], required: string): boolean {
	return granted.includes("*") || granted.includes(required);
}

function isAccountPrincipal(value: unknown): value is NENCAccountPrincipal {
	if (!value || typeof value !== "object") return false;
	const principal = value as Partial<NENCAccountPrincipal>;
	return typeof principal.sessionId === "string"
		&& typeof principal.subject === "string"
		&& validStringArray(principal.permissions);
}

function createLookupContext(context: NENCAuthenticationContext): NENCAccountSessionLookupContext {
	return Object.freeze({
		origin: context.origin,
		commandName: context.command.name,
		input: context.input,
		signature: context.signature,
		signatureVerified: context.signatureVerified,
		timestamp: context.timestamp,
		nonce: context.nonce,
	});
}

export function createNENCAccountSessionPolicy<Claims = unknown>(
	options: NENCAccountSessionPolicyOptions<Claims>,
): NENCAccountSessionPolicy {
	if (!options || typeof options.resolveSession !== "function") {
		throw new Error("[NENCSessionAuth] resolveSession() is required.");
	}
	const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
	if (!COOKIE_NAME_PATTERN.test(cookieName)) throw new Error("[NENCSessionAuth] Invalid session cookie name.");
	const minTokenLength = Math.max(1, Math.floor(options.minTokenLength ?? 32));
	const maxTokenLength = Math.max(minTokenLength, Math.floor(options.maxTokenLength ?? 512));
	const now = options.now ?? Date.now;

	return Object.freeze({
		async authenticate(
			auth: EngineCommandAuth,
			context: NENCAuthenticationContext,
		): Promise<NENCAuthenticationResult> {
			if (auth !== "account") {
				return options.authenticateOther
					? options.authenticateOther(auth, context)
					: { authenticated: false };
			}

			const token = readSingleCookie(context.request.headers.get("Cookie"), cookieName);
			if (
				!token || token.length < minTokenLength || token.length > maxTokenLength
				|| !TOKEN_PATTERN.test(token)
			) return { authenticated: false };

			let session: NENCAccountSession<Claims> | null | undefined;
			try {
				session = await options.resolveSession(
					await hashNENCSessionToken(token),
					createLookupContext(context),
				);
			} catch {
				return { authenticated: false };
			}
			if (!isValidSession<Claims>(session)) return { authenticated: false };

			const currentTime = now();
			if (!Number.isSafeInteger(currentTime) || currentTime < 0) return { authenticated: false };
			if (session.revoked || session.expiresAt <= currentTime) return { authenticated: false };
			if (session.notBefore !== undefined && session.notBefore > currentTime) return { authenticated: false };
			if (session.commands && !session.commands.includes(context.command.name)) return { authenticated: false };
			if (!originAllowed(context.origin, session.origins)) return { authenticated: false };

			if (session.deviceKeyId) {
				if (!context.signatureVerified || !context.signature) return { authenticated: false };
				const proof = decodeEngineDeviceProof(context.signature);
				if (!proof || proof.keyId !== session.deviceKeyId) return { authenticated: false };
			}

			const principal: NENCAccountPrincipal<Claims> = Object.freeze({
				sessionId: session.id,
				subject: session.subject,
				permissions: Object.freeze([...(session.permissions ?? [])]),
				...(session.deviceKeyId ? { deviceKeyId: session.deviceKeyId } : {}),
				...(session.claims !== undefined ? { claims: session.claims } : {}),
			});
			return { authenticated: true, principal };
		},

		async authorize(context: NENCAuthorizationContext): Promise<boolean> {
			if (context.command.auth !== "account") {
				return options.authorizeOther ? options.authorizeOther(context) : false;
			}
			if (!isAccountPrincipal(context.principal)) return false;
			const principal = context.principal;
			return context.permissions.every((permission) => hasPermission(principal.permissions, permission));
		},
	});
}
