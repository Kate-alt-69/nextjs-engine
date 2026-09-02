// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — NENC device-proof verification adapter
// ─────────────────────────────────────────────────────────────────────────────

import {
	decodeEngineDeviceProof,
	hashEngineDeviceValue,
	verifyEngineDeviceProof,
} from "../enginecookies/EngineDeviceKey";
import type { EngineDeviceProof, EngineDevicePublicIdentity } from "../enginecookies/types";
import type { NENCSignatureContext } from "./NENCDispatcherTypes";

export interface NENCDeviceIdentityContext extends NENCSignatureContext {
	proof: EngineDeviceProof;
}

export interface NENCDeviceSignatureVerifierOptions {
	resolveIdentity(
		keyId: string,
		context: NENCDeviceIdentityContext,
	): EngineDevicePublicIdentity | null | undefined | Promise<EngineDevicePublicIdentity | null | undefined>;
}

export function createNENCDeviceSignatureVerifier(
	options: NENCDeviceSignatureVerifierOptions,
): (context: NENCSignatureContext) => Promise<boolean> {
	return async (context: NENCSignatureContext): Promise<boolean> => {
		if (!context.signature) return false;
		const proof = decodeEngineDeviceProof(context.signature);
		if (!proof || proof.timestamp !== Number(context.timestamp) || proof.nonce !== context.nonce) return false;
		const identity = await options.resolveIdentity(proof.keyId, { ...context, proof });
		if (!identity) return false;
		const requestURL = new URL(context.request.url);
		return verifyEngineDeviceProof(identity, proof, {
			method: context.request.method,
			target: `${requestURL.pathname}${requestURL.search}`,
			origin: requestURL.origin,
			bodyHash: await hashEngineDeviceValue(context.rawBody),
			timestamp: Number(context.timestamp),
			nonce: context.nonce,
		});
	};
}
