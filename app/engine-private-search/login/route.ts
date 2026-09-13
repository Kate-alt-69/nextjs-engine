import { isEngineDevicePublicIdentity } from "../../../src/engine/network";
import {
	resolveNENCRequestDestinationOrigin,
	resolveNENCRequestOrigin,
} from "../../../src/engine/server";
import {
	PRIVATE_SEARCH_COOKIE,
	PRIVATE_SEARCH_DEMO_EMAIL,
	PRIVATE_SEARCH_DEMO_PASSWORD,
	issuePrivateSearchSession,
	readPrivateSearchCookie,
	revokePrivateSearchSession,
} from "../../../src/example/private-search/demoStore.server";

const MAX_LOGIN_BODY_BYTES = 8 * 1_024;

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		status,
		headers: { "Cache-Control": "no-store", ...headers },
	});
}

function requestOrigin(request: Request): string | null {
	const origin = resolveNENCRequestOrigin(request);
	const destinationOrigin = resolveNENCRequestDestinationOrigin(request);
	return origin && origin === destinationOrigin ? origin : null;
}

export async function POST(request: Request): Promise<Response> {
	const origin = requestOrigin(request);
	if (!origin) return json({ error: "invalid_request" }, 403);
	const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGIN_BODY_BYTES) {
		return json({ error: "invalid_request" }, 413);
	}

	try {
		const rawBody = await request.text();
		if (new TextEncoder().encode(rawBody).byteLength > MAX_LOGIN_BODY_BYTES) {
			return json({ error: "invalid_request" }, 413);
		}
		const body = JSON.parse(rawBody) as Record<string, unknown>;
		if (
			body.email !== PRIVATE_SEARCH_DEMO_EMAIL
			|| body.password !== PRIVATE_SEARCH_DEMO_PASSWORD
			|| !isEngineDevicePublicIdentity(body.device)
		) return json({ error: "invalid_credentials" }, 401);

		const issued = await issuePrivateSearchSession(body.device, origin);
		const maxAge = Math.max(1, Math.floor((issued.session.expiresAt - Date.now()) / 1_000));
		return json({
			account: { subject: issued.session.subject, email: PRIVATE_SEARCH_DEMO_EMAIL },
			deviceKeyId: body.device.keyId,
			expiresAt: issued.session.expiresAt,
		}, 201, {
			"Set-Cookie": `${PRIVATE_SEARCH_COOKIE}=${issued.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
		});
	} catch {
		return json({ error: "invalid_request" }, 400);
	}
}

export async function DELETE(request: Request): Promise<Response> {
	await revokePrivateSearchSession(readPrivateSearchCookie(request));
	return json({ loggedOut: true }, 200, {
		"Set-Cookie": `${PRIVATE_SEARCH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
	});
}
