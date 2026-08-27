/**
 * Next.js Engine — EngineAPIResolver
 * Declarative fetch orchestration with config cascading, native auth support,
 * and APIStatic endpoint dispatch.
 */

import type { EngineAPIStaticEndpoint } from "./APIStatic";
export type { EngineAPIStaticEndpoint } from "./APIStatic";

export interface EngineAPIAuthConfig {
	type: "pnp" | "ak" | "hmac" | "bearer" | "jwt" | "basic" | "none";
	key?: string;
	secret?: string;
	token?: string;
	username?: string;
	password?: string;
	destinationHeader?: string;
	algorithm?: "SHA-256" | "SHA-512" | "Ed25519" | "RS256" | string;
	privateKey?: CryptoKey | JsonWebKey | string;
}

export interface EngineAPIConfig {
	endpoint?: string | EngineAPIStaticEndpoint;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string;
	cache?: RequestCache;
	auth?: EngineAPIAuthConfig;
	headers?: Record<string, string>;
	versionMacros?: Record<string, string>;
}

export type EngineAPIFormData = Record<string, unknown> | FormData;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

function isStaticEndpoint(value: EngineAPIConfig["endpoint"]): value is EngineAPIStaticEndpoint {
	return isPlainObject(value) && typeof value.static === "string";
}

function deepMerge(target: Record<string, unknown>, ...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
	const result: Record<string, unknown> = { ...target };
	for (const source of sources) {
		if (!source) continue;
		for (const [key, value] of Object.entries(source)) {
			// Endpoint descriptors are routing identities, not option bags. Deep-
			// merging them can leak an operation from one static route into another.
			if (key === "endpoint") {
				result[key] = value;
				continue;
			}

			const existingValue = result[key];
			if (isPlainObject(value) && isPlainObject(existingValue)) {
				result[key] = deepMerge(existingValue, value);
			} else {
				result[key] = value;
			}
		}
	}
	return result;
}

function isNativeFormData(value: unknown): value is FormData {
	return typeof FormData !== "undefined" && value instanceof FormData;
}

function isBlobLike(value: unknown): value is Blob {
	return typeof Blob !== "undefined" && value instanceof Blob;
}

function containsBinaryValue(value: unknown): boolean {
	if (isBlobLike(value)) return true;
	if (typeof FileList !== "undefined" && value instanceof FileList) return value.length > 0;
	if (Array.isArray(value)) return value.some(containsBinaryValue);
	return false;
}

function appendFormDataValue(target: FormData, key: string, value: unknown): void {
	if (value === undefined) return;
	if (value === null) {
		target.append(key, "");
		return;
	}
	if (typeof FileList !== "undefined" && value instanceof FileList) {
		for (const file of Array.from(value)) target.append(key, file);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) appendFormDataValue(target, key, item);
		return;
	}
	if (isBlobLike(value)) {
		target.append(key, value);
		return;
	}
	if (typeof value === "object") {
		target.append(key, JSON.stringify(value));
		return;
	}
	target.append(key, String(value));
}

function buildRequestBody(formData: EngineAPIFormData): BodyInit {
	if (isNativeFormData(formData)) return formData;
	const hasBinaryPayload = Object.values(formData).some(containsBinaryValue);
	if (!hasBinaryPayload) return JSON.stringify(formData);
	if (typeof FormData === "undefined") {
		throw new Error("[EngineAPIResolver] Binary form data requires the FormData Web API.");
	}
	const nativeFormData = new FormData();
	for (const [key, value] of Object.entries(formData)) appendFormDataValue(nativeFormData, key, value);
	return nativeFormData;
}

function encodeBytesBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function encodeBase64Utf8(value: string): string {
	return encodeBytesBase64(new TextEncoder().encode(value));
}

function deleteHeaderCaseInsensitive(headers: Record<string, string>, target: string): void {
	const normalizedTarget = target.toLowerCase();
	for (const key of Object.keys(headers)) {
		if (key.toLowerCase() === normalizedTarget) delete headers[key];
	}
}

function decodeBase64(value: string): ArrayBuffer {
	const binary = atob(value);
	const buffer = new ArrayBuffer(binary.length);
	const bytes = new Uint8Array(buffer);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return buffer;
}

export class EngineAPIResolver {
	private globalConfig: EngineAPIConfig;

	constructor(compiledGlobalConfig: EngineAPIConfig = {}) {
		this.globalConfig = compiledGlobalConfig;
	}

