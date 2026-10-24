import { resolve } from "node:path";

const catalog = require("./engineDebugRouteCatalog.js") as {
	discoverEngineDebugRouteCatalog: (rootDirectory: string, options?: { distDir?: string }) => {
		patterns: string[];
		staticPaths: string[];
		dynamicPatterns: string[];
	};
};

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store, max-age=0",
			"x-content-type-options": "nosniff",
			"referrer-policy": "no-referrer",
		},
	});
}

function isLoopbackHost(hostHeader: string | null): boolean {
	if (!hostHeader) return false;
	const host = hostHeader.startsWith("[")
		? hostHeader.slice(1, hostHeader.indexOf("]"))
		: hostHeader.split(":")[0].toLowerCase();
	return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
	if (process.env.NODE_ENV !== "development") return jsonResponse({ error: "Route catalog is only available in development." }, 404);
	if (!isLoopbackHost(request.headers.get("host"))) return jsonResponse({ error: "Route catalog is restricted to localhost development." }, 403);
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return jsonResponse({ error: "Cross-origin route catalog access is not allowed." }, 403);
	return jsonResponse(catalog.discoverEngineDebugRouteCatalog(resolve(process.cwd())), 200);
}
