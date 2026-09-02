// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — account-session authentication policy adapter
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandAuth } from "./types";
import type { NENCVerifiedDeviceKeySource } from "./NENCDeviceProof";
import type {
	NENCAuthenticationContext,
	NENCAuthenticationResult,
	NENCAuthorizationContext,
} from "./NENCDispatcherTypes";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@~-]{0,255}$/;
const PERMISSION_PATTERN = /^[A-Za-z][A-Za-z0-9_:-]*(?:\.[A-Za-z0-9_:-]+)*(?:\.\*)?$/;
const accountPrincipals = new WeakSet<object>();

export type NENCAccountPermissionWildcards = "none" | "namespace";

export type NENCAccountSessionRejection =
	| "resolver-error"
	| "invalid-session"
	| "not-active"
	| "expired"
	| "origin-mismatch"
	| "device-proof-required"
	| "device-key-mismatch";

export interface NENCAccountSession<Attributes = unknown> {
	/** Non-secret internal identifier. Never put the raw session credential here. */
	sessionId: string;
	accountId: string;
	permissions?: readonly string[];
	issuedAt?: number;
	notBefore?: number;
	expiresAt: number;
	origin?: string;
	deviceKeyId?: string;
	attributes?: Attributes;
}

export interface NENCAccountPrincipal<Attributes = unknown> {
	readonly type: "account";
	readonly sessionId: string;
	readonly accountId: string;
	readonly permissions: readonly string[];
	readonly issuedAt?: number;
	readonly expiresAt: number;
	readonly origin?: string;
	readonly deviceKeyId?: string;
	readonly attributes?: Attributes;
}

export interface NENCAccountPolicyOptions<Attributes = unknown> {
	/** Resolve and validate the application's existing session credential. */
	resolveSession(
		context: NENCAuthenticationContext,
	): NENCAccountSession<Attributes> | null | Promise<NENCAccountSession<Attributes> | null>;
	now?: () => number;
	clockSkewMs?: number;
	permissionWildcards?: NENCAccountPermissionWildcards;
	verifiedDeviceKeys?: NENCVerifiedDeviceKeySource;
	authenticateOther?: (
		auth: EngineCommandAuth,
		context: NENCAuthenticationContext,
	) => NENCAuthenticationResult | Promise<NENCAuthenticationResult>;
	authorizeOther?: (context: NENCAuthorizationContext) => boolean | Promise<boolean>;
	onSessionRejected?: (
		reason: NENCAccountSessionRejection,
		context: NENCAuthenticationContext,
		error?: unknown,
	) => void;
}

export interface NENCAccountPolicy {
	authenticate(
		auth: EngineCommandAuth,
		context: NENCAuthenticationContext,
	): Promise<NENCAuthenticationResult>;
	authorize(context: NENCAuthorizationContext): Promise<boolean>;
}

