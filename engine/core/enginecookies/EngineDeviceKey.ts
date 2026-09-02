// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — non-exportable device signing keys
// ─────────────────────────────────────────────────────────────────────────────

import type {
	EngineDeviceProof,
	EngineDeviceProofChallenge,
	EngineDeviceProofExpectation,
	EngineDevicePublicIdentity,
} from "./types";

const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{16,192}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,192}$/;
const SHA256_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SIGNING_ALGORITHM = { name: "ECDSA", hash: "SHA-256" } as const;

function webCrypto(): Crypto {
	if (typeof crypto === "undefined" || !crypto.subtle || typeof crypto.getRandomValues !== "function") {
		throw new Error("[EngineCookies] Web Crypto is unavailable in this runtime.");
	}
	return crypto;
}

function bytesToBase64URL(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64URLToBytes(value: string): Uint8Array {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function randomToken(byteLength: number): string {
	const bytes = new Uint8Array(byteLength);
	webCrypto().getRandomValues(bytes);
	return bytesToBase64URL(bytes);
}

function normalizeOrigin(value: string | undefined): string {
	if (!value) return "";
	try {
		const parsed = new URL(value);
		return parsed.origin;
	} catch {
		throw new Error("[EngineCookies] Device proof origin must be an absolute HTTP(S) origin.");
	}
}

function normalizeTarget(value: string): string {
	try {
		const parsed = new URL(value, "https://engine.invalid");
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		throw new Error("[EngineCookies] Device proof target is invalid.");
	}
}

function proofBytes(proof: Omit<EngineDeviceProof, "signature">): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({
		version: proof.version,
		keyId: proof.keyId,
		algorithm: proof.algorithm,
		method: proof.method,
		target: proof.target,
		origin: proof.origin,
		bodyHash: proof.bodyHash,
		timestamp: proof.timestamp,
		nonce: proof.nonce,
		environmentHash: proof.environmentHash ?? null,
	}));
}

function cloneIdentity(identity: EngineDevicePublicIdentity): EngineDevicePublicIdentity {
	return Object.freeze({
		...identity,
		publicKey: Object.freeze({ ...identity.publicKey }),
	});
}

function isSafeTimestamp(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0;
}

export async function hashEngineDeviceValue(value: string | Uint8Array | ArrayBuffer): Promise<string> {
	const bytes = typeof value === "string"
		? new TextEncoder().encode(value)
		: value instanceof Uint8Array ? value : new Uint8Array(value);
	const digest = await webCrypto().subtle.digest("SHA-256", asArrayBuffer(bytes));
	return bytesToBase64URL(new Uint8Array(digest));
}

export function encodeEngineDeviceProof(proof: EngineDeviceProof): string {
	return bytesToBase64URL(new TextEncoder().encode(JSON.stringify(proof)));
}

export function decodeEngineDeviceProof(value: string): EngineDeviceProof | null {
	try {
		const parsed = JSON.parse(new TextDecoder().decode(base64URLToBytes(value))) as Partial<EngineDeviceProof>;
		if (
			parsed.version !== 1 || parsed.algorithm !== "ECDSA-P256-SHA256"
			|| typeof parsed.keyId !== "string" || !KEY_ID_PATTERN.test(parsed.keyId)
			|| typeof parsed.method !== "string" || typeof parsed.target !== "string"
			|| typeof parsed.origin !== "string" || typeof parsed.bodyHash !== "string"
			|| typeof parsed.timestamp !== "number" || !isSafeTimestamp(parsed.timestamp)
			|| typeof parsed.nonce !== "string" || !NONCE_PATTERN.test(parsed.nonce)
			|| typeof parsed.signature !== "string" || parsed.signature.length < 32
		) return null;
		return parsed as EngineDeviceProof;
	} catch {
		return null;
	}
}

export function isEngineDevicePublicIdentity(value: unknown): value is EngineDevicePublicIdentity {
	if (!value || typeof value !== "object") return false;
	const identity = value as Partial<EngineDevicePublicIdentity>;
	const publicKey = identity.publicKey;
	return identity.version === 1
		&& identity.algorithm === "ECDSA-P256-SHA256"
		&& typeof identity.keyId === "string"
		&& KEY_ID_PATTERN.test(identity.keyId)
		&& (identity.environmentHash === undefined
			|| typeof identity.environmentHash === "string" && SHA256_PATTERN.test(identity.environmentHash))
		&& !!publicKey
		&& publicKey.kty === "EC"
		&& publicKey.crv === "P-256"
		&& typeof publicKey.x === "string"
		&& typeof publicKey.y === "string"
		&& publicKey.d === undefined;
}

