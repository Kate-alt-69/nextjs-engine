// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — request-origin resolution
// ─────────────────────────────────────────────────────────────────────────────

function normalizeHTTPOrigin(value: string): string {
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
		if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
		return parsed.origin;
	} catch {
		return "";
	}
}

export function resolveNENCRequestDestinationOrigin(request: Request): string {
	try {
		const requestURL = new URL(request.url);
		if (requestURL.protocol !== "http:" && requestURL.protocol !== "https:") return "";
		const host = request.headers.get("Host")?.trim();
		if (!host) return requestURL.origin;
		if (/[\\/\s@?#]/.test(host)) return "";
		return normalizeHTTPOrigin(`${requestURL.protocol}//${host}`);
	} catch {
		return "";
	}
}

export function resolveNENCRequestOrigin(request: Request): string {
	const suppliedOrigin = request.headers.get("Origin");
	return suppliedOrigin === null
		? resolveNENCRequestDestinationOrigin(request)
		: normalizeHTTPOrigin(suppliedOrigin);
}
