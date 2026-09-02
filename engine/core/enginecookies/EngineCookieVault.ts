// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — AES-GCM sealed EngineCookie vault
// ─────────────────────────────────────────────────────────────────────────────

import { EngineCookieIndex } from "./EngineCookies";
import { isEngineDevicePublicIdentity, verifyEngineDeviceProof } from "./EngineDeviceKey";
import type {
	EngineCookieAction,
	EngineCookieIndexEntry,
	EngineCookieRecordStore,
	EngineCookieRegistration,
	EngineCookieSealedRecord,
	EngineCookieUseRequest,
	EngineCookieVaultOptions,
	EngineDevicePublicIdentity,
} from "./types";

export type EngineCookiePayload = string | Uint8Array | ArrayBuffer;

export class EngineCookieAccessError extends Error {
	constructor(readonly code: string) {
		super(`[EngineCookies] Cookie operation denied (${code}).`);
		this.name = "EngineCookieAccessError";
	}
}

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

function payloadBytes(payload: EngineCookiePayload): Uint8Array {
	if (typeof payload === "string") return new TextEncoder().encode(payload);
	return payload instanceof Uint8Array ? new Uint8Array(payload) : new Uint8Array(payload.slice(0));
}

function cloneRecord(record: EngineCookieSealedRecord): EngineCookieSealedRecord {
	return Object.freeze({ ...record });
}

function cloneIdentity(identity: EngineDevicePublicIdentity | undefined): EngineDevicePublicIdentity | undefined {
	return identity ? Object.freeze({ ...identity, publicKey: Object.freeze({ ...identity.publicKey }) }) : undefined;
}

function metadataBytes(entry: EngineCookieIndexEntry): Uint8Array {
	return new TextEncoder().encode(JSON.stringify({
		version: 1,
		alias: entry.alias,
		storageId: entry.storageId,
		owner: entry.owner,
		creator: entry.creator,
		createdAt: entry.createdAt,
		expiresAt: entry.expiresAt ?? null,
		binding: entry.binding,
		commands: [...entry.commands],
		deviceKeyId: entry.device?.keyId ?? null,
		environmentHash: entry.environmentHash ?? null,
	}));
}

function normalizeOwner(value: string): string {
	try {
		return new URL(value).origin;
	} catch {
		try {
			return new URL(`https://${value}`).origin;
		} catch {
			return value.trim();
		}
	}
}

function sameOwner(owner: string, origin: string): boolean {
	return normalizeOwner(owner) === normalizeOwner(origin);
}

export class EngineCookieMemoryStore implements EngineCookieRecordStore {
	private readonly records = new Map<string, EngineCookieSealedRecord>();

	get(storageId: string): EngineCookieSealedRecord | undefined {
		const record = this.records.get(storageId);
		return record ? cloneRecord(record) : undefined;
	}

	set(record: EngineCookieSealedRecord): void {
		this.records.set(record.storageId, cloneRecord(record));
	}

	delete(storageId: string): boolean {
		return this.records.delete(storageId);
	}
}

export class EngineCookieVault {
	readonly index: EngineCookieIndex;
	readonly store: EngineCookieRecordStore;
	private constructor(
		private readonly sealingKey: CryptoKey,
		private readonly options: EngineCookieVaultOptions,
	) {
		this.index = options.index ?? new EngineCookieIndex();
		this.store = options.store ?? new EngineCookieMemoryStore();
	}

	static async create(options: EngineCookieVaultOptions = {}): Promise<EngineCookieVault> {
		const sealingKey = options.sealingKey ?? await webCrypto().subtle.generateKey(
			{ name: "AES-GCM", length: 256 },
			false,
			["encrypt", "decrypt"],
		);
		if (
			sealingKey.algorithm.name !== "AES-GCM"
			|| !sealingKey.usages.includes("encrypt")
			|| !sealingKey.usages.includes("decrypt")
			|| sealingKey.extractable
		) {
			throw new Error("[EngineCookies] The sealing key must be a non-exportable AES-GCM encrypt/decrypt key.");
		}
		return new EngineCookieVault(sealingKey, options);
	}

	async seal(registration: EngineCookieRegistration, payload: EngineCookiePayload): Promise<EngineCookieIndexEntry> {
		this.validateRegistration(registration);
		const entry = this.index.register({
			...registration,
			device: cloneIdentity(registration.device),
		});
		try {
			await this.writeRecord(entry, payload);
			return entry;
		} catch (error) {
			this.index.remove(entry.alias);
			throw error;
		}
	}

