import "server-only";

import {
	NENCCommandSecurityPolicy,
	NENCMemoryRateLimitStore,
	NENCRateLimiter,
	createNENCAccountSessionPolicy,
	createNENCCommandAPIResolverFactory,
	createNENCDeviceSignatureVerifier,
	createNENCDispatcher,
} from "../../engine/server";
import type { NENCAccountPrincipal, NENCServerManifest } from "../../engine/server";
import {
	resolvePrivateSearchDevice,
	resolvePrivateSearchSession,
} from "./demoStore.server";
import { PRIVATE_SEARCH_BACKEND_TOKEN } from "./privateBackend.server";

const accountSessions = createNENCAccountSessionPolicy({
	resolveSession(tokenHash) {
		return resolvePrivateSearchSession(tokenHash);
	},
});

const verifyDeviceProof = createNENCDeviceSignatureVerifier({
	resolveIdentity(keyId) {
		return resolvePrivateSearchDevice(keyId);
	},
});

const privateSearchRate = new NENCRateLimiter({
	limit: 20,
	windowMs: 60_000,
	namespace: "private-search-example",
	store: new NENCMemoryRateLimitStore(),
});

const commandSecurity = new NENCCommandSecurityPolicy({
	rules: {
		privateSearch: {
			rate: {
				limiter: privateSearchRate,
				key: ({ principal }) => (principal as NENCAccountPrincipal | undefined)?.sessionId,
			},
		},
	},
});

const api = createNENCCommandAPIResolverFactory({
	resolve({ commandName, origin, principal }) {
		if (commandName !== "privateSearch" || !principal) {
			throw new Error("[PrivateSearch] No backend is configured for this command.");
		}
		const configuredEndpoint = process.env.ENGINE_PRIVATE_SEARCH_URL?.trim();
		return {
			endpoint: configuredEndpoint || new URL("/engine-private-search/backend", origin).toString(),
			method: "POST",
			cache: "no-store",
			auth: { type: "bearer", token: PRIVATE_SEARCH_BACKEND_TOKEN },
			headers: { "X-Engine-Command": "privateSearch" },
		};
	},
});

export default function createPrivateSearchHandler(manifest: NENCServerManifest) {
	return createNENCDispatcher({
		manifest,
		api,
		authenticate: accountSessions.authenticate,
		authorize: accountSessions.authorize,
		commandSecurity,
		verifySignature: verifyDeviceProof,
	});
}
