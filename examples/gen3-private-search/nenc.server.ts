import { EngineAPIResolver } from "../../src/engine/core/EngineAPIResolver";
import { isEngineDevicePublicIdentity } from "../../src/engine/core/enginecookies/EngineDeviceKey";
import {
	NENCCommandSecurityPolicy,
	NENCRateLimiter,
} from "../../src/engine/core/nenc/NENCCommandSecurity";
import { createNENCCommandAPIResolverFactory } from "../../src/engine/core/nenc/NENCCommandAPI";
import { createNENCDeviceSignatureVerifier } from "../../src/engine/core/nenc/NENCDeviceProof";
import { createNENCDispatcher } from "../../src/engine/core/nenc/NENCDispatcher";
import type { NENCAuthorizationContext } from "../../src/engine/core/nenc/NENCDispatcherTypes";
import type { NENCServerManifest } from "../../src/engine/core/nenc/NENCManifest";
import { createNENCAccountSessionPolicy } from "../../src/engine/core/nenc/NENCSessionAuth";
import { PrivateSearchAPIResolver } from "./runtime";
import { PrivateSearchSessionStore } from "./sessionStore";

export interface PrivateSearchServerOptions {
	backendBaseURL: string;
	backendToken: string;
	now?: () => number;
	sessionTTLms?: number;
}

function backendURL(baseURL: string, path: string): string {
	let base: URL;
	try {
		base = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
	} catch {
		throw new Error("[private-search example] PRIVATE_BACKEND_URL must be an absolute URL.");
	}
	if (base.protocol !== "http:" && base.protocol !== "https:") {
		throw new Error("[private-search example] PRIVATE_BACKEND_URL must use HTTP(S).");
	}
	return new URL(path, base).toString();
}

function sessionRateKey(context: NENCAuthorizationContext): string | null {
	if (!context.principal || typeof context.principal !== "object") return null;
	const sessionId = (context.principal as { sessionId?: unknown }).sessionId;
	return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}

export function createPrivateSearchHandler(
	manifest: NENCServerManifest,
	options: PrivateSearchServerOptions,
) {
	if (!options.backendToken.trim()) {
		throw new Error("[private-search example] PRIVATE_BACKEND_TOKEN is required.");
	}
	const sessions = new PrivateSearchSessionStore({
		now: options.now,
		sessionTTLms: options.sessionTTLms,
	});
	const loginAPI = new PrivateSearchAPIResolver({
		endpoint: backendURL(options.backendBaseURL, "login"),
		method: "POST",
		cache: "no-store",
		auth: { type: "bearer", token: options.backendToken },
	}, sessions);
	const searchAPI = new EngineAPIResolver({
		endpoint: backendURL(options.backendBaseURL, "search"),
		method: "POST",
		cache: "no-store",
		auth: { type: "bearer", token: options.backendToken },
	});
	const api = createNENCCommandAPIResolverFactory({
		resolve({ commandName }) {
			if (commandName === "account.login") return loginAPI;
			if (commandName === "catalog.privateSearch") return searchAPI;
			throw new Error("[private-search example] No backend is configured for this command.");
		},
	});
	const accountSessions = createNENCAccountSessionPolicy({
		now: options.now,
		resolveSession(tokenHash) {
			return sessions.resolveSession(tokenHash);
		},
	});
	const verifySignature = createNENCDeviceSignatureVerifier({
		async resolveIdentity(keyId, context) {
			if (context.command.name === "account.login") {
				const input = context.input as { deviceIdentity?: unknown };
				if (
					isEngineDevicePublicIdentity(input.deviceIdentity)
					&& input.deviceIdentity.keyId === keyId
				) return input.deviceIdentity;
			}
			return sessions.resolveRequestIdentity(context.request.headers.get("Cookie"), keyId);
		},
	});
	const commandSecurity = new NENCCommandSecurityPolicy({
		rules: {
			"account.login": {
				rate: {
					limiter: new NENCRateLimiter({ limit: 10, windowMs: 60_000, namespace: "login" }),
					key: ({ origin }) => origin,
				},
			},
			"catalog.privateSearch": {
				rate: {
					limiter: new NENCRateLimiter({ limit: 60, windowMs: 60_000, namespace: "search" }),
					key: sessionRateKey,
				},
			},
		},
	});

	return createNENCDispatcher({
		manifest,
		authenticate: accountSessions.authenticate,
		authorize: accountSessions.authorize,
		verifySignature,
		commandSecurity,
		api,
	});
}

function requiredEnvironment(name: string): string {
	const value = process.env[name];
	if (!value?.trim()) throw new Error(`[private-search example] ${name} is required.`);
	return value;
}

export default function createHandler(manifest: NENCServerManifest) {
	return createPrivateSearchHandler(manifest, {
		backendBaseURL: requiredEnvironment("PRIVATE_BACKEND_URL"),
		backendToken: requiredEnvironment("PRIVATE_BACKEND_TOKEN"),
	});
}
