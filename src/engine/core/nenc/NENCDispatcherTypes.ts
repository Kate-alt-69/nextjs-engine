// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — NENC dispatcher contracts
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineAPIResolver } from "../EngineAPIResolver";
import type { EngineCORSRuleSet } from "../EngineCORS";
import type { EngineTrustList } from "../enginecookies";
import type { EngineCommandAuth } from "./types";
import type { NENCServerCommand, NENCServerManifest } from "./NENCManifest";
import type { NENCReplayGuard } from "./NENCReplay";
import type { NENCRateLimiter } from "./NENCRateLimit";

export interface NENCAuthenticationContext {
	request: Request;
	origin: string;
	command: NENCServerCommand;
	input: unknown;
}

export interface NENCAuthenticationResult {
	authenticated: boolean;
	principal?: unknown;
}

export interface NENCAuthorizationContext extends NENCAuthenticationContext {
	principal: unknown;
	permissions: readonly string[];
}

export interface NENCSignatureContext extends NENCAuthenticationContext {
	rawBody: string;
	signature: string | null;
	timestamp: string;
	nonce: string;
}

export interface NENCDispatcherOptions {
	manifest: NENCServerManifest;
	api: EngineAPIResolver | (() => EngineAPIResolver);
	trust?: EngineTrustList;
	cors?: EngineCORSRuleSet;
	replay?: NENCReplayGuard;
	rateLimit?: NENCRateLimiter;
	maxBodyBytes?: number;
	authenticate?: (
		auth: EngineCommandAuth,
		context: NENCAuthenticationContext,
	) => NENCAuthenticationResult | Promise<NENCAuthenticationResult>;
	authorize?: (context: NENCAuthorizationContext) => boolean | Promise<boolean>;
	verifySignature?: (context: NENCSignatureContext) => boolean | Promise<boolean>;
}

export type NENCRequestHandler = (request: Request) => Promise<Response>;
