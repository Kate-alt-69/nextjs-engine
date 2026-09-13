import {
	PRIVATE_SEARCH_BACKEND_TOKEN,
	searchPrivateCatalog,
} from "../../../src/example/private-search/privateBackend.server";

const MAX_SEARCH_BODY_BYTES = 4 * 1_024;

function sameSecret(candidate: string, expected: string): boolean {
	const candidateBytes = new TextEncoder().encode(candidate);
	const expectedBytes = new TextEncoder().encode(expected);
	const length = Math.max(candidateBytes.length, expectedBytes.length);
	let mismatch = candidateBytes.length ^ expectedBytes.length;
	for (let index = 0; index < length; index++) {
		mismatch |= (candidateBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
	}
	return mismatch === 0;
}

function generic(status: number): Response {
	return Response.json({ error: "invalid_request" }, {
		status,
		headers: { "Cache-Control": "no-store" },
	});
}

export async function POST(request: Request): Promise<Response> {
	const authorization = request.headers.get("Authorization") ?? "";
	if (!sameSecret(authorization, `Bearer ${PRIVATE_SEARCH_BACKEND_TOKEN}`)) return generic(401);
	const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > MAX_SEARCH_BODY_BYTES) return generic(413);

	try {
		const rawBody = await request.text();
		if (new TextEncoder().encode(rawBody).byteLength > MAX_SEARCH_BODY_BYTES) return generic(413);
		const body = JSON.parse(rawBody) as Record<string, unknown>;
		if (typeof body.query !== "string" || body.query.length > 80) return generic(400);
		return Response.json({
			items: searchPrivateCatalog(body.query),
			internal: { databaseHost: "catalog-db.internal", queryPlan: "private-rank-v3" },
			credentialEcho: PRIVATE_SEARCH_BACKEND_TOKEN,
		}, { headers: { "Cache-Control": "no-store" } });
	} catch {
		return generic(400);
	}
}
