// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — browser NENC transport
// ─────────────────────────────────────────────────────────────────────────────

import type { EngineCommandTransport } from "./types";
import type { NENCClientManifest } from "./NENCManifest";

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
	fetcher: typeof fetch = fetch,
): EngineCommandTransport {
	return async (name: string, input: unknown): Promise<unknown> => {
		const command = manifest.commands[name];
		if (!command) throw new Error("[NENC] Invalid command request.");

		const headers = new Headers({ "Content-Type": "application/json" });
		headers.set(manifest.headers.selector, command.id);
		headers.set(manifest.headers.nonce, randomNonce());
		headers.set(manifest.headers.timestamp, String(Date.now()));

		const response = await fetcher(manifest.endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(encodeInput(command.args, input)),
			credentials: "same-origin",
		});
		if (!response.ok) throw new Error(`[NENC] Command request failed (${response.status}).`);
		return decodeResponse(response);
	};
}
