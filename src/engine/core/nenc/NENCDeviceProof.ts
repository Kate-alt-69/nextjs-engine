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

export interface NENCVerifiedDeviceKeySource {
	getVerifiedKeyId(request: Request): string | undefined;
}

export interface NENCDeviceSignatureVerifier extends NENCVerifiedDeviceKeySource {
	(context: NENCSignatureContext): Promise<boolean>;
}

export function createNENCDeviceSignatureVerifier(
	options: NENCDeviceSignatureVerifierOptions,
): NENCDeviceSignatureVerifier {
	const verifiedKeys = new WeakMap<Request, string>();
	const verify = async (context: NENCSignatureContext): Promise<boolean> => {
		verifiedKeys.delete(context.request);
		if (!context.signature) return false;
		const proof = decodeEngineDeviceProof(context.signature);
		if (!proof || proof.timestamp !== Number(context.timestamp) || proof.nonce !== context.nonce) return false;
		const identity = await options.resolveIdentity(proof.keyId, { ...context, proof });
		if (!identity) return false;
		const requestURL = new URL(context.request.url);
		const valid = await verifyEngineDeviceProof(identity, proof, {
			method: context.request.method,
			target: `${requestURL.pathname}${requestURL.search}`,
			origin: requestURL.origin,
			bodyHash: await hashEngineDeviceValue(context.rawBody),
			timestamp: Number(context.timestamp),
			nonce: context.nonce,
		});
		if (valid) verifiedKeys.set(context.request, proof.keyId);
		return valid;
	};
	return Object.assign(verify, {
		getVerifiedKeyId(request: Request): string | undefined {
			return verifiedKeys.get(request);
		},
	});
}
