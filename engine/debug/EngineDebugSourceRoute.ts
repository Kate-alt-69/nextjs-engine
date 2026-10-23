import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_SOURCE_BYTES = 1_048_576;
const CONTEXT_LINES = 9;
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".md"]);
const FORBIDDEN_SEGMENTS = new Set(["node_modules", ".next", ".git", "dist", "out", "coverage", "build"]);

export interface EngineDebugSourcePreview {
	path: string;
	startLine: number;
	highlightLine: number;
	totalLines: number;
	lines: Array<{ number: number; text: string }>;
}

function isLoopbackHost(hostHeader: string | null): boolean {
	if (!hostHeader) return false;
	const host = hostHeader.startsWith("[")
		? hostHeader.slice(1, hostHeader.indexOf("]"))
		: hostHeader.split(":")[0].toLowerCase();
	return host === "localhost"
		|| host === "127.0.0.1"
		|| host === "::1"
		|| host.endsWith(".localhost");
}

function safeSegments(file: string): string[] | null {
	if (!file || file.length > 500 || file.includes("\0")) return null;
	const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "");
	if (normalized.startsWith("/") || isAbsolute(normalized)) return null;
	const segments = normalized.split("/");
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
	if (segments.some((segment) => segment.startsWith(".") || FORBIDDEN_SEGMENTS.has(segment.toLowerCase()))) return null;
	if (segments.some((segment) => /[\u0000-\u001f<>:"|?*]/.test(segment))) return null;
	if (!ALLOWED_EXTENSIONS.has(extname(segments[segments.length - 1]).toLowerCase())) return null;
	return segments;
}

export function createEngineDebugSourcePreview(
	rootDirectory: string,
	file: string,
	requestedLine: number,
): EngineDebugSourcePreview | null {
	if (!Number.isSafeInteger(requestedLine) || requestedLine < 1 || requestedLine > 10_000_000) return null;
	const segments = safeSegments(file);
	if (!segments) return null;
	try {
		const root = realpathSync(rootDirectory);
		const candidate = resolve(root, ...segments);
		const actualPath = realpathSync(candidate);
		const actualRelative = relative(root, actualPath);
		if (!actualRelative || actualRelative.startsWith(".." + sep) || actualRelative === ".." || isAbsolute(actualRelative)) return null;
		const actualSegments = actualRelative.split(sep);
		if (actualSegments.some((segment) => segment.startsWith(".") || FORBIDDEN_SEGMENTS.has(segment.toLowerCase()))) return null;
		if (!ALLOWED_EXTENSIONS.has(extname(actualPath).toLowerCase())) return null;
		const fileStat = lstatSync(actualPath);
		if (!fileStat.isFile() || fileStat.size > MAX_SOURCE_BYTES) return null;
		const source = readFileSync(actualPath, "utf8");
		const allLines = source.split(/\r?\n/);
		if (requestedLine > Math.max(1, allLines.length)) return null;
		const startLine = Math.max(1, requestedLine - CONTEXT_LINES);
		const endLine = Math.min(allLines.length, requestedLine + CONTEXT_LINES);
		return {
			path: actualRelative.split(sep).join("/"),
			startLine,
			highlightLine: requestedLine,
			totalLines: allLines.length,
			lines: allLines.slice(startLine - 1, endLine).map((text, index) => ({ number: startLine + index, text })),
		};
	} catch {
		return null;
	}
}

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

export async function GET(request: Request): Promise<Response> {
	if (process.env.NODE_ENV !== "development") return jsonResponse({ error: "EngineDebug source preview is only available in development." }, 404);
	if (!isLoopbackHost(request.headers.get("host"))) return jsonResponse({ error: "Source preview is restricted to localhost development." }, 403);
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return jsonResponse({ error: "Cross-origin source preview is not allowed." }, 403);

	const url = new URL(request.url);
	const file = url.searchParams.get("file") ?? "";
	const line = Number(url.searchParams.get("line"));
	if (!file || !Number.isSafeInteger(line)) return jsonResponse({ error: "A relative source file and line are required." }, 400);
	const preview = createEngineDebugSourcePreview(process.cwd(), file, line);
	return preview ? jsonResponse(preview, 200) : jsonResponse({ error: "Source location unavailable or outside the allowed workspace." }, 404);
}