export class EngineDeviceKey {
	private constructor(
		private readonly keyPair: CryptoKeyPair,
		private readonly publicIdentity: EngineDevicePublicIdentity,
	) {}

	static async create(options: { keyId?: string; environment?: string } = {}): Promise<EngineDeviceKey> {
		const keyId = options.keyId ?? randomToken(18);
		if (!KEY_ID_PATTERN.test(keyId)) throw new Error("[EngineCookies] Invalid device key id.");
		const keyPair = await webCrypto().subtle.generateKey(
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["sign", "verify"],
		);
		if (keyPair.privateKey.extractable) {
			throw new Error("[EngineCookies] Device private key must be non-exportable.");
		}
		const publicKey = await webCrypto().subtle.exportKey("jwk", keyPair.publicKey);
		const environmentHash = options.environment
			? await hashEngineDeviceValue(options.environment)
			: undefined;
		return new EngineDeviceKey(keyPair, cloneIdentity({
			version: 1,
			keyId,
			algorithm: "ECDSA-P256-SHA256",
			publicKey,
			...(environmentHash ? { environmentHash } : {}),
		}));
	}

	get identity(): EngineDevicePublicIdentity {
		return cloneIdentity(this.publicIdentity);
	}

	get privateKeyExtractable(): boolean {
		return this.keyPair.privateKey.extractable;
	}

	async createProof(challenge: EngineDeviceProofChallenge): Promise<EngineDeviceProof> {
		if (!challenge.bodyHash) throw new Error("[EngineCookies] Device proof requires a body hash.");
		const timestamp = challenge.timestamp ?? Date.now();
		const nonce = challenge.nonce ?? randomToken(18);
		if (!isSafeTimestamp(timestamp)) throw new Error("[EngineCookies] Device proof timestamp is invalid.");
		if (!NONCE_PATTERN.test(nonce)) throw new Error("[EngineCookies] Device proof nonce is invalid.");
		const unsigned: Omit<EngineDeviceProof, "signature"> = {
			version: 1,
			keyId: this.publicIdentity.keyId,
			algorithm: "ECDSA-P256-SHA256",
			method: challenge.method.trim().toUpperCase(),
			target: normalizeTarget(challenge.target),
			origin: normalizeOrigin(challenge.origin),
			bodyHash: challenge.bodyHash,
			timestamp,
			nonce,
			...(this.publicIdentity.environmentHash ? { environmentHash: this.publicIdentity.environmentHash } : {}),
		};
		const signature = await webCrypto().subtle.sign(
			SIGNING_ALGORITHM,
			this.keyPair.privateKey,
			asArrayBuffer(proofBytes(unsigned)),
		);
		return Object.freeze({
			...unsigned,
			signature: bytesToBase64URL(new Uint8Array(signature)),
		});
	}
}

export async function verifyEngineDeviceProof(
	identity: EngineDevicePublicIdentity,
	proof: EngineDeviceProof,
	expected: EngineDeviceProofExpectation,
): Promise<boolean> {
	try {
		if (
			!isEngineDevicePublicIdentity(identity)
			|| proof.version !== 1 || proof.algorithm !== identity.algorithm
			|| proof.keyId !== identity.keyId
			|| proof.method !== expected.method.trim().toUpperCase()
			|| proof.target !== normalizeTarget(expected.target)
			|| proof.origin !== normalizeOrigin(expected.origin)
			|| proof.bodyHash !== expected.bodyHash
			|| proof.timestamp !== expected.timestamp
			|| proof.nonce !== expected.nonce
			|| (identity.environmentHash ?? "") !== (proof.environmentHash ?? "")
		) return false;

		const key = await webCrypto().subtle.importKey(
			"jwk",
			identity.publicKey,
			{ name: "ECDSA", namedCurve: "P-256" },
			false,
			["verify"],
		);
		const unsigned: Omit<EngineDeviceProof, "signature"> = {
			version: proof.version,
			keyId: proof.keyId,
			algorithm: proof.algorithm,
			method: proof.method,
			target: proof.target,
			origin: proof.origin,
			bodyHash: proof.bodyHash,
			timestamp: proof.timestamp,
			nonce: proof.nonce,
			...(proof.environmentHash ? { environmentHash: proof.environmentHash } : {}),
		};
		return webCrypto().subtle.verify(
			SIGNING_ALGORITHM,
			key,
			asArrayBuffer(base64URLToBytes(proof.signature)),
			asArrayBuffer(proofBytes(unsigned)),
		);
	} catch {
		return false;
	}
}
