/**
 * Next.js Engine — EngineAPIResolver
 * Declarative runtime networking orchestration subsystem implementing native fetch pipelines,
 * multi-tier cascade override evaluations, and Zero-Fingerprint Anti-Fingerprinting protocols.
 */

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
	endpoint?: string;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | string;
	cache?: RequestCache;
	auth?: EngineAPIAuthConfig;
	headers?: Record<string, string>;
	versionMacros?: Record<string, string>;
}

/**
 * Non-generic target deep merge utility to resolve indexing constraints
 */
function deepMerge(target: any, ...sources: any[]): any {
	const result = { ...target };
	for (const source of sources) {
		if (!source) continue;
		for (const key of Object.keys(source)) {
			if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && key in result) {
				result[key] = deepMerge(result[key], source[key]);
			} else {
				result[key] = source[key];
			}
		}
	}
	return result;
}

export class EngineAPIResolver {
	private globalConfig: EngineAPIConfig;

	constructor(compiledGlobalConfig: EngineAPIConfig = {}) {
		this.globalConfig = compiledGlobalConfig;
	}

	async resolveRequest(params: {
		pageOverrides?: EngineAPIConfig;
		nodeOverrides?: EngineAPIConfig;
		formData?: Record<string, any>;
	}): Promise<Response> {
		const { pageOverrides, nodeOverrides, formData } = params;

		// 1. Structural priority layout execution
		const config: EngineAPIConfig = deepMerge({}, this.globalConfig, pageOverrides || {}, nodeOverrides || {});

		const method = (config.method || "GET").toUpperCase();
		let url = config.endpoint || "";
		const cache = config.cache || "default";

		// 2. URL Macro Adjustments
		if (config.versionMacros) {
			for (const [macro, replacement] of Object.entries(config.versionMacros)) {
				const macroPlaceholder = `&${macro}&`;
				if (url.includes(macroPlaceholder)) {
					url = url.split(macroPlaceholder).join(replacement);
				}
			}
		}

		// 3. Form Data Payloads
		let body: string | undefined = undefined;
		if (["POST", "PUT", "PATCH"].includes(method) && formData) {
			body = JSON.stringify(formData);
		}

		// 4. Headers Build Array
		const headers: Record<string, string> = {
			...(body ? { "Content-Type": "application/json" } : {}),
			...(config.headers || {}),
		};

		// 5. Native Auth Logic Routing
		const auth = config.auth || { type: "none" };
		const timestamp = Math.floor(Date.now() / 1000).toString();

		switch (auth.type) {
			case "none":
				break;

			case "ak": {
				const destHeader = auth.destinationHeader || "X-Key";
				if (auth.key) headers[destHeader] = auth.key;
				break;
			}

			case "bearer":
			case "jwt": {
				if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
				break;
			}

			case "basic": {
				if (auth.username && auth.password) {
					const credentials = btoa(`${auth.username}:${auth.password}`);
					headers["Authorization"] = `Basic ${credentials}`;
				}
				break;
			}

			case "hmac": {
				if (auth.key && auth.secret) {
					const algo = auth.algorithm === "SHA-512" ? "SHA-512" : "SHA-256";
					const signaturePayload = `${method}\n${url}\n${timestamp}\n${body || ""}`;
					
					headers["X-Signature"] = await this.cryptoHMAC(signaturePayload, auth.secret, algo);
					headers["X-Key"] = auth.key;
					headers["X-Timestamp"] = timestamp;
				}
				break;
			}

			case "pnp": {
				if (auth.key && auth.privateKey) {
					const signaturePayload = `${url}\n${timestamp}\n${body || ""}`;
					const signingKey = await this.resolvePrivateKey(auth.privateKey, auth.algorithm);
					if (!signingKey) break;
					
					headers["X-Signature"] = await this.cryptoAsymmetricSign(signaturePayload, signingKey);
					headers["X-Key"] = auth.key;
					headers["X-Timestamp"] = timestamp;
				}
				break;
			}
		}

		// 6. Zero-Fingerprint Sanitation Processing
		const fingerprintPatterns = [/x-engine-/i, /x-powered-by/i, /x-framework/i];
		for (const key of Object.keys(headers)) {
			if (fingerprintPatterns.some((pattern) => pattern.test(key))) {
				if (process.env.NODE_ENV === "development") {
						// Anti-fingerprinting blocked a disallowed header injection
						void key;
					}
				delete headers[key];
			}
		}

		const fetchOptions: RequestInit = {
			method,
			headers,
			cache,
		};

		if (body) {
			fetchOptions.body = body;
		}

		return fetch(url, fetchOptions);
	}

	private async cryptoHMAC(payload: string, secret: string, algorithm: "SHA-256" | "SHA-512"): Promise<string> {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(secret);
		const payloadData = encoder.encode(payload);

		const importedKey = await crypto.subtle.importKey(
			"raw",
			keyData,
			{ name: "HMAC", hash: algorithm },
			false,
			["sign"]
		);

		const signatureBuffer = await crypto.subtle.sign("HMAC", importedKey, payloadData);
		return Array.from(new Uint8Array(signatureBuffer))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	private async resolvePrivateKey(privateKey: CryptoKey | JsonWebKey | string, algorithm?: string): Promise<CryptoKey | undefined> {
		if (typeof CryptoKey !== "undefined" && privateKey instanceof CryptoKey) {
			return privateKey;
		}

		const jwk = typeof privateKey === "string"
			? JSON.parse(privateKey) as JsonWebKey
			: privateKey;
		const normalizedAlgorithm: AlgorithmIdentifier | RsaHashedImportParams = algorithm === "RS256"
			? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
			: { name: "Ed25519" };

		return (crypto.subtle.importKey as any)(
			"jwk",
			jwk,
			normalizedAlgorithm,
			false,
			["sign"]
		);
	}

	private async cryptoAsymmetricSign(payload: string, privateKey: CryptoKey): Promise<string> {
		const encoder = new TextEncoder();
		const payloadData = encoder.encode(payload);

		const signatureBuffer = await crypto.subtle.sign(
			privateKey.algorithm.name,
			privateKey,
			payloadData
		);

		const binaryString = String.fromCharCode(...new Uint8Array(signatureBuffer));
		return btoa(binaryString);
	}
}
