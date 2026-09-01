// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — single-endpoint NENC dispatcher
// ─────────────────────────────────────────────────────────────────────────────

import { EngineAPIResolver } from "../EngineAPIResolver";
import { executeRegisteredEngineCommand } from "./EngineCommand";
import { NENCReplayGuard } from "./NENCReplay";
import type { NENCServerCommand } from "./NENCManifest";
import type { NENCDispatcherOptions, NENCRequestHandler } from "./NENCDispatcherTypes";

const DEFAULT_MAX_BODY = 64 * 1024;

function generic(status: number): Response {
	return Response.json({ error: "invalid_request" }, { status });
}

function requestOrigin(request: Request): string {
	const headerOrigin = request.headers.get("Origin");
	if (headerOrigin) {
		try {
			return new URL(headerOrigin).origin;
		} catch {
			return "";
		}
	}
	try {
		return new URL(request.url).origin;
	} catch {
		return "";
	}
}

function isCrossOrigin(request: Request, origin: string): boolean {
	if (!origin) return true;
	try {
		return origin !== new URL(request.url).origin;
	} catch {
		return true;
	}
}

function mergeCors(response: Response, headers: Headers | null): Response {
	if (!headers) return response;
	const merged = new Headers(response.headers);
	headers.forEach((value, key) => merged.set(key, value));
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

function decodeInput(command: NENCServerCommand, raw: unknown): Record<string, unknown> {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("invalid");
	const source = raw as Record<string, unknown>;
	const output: Record<string, unknown> = Object.create(null);
	for (const [wireName, value] of Object.entries(source)) {
		const logicalName = command.argsById[wireName];
		if (!logicalName) throw new Error("invalid");
		output[logicalName] = value;
	}
	return output;
}

async function readBody(request: Request, maxBodyBytes: number): Promise<{ raw: string; value: unknown }> {
	const declared = Number(request.headers.get("Content-Length") ?? "0");
	if (Number.isFinite(declared) && declared > maxBodyBytes) throw new Error("too-large");
	const raw = await request.text();
	if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) throw new Error("too-large");
	if (!raw) return { raw, value: {} };
	return { raw, value: JSON.parse(raw) as unknown };
}

function resolveAPI(options: NENCDispatcherOptions): EngineAPIResolver {
	return typeof options.api === "function" ? options.api() : options.api;
}

async function executeCommand(
	request: Request,
	origin: string,
	command: NENCServerCommand,
	input: unknown,
	options: NENCDispatcherOptions,
): Promise<Response> {
	let principal: unknown;
	if (command.auth !== "anonymous") {
		if (!options.authenticate) return generic(401);
		const auth = await options.authenticate(command.auth, { request, origin, command, input });
		if (!auth.authenticated) return generic(401);
		principal = auth.principal;
	}

	if (command.permissions.length > 0) {
		if (!options.authorize) return generic(403);
		const allowed = await options.authorize({ request, origin, command, input, principal, permissions: command.permissions });
		if (!allowed) return generic(403);
	}

	const result = await executeRegisteredEngineCommand(command.name, input, {
		api: resolveAPI(options),
		request,
		origin,
		signal: request.signal,
	});
	if (result instanceof Response) return result;
	if (result === undefined) return new Response(null, { status: 204 });
	return Response.json(result);
}

export function createNENCDispatcher(options: NENCDispatcherOptions): NENCRequestHandler {
	const replay = options.replay ?? new NENCReplayGuard();
	const maxBodyBytes = Math.max(1_024, Math.floor(options.maxBodyBytes ?? DEFAULT_MAX_BODY));

	return async function handleNENCRequest(request: Request): Promise<Response> {
		const origin = requestOrigin(request);
		const crossOrigin = isCrossOrigin(request, origin);
		const corsHeaders = options.cors?.headersFor(origin) ?? null;
		const finalize = (response: Response) => mergeCors(response, crossOrigin ? corsHeaders : null);

		if (request.method.toUpperCase() === "OPTIONS") {
			return options.cors?.preflight(request) ?? generic(405);
		}
		if (request.method.toUpperCase() !== "POST") return finalize(generic(405));
		if (crossOrigin && (!options.cors || !options.cors.isAllowed(origin))) return finalize(generic(403));

		const selector = request.headers.get(options.manifest.headers.selector);
		const command = selector ? options.manifest.commandsById[selector] : undefined;
		if (!command) return finalize(generic(400));
		if (crossOrigin) {
			if (!options.trust || !options.trust.authorizeCommand(origin, command.name).allowed) return finalize(generic(403));
		}

		const timestamp = request.headers.get(options.manifest.headers.timestamp);
		const nonce = request.headers.get(options.manifest.headers.nonce);
		const replayDecision = await replay.verify(timestamp, nonce);
		if (!replayDecision.allowed || !timestamp || !nonce) return finalize(generic(409));

		try {
			const body = await readBody(request, maxBodyBytes);
			const input = decodeInput(command, body.value);
			if (options.verifySignature) {
				const valid = await options.verifySignature({
					request, origin, command, input, rawBody: body.raw,
					signature: request.headers.get(options.manifest.headers.signature), timestamp, nonce,
				});
				if (!valid) return finalize(generic(401));
			}
			return finalize(await executeCommand(request, origin, command, input, options));
		} catch {
			return finalize(generic(400));
		}
	};
}
