// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — EngineCookies contracts
// ─────────────────────────────────────────────────────────────────────────────

export type EngineCookieAction = "read" | "write" | "use" | "delete";
export type EngineCookieBindingMode = "none" | "device-key" | "device-key+environment" | "strict";
export type EngineDeviceKeyAlgorithm = "ECDSA-P256-SHA256";

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
	device?: EngineDevicePublicIdentity;
	environmentHash?: string;
}

export interface EngineDevicePublicIdentity {
	version: 1;
	keyId: string;
	algorithm: EngineDeviceKeyAlgorithm;
	publicKey: JsonWebKey;
	environmentHash?: string;
}

export interface EngineDeviceProofChallenge {
	method: string;
	target: string;
	origin?: string;
	bodyHash: string;
	timestamp?: number;
	nonce?: string;
}

export interface EngineDeviceProofExpectation {
	method: string;
	target: string;
	origin?: string;
	bodyHash: string;
	timestamp: number;
	nonce: string;
}

export interface EngineDeviceProof {
	version: 1;
	keyId: string;
	algorithm: EngineDeviceKeyAlgorithm;
	method: string;
	target: string;
	origin: string;
	bodyHash: string;
	timestamp: number;
	nonce: string;
	environmentHash?: string;
	signature: string;
}

export interface EngineCookieDeviceProofRequest {
	proof: EngineDeviceProof;
	expected: EngineDeviceProofExpectation;
}

export interface EngineCookieUseRequest {
	origin: string;
	command?: string;
	deviceProof?: EngineCookieDeviceProofRequest;
}

export interface EngineCookieSealedRecord {
	version: 1;
	storageId: string;
	algorithm: "AES-256-GCM";
	iv: string;
	ciphertext: string;
}

export interface EngineCookieRecordStore {
	get(storageId: string): EngineCookieSealedRecord | undefined | Promise<EngineCookieSealedRecord | undefined>;
	set(record: EngineCookieSealedRecord): void | Promise<void>;
	delete(storageId: string): boolean | void | Promise<boolean | void>;
}

export interface EngineCookieVaultOptions {
	index?: import("./EngineCookies").EngineCookieIndex;
	store?: EngineCookieRecordStore;
	trust?: import("./EngineTrustList").EngineTrustList;
	sealingKey?: CryptoKey;
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
	device?: EngineDevicePublicIdentity;
	environmentHash?: string;
}