function normalizeOrigin(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function isTimestamp(value: number | undefined): boolean {
	return value === undefined || (Number.isSafeInteger(value) && value >= 0);
}

function reportRejection(
	options: NENCAccountPolicyOptions,
	reason: NENCAccountSessionRejection,
	context: NENCAuthenticationContext,
	error?: unknown,
): void {
	try {
		options.onSessionRejected?.(reason, context, error);
	} catch {
		// Authentication remains fail-closed even if an observability callback fails.
	}
}

function normalizeSession<Attributes>(
	session: NENCAccountSession<Attributes>,
	context: NENCAuthenticationContext,
	options: NENCAccountPolicyOptions<Attributes>,
): NENCAccountPrincipal<Attributes> | NENCAccountSessionRejection {
	if (
		!IDENTIFIER_PATTERN.test(session.sessionId)
		|| !IDENTIFIER_PATTERN.test(session.accountId)
		|| (session.deviceKeyId !== undefined && !IDENTIFIER_PATTERN.test(session.deviceKeyId))
		|| !isTimestamp(session.issuedAt)
		|| !isTimestamp(session.notBefore)
		|| !isTimestamp(session.expiresAt)
		|| !Array.isArray(session.permissions ?? [])
	) return "invalid-session";

	const permissions = [...new Set(session.permissions ?? [])];
	if (permissions.some((permission) => typeof permission !== "string" || !PERMISSION_PATTERN.test(permission))) {
		return "invalid-session";
	}

	const now = Math.floor(options.now?.() ?? Date.now());
	const clockSkewMs = Math.max(0, Math.floor(options.clockSkewMs ?? 0));
	if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(clockSkewMs)) return "invalid-session";
	if (session.issuedAt !== undefined && session.issuedAt > now + clockSkewMs) return "not-active";
	if (session.notBefore !== undefined && session.notBefore > now + clockSkewMs) return "not-active";
	if (session.expiresAt <= now - clockSkewMs) return "expired";

	let origin: string | undefined;
	if (session.origin !== undefined) {
		origin = normalizeOrigin(session.origin) ?? undefined;
		if (!origin) return "invalid-session";
		if (origin !== context.origin) return "origin-mismatch";
	}
	if (session.deviceKeyId !== undefined) {
		const verifiedKeyId = options.verifiedDeviceKeys?.getVerifiedKeyId(context.request);
		if (!verifiedKeyId) return "device-proof-required";
		if (verifiedKeyId !== session.deviceKeyId) return "device-key-mismatch";
	}

	const principal = Object.freeze({
		type: "account" as const,
		sessionId: session.sessionId,
		accountId: session.accountId,
		permissions: Object.freeze(permissions),
		...(session.issuedAt === undefined ? {} : { issuedAt: session.issuedAt }),
		expiresAt: session.expiresAt,
		...(origin === undefined ? {} : { origin }),
		...(session.deviceKeyId === undefined ? {} : { deviceKeyId: session.deviceKeyId }),
		...(session.attributes === undefined ? {} : { attributes: session.attributes }),
	});
	accountPrincipals.add(principal);
	return principal;
}

function grantsPermission(
	grants: readonly string[],
	required: string,
	wildcards: NENCAccountPermissionWildcards,
): boolean {
	if (!PERMISSION_PATTERN.test(required) || required.endsWith(".*")) return false;
	if (grants.includes(required)) return true;
	if (wildcards !== "namespace") return false;
	return grants.some((grant) => {
		if (!grant.endsWith(".*")) return false;
		const prefix = grant.slice(0, -1);
		return required.length > prefix.length && required.startsWith(prefix);
	});
}

export function isNENCAccountPrincipal(value: unknown): value is NENCAccountPrincipal {
	return typeof value === "object" && value !== null && accountPrincipals.has(value);
}

export function createNENCAccountPolicy<Attributes = unknown>(
	options: NENCAccountPolicyOptions<Attributes>,
): NENCAccountPolicy {
	const wildcards = options.permissionWildcards ?? "none";
	if (wildcards !== "none" && wildcards !== "namespace") {
		throw new Error(`[NENCAccountPolicy] Unsupported permission wildcard mode "${wildcards}".`);
	}

	return Object.freeze({
		async authenticate(
			auth: EngineCommandAuth,
			context: NENCAuthenticationContext,
		): Promise<NENCAuthenticationResult> {
			if (auth !== "account") {
				return options.authenticateOther?.(auth, context) ?? { authenticated: false };
			}

			let session: NENCAccountSession<Attributes> | null;
			try {
				session = await options.resolveSession(context);
			} catch (error) {
				reportRejection(options, "resolver-error", context, error);
				return { authenticated: false };
			}
			if (!session) return { authenticated: false };

			const principal = normalizeSession(session, context, options);
			if (typeof principal === "string") {
				reportRejection(options, principal, context);
				return { authenticated: false };
			}
			return { authenticated: true, principal };
		},

		async authorize(context: NENCAuthorizationContext): Promise<boolean> {
			if (!isNENCAccountPrincipal(context.principal)) {
				return options.authorizeOther?.(context) ?? false;
			}
			const principal = context.principal;
			return context.permissions.every((permission) => (
				grantsPermission(principal.permissions, permission, wildcards)
			));
		},
	});
}