	async replace(alias: string, payload: EngineCookiePayload, request: EngineCookieUseRequest): Promise<void> {
		const entry = await this.authorize(alias, "write", request);
		await this.writeRecord(entry, payload);
	}

	async use<Result>(
		alias: string,
		request: EngineCookieUseRequest,
		operation: (payload: Uint8Array, metadata: EngineCookieIndexEntry) => Result | Promise<Result>,
	): Promise<Result> {
		const entry = await this.authorize(alias, "use", request);
		const record = await this.store.get(entry.storageId);
		if (!record || record.version !== 1 || record.algorithm !== "AES-256-GCM" || record.storageId !== entry.storageId) {
			throw new EngineCookieAccessError("sealed-record-missing");
		}
		let plaintext: ArrayBuffer;
		try {
			plaintext = await webCrypto().subtle.decrypt(
				{
					name: "AES-GCM",
					iv: asArrayBuffer(base64URLToBytes(record.iv)),
					additionalData: asArrayBuffer(metadataBytes(entry)),
					tagLength: 128,
				},
				this.sealingKey,
				asArrayBuffer(base64URLToBytes(record.ciphertext)),
			);
		} catch (error) {
			if (error instanceof EngineCookieAccessError) throw error;
			throw new EngineCookieAccessError("sealed-record-invalid");
		}
		const payload = new Uint8Array(plaintext);
		try {
			return await operation(payload, entry);
		} finally {
			payload.fill(0);
		}
	}

	async remove(alias: string, request: EngineCookieUseRequest): Promise<boolean> {
		const entry = await this.authorize(alias, "delete", request);
		await this.store.delete(entry.storageId);
		return this.index.remove(alias);
	}

	private validateRegistration(registration: EngineCookieRegistration): void {
		const binding = registration.binding ?? "none";
		if (registration.expiresAt !== undefined && registration.expiresAt <= Date.now()) {
			throw new Error("[EngineCookies] Cannot seal an already-expired credential.");
		}
		if (binding !== "none" && !registration.device) {
			throw new Error(`[EngineCookies] ${binding} requires a registered device public key.`);
		}
		if (registration.device && !isEngineDevicePublicIdentity(registration.device)) {
			throw new Error("[EngineCookies] Invalid device public identity.");
		}
		if ((binding === "device-key+environment" || binding === "strict") && !registration.environmentHash) {
			throw new Error(`[EngineCookies] ${binding} requires an environment hash.`);
		}
		if (registration.environmentHash && registration.device?.environmentHash !== registration.environmentHash) {
			throw new Error("[EngineCookies] Device and credential environment hashes do not match.");
		}
	}

	private async writeRecord(entry: EngineCookieIndexEntry, payload: EngineCookiePayload): Promise<void> {
		const iv = new Uint8Array(12);
		webCrypto().getRandomValues(iv);
		const plaintext = payloadBytes(payload);
		try {
			const ciphertext = await webCrypto().subtle.encrypt(
				{
					name: "AES-GCM",
					iv: asArrayBuffer(iv),
					additionalData: asArrayBuffer(metadataBytes(entry)),
					tagLength: 128,
				},
				this.sealingKey,
				asArrayBuffer(plaintext),
			);
			await this.store.set({
				version: 1,
				storageId: entry.storageId,
				algorithm: "AES-256-GCM",
				iv: bytesToBase64URL(iv),
				ciphertext: bytesToBase64URL(new Uint8Array(ciphertext)),
			});
		} finally {
			plaintext.fill(0);
		}
	}

	private async authorize(
		alias: string,
		action: EngineCookieAction,
		request: EngineCookieUseRequest,
	): Promise<EngineCookieIndexEntry> {
		const entry = this.index.get(alias);
		if (!entry) throw new EngineCookieAccessError("cookie-not-found");
		if (action === "use" && entry.commands.length > 0 && (!request.command || !entry.commands.includes(request.command))) {
			throw new EngineCookieAccessError("command-not-authorized");
		}
		if (!sameOwner(entry.owner, request.origin)) {
			const decision = this.options.trust?.authorizeCookie({
				origin: request.origin,
				cookie: entry.alias,
				action,
				command: request.command,
			});
			if (!decision?.allowed) throw new EngineCookieAccessError(decision?.reason ?? "origin-not-trusted");
		}
		if (entry.binding !== "none") {
			if (!entry.device || !request.deviceProof) throw new EngineCookieAccessError("device-proof-required");
			const proofValid = await verifyEngineDeviceProof(
				entry.device,
				request.deviceProof.proof,
				request.deviceProof.expected,
			);
			if (!proofValid) throw new EngineCookieAccessError("device-proof-invalid");
		}
		return entry;
	}
}