	async resolveRequest(params: {
		pageOverrides?: EngineAPIConfig;
		nodeOverrides?: EngineAPIConfig;
		formData?: EngineAPIFormData;
		/** Input passed to APIStatic. `formData` is used only when input is undefined. */
		input?: unknown;
	} = {}): Promise<Response> {
		const { pageOverrides, nodeOverrides, formData, input } = params;
		const config = deepMerge(
			{},
			this.globalConfig as Record<string, unknown>,
			pageOverrides as Record<string, unknown> | undefined,
			nodeOverrides as Record<string, unknown> | undefined,
		) as EngineAPIConfig;

		if (isStaticEndpoint(config.endpoint)) {
			const { getDefaultAPIStatic } = await import("./APIStatic");
			return getDefaultAPIStatic().resolveRequest(config.endpoint.static, {
				operation: config.endpoint.operation,
				input: input !== undefined ? input : formData,
			});
		}

		const method = (config.method || "GET").toUpperCase();
		let url = typeof config.endpoint === "string" ? config.endpoint : "";
		const cache = config.cache || "default";

		if (config.versionMacros) {
			for (const [macro, replacement] of Object.entries(config.versionMacros)) {
				url = url.split(`&${macro}&`).join(replacement);
			}
		}

		if (!url.trim()) throw new Error("[EngineAPIResolver] Cannot resolve a request without an endpoint.");

		let body: BodyInit | undefined;
		if (!["GET", "HEAD"].includes(method) && formData !== undefined) body = buildRequestBody(formData);

		const headers: Record<string, string> = {
			...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
			...(config.headers || {}),
		};
		if (isNativeFormData(body)) deleteHeaderCaseInsensitive(headers, "Content-Type");

		const auth = config.auth || { type: "none" };
		const timestamp = Date.now().toString();
		const signatureBody = typeof body === "string" ? body : "";

		switch (auth.type) {
			case "none":
				break;
			case "ak": {
				const destinationHeader = auth.destinationHeader || "X-Key";
				if (auth.key) headers[destinationHeader] = auth.key;
				break;
			}
			case "bearer":
			case "jwt":
				if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
				break;
			case "basic":
				if (auth.username !== undefined && auth.password !== undefined) {
					headers.Authorization = `Basic ${encodeBase64Utf8(`${auth.username}:${auth.password}`)}`;
				}
				break;
			case "hmac": {
				if (auth.secret) {
					const algorithm = String(auth.algorithm).toUpperCase() === "SHA-512" ? "SHA-512" : "SHA-256";
					const signaturePayload = `${method}\n${url}\n${timestamp}\n${signatureBody}`;
					headers["X-Signature"] = await this.cryptoHMAC(signaturePayload, auth.secret, algorithm);
					headers["X-Timestamp"] = timestamp;
					if (auth.key) headers["X-Key"] = auth.key;
				}
				break;
			}
			case "pnp": {
				if (auth.privateKey) {
					const signaturePayload = `${url}\n${timestamp}\n${signatureBody}`;
					const signingKey = await this.resolvePrivateKey(auth.privateKey, auth.algorithm);
					if (!signingKey) break;
					headers["X-Signature"] = await this.cryptoAsymmetricSign(signaturePayload, signingKey);
					headers["X-Timestamp"] = timestamp;
					if (auth.key) headers["X-Key"] = auth.key;
				}
				break;
			}
		}

		const fingerprintPatterns = [/x-engine-/i, /x-powered-by/i, /x-framework/i];
		for (const key of Object.keys(headers)) {
			if (fingerprintPatterns.some((pattern) => pattern.test(key))) delete headers[key];
		}

		const fetchOptions: RequestInit = { method, headers, cache };
		if (body !== undefined) fetchOptions.body = body;
		return fetch(url, fetchOptions);
	}

	private async cryptoHMAC(payload: string, secret: string, algorithm: "SHA-256" | "SHA-512"): Promise<string> {
		const encoder = new TextEncoder();
		const importedKey = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: algorithm },
			false,
			["sign"],
		);
		const signatureBuffer = await crypto.subtle.sign("HMAC", importedKey, encoder.encode(payload));
		return Array.from(new Uint8Array(signatureBuffer))
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	}

	private async resolvePrivateKey(
		privateKey: CryptoKey | JsonWebKey | string,
		algorithm?: string,
	): Promise<CryptoKey | undefined> {
		if (typeof CryptoKey !== "undefined" && privateKey instanceof CryptoKey) return privateKey;

		const normalizedAlgorithm: AlgorithmIdentifier | RsaHashedImportParams =
			String(algorithm).toUpperCase() === "RS256"
				? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
				: { name: "Ed25519" };

		if (typeof privateKey === "string") {
			const trimmed = privateKey.trim();
			if (trimmed.startsWith("-----BEGIN")) {
				const encoded = trimmed
					.replace(/-----BEGIN PRIVATE KEY-----/g, "")
					.replace(/-----END PRIVATE KEY-----/g, "")
					.replace(/\s+/g, "");
				const pkcs8 = decodeBase64(encoded);
				return crypto.subtle.importKey("pkcs8", pkcs8, normalizedAlgorithm, false, ["sign"]);
			}
			const jwk = JSON.parse(trimmed) as JsonWebKey;
			return (crypto.subtle.importKey as any)("jwk", jwk, normalizedAlgorithm, false, ["sign"]) as Promise<CryptoKey>;
		}

		return (crypto.subtle.importKey as any)("jwk", privateKey, normalizedAlgorithm, false, ["sign"]) as Promise<CryptoKey>;
	}

	private async cryptoAsymmetricSign(payload: string, privateKey: CryptoKey): Promise<string> {
		const signatureBuffer = await crypto.subtle.sign(
			privateKey.algorithm.name,
			privateKey,
			new TextEncoder().encode(payload),
		);
		return encodeBytesBase64(new Uint8Array(signatureBuffer));
	}
}
