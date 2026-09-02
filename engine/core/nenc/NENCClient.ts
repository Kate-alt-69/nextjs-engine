// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — browser NENC transport
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandTransport } from "./types";
import type { NENCClientManifest } from "./NENCManifest";
import {
	encodeEngineDeviceProof,
	hashEngineDeviceValue,
	type EngineDeviceKey,
} from "../enginecookies";

export interface NENCTransportOptions {
	fetcher?: typeof fetch;
	deviceKey?: EngineDeviceKey;
	destinationOrigin?: string;
}

function randomNonce(): string {
	if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
		throw new Error("[NENC] Secure random generation is unavailable.");
	}
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeInput(args: Readonly<Record<string, string>>, input: unknown): Record<string, unknown> {
	if (input === undefined || input === null) return {};
	if (typeof input !== "object" || Array.isArray(input)) {
		const wireNames = Object.values(args);
		if (wireNames.length === 1) return { [wireNames[0]]: input };
		throw new Error("[NENC] Command input must be an object for multi-field commands.");
	}

	const source = input as Record<string, unknown>;
	const output: Record<string, unknown> = Object.create(null);
	for (const [logicalName, wireName] of Object.entries(args)) {
		if (source[logicalName] !== undefined) output[wireName] = source[logicalName];
	}
	return output;
}

async function decodeResponse(response: Response): Promise<unknown> {
	if (response.status === 204) return undefined;
	const contentType = response.headers.get("Content-Type") ?? "";
	if (contentType.includes("application/json")) return response.json();
	return response.text();
}

export function createNENCTransport(
	manifest: NENCClientManifest,
	fetcherOrOptions: typeof fetch | NENCTransportOptions = fetch,
): EngineCommandTransport {
	const options: NENCTransportOptions = typeof fetcherOrOptions === "function"
		? { fetcher: fetcherOrOptions }
		: fetcherOrOptions;
	const fetcher = options.fetcher ?? fetch;
	return async (name: string, input: unknown): Promise<unknown> => {
		const command = manifest.commands[name];
		if (!command) throw new Error("[NENC] Invalid command request.");

		const nonce = randomNonce();
		const timestamp = Date.now();
		const body = JSON.stringify(encodeInput(command.args, input));
		const headers = new Headers({ "Content-Type": "application/json" });
		headers.set(manifest.headers.selector, command.id);
		headers.set(manifest.headers.nonce, nonce);
		headers.set(manifest.headers.timestamp, String(timestamp));
		if (options.deviceKey) {
			const defaultOrigin = typeof location !== "undefined" ? location.origin : undefined;
			const proof = await options.deviceKey.createProof({
				method: "POST",
				target: manifest.endpoint,
				origin: options.destinationOrigin ?? defaultOrigin,
				bodyHash: await hashEngineDeviceValue(body),
				timestamp,
				nonce,
			});
			headers.set(manifest.headers.signature, encodeEngineDeviceProof(proof));
		}

		const response = await fetcher(manifest.endpoint, {
			method: "POST",
			headers,
			body,
			credentials: "same-origin",
		});
		if (!response.ok) throw new Error(`[NENC] Command request failed (${response.status}).`);
		return decodeResponse(response);
	};
}
