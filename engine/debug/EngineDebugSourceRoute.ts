import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const MAX_SOURCE_BYTES = 1_048_576;
const MAX_PATCH_BYTES = 262_144;
const MAX_PATCH_LINES = 500;
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

export type EngineDebugSourcePatchResult =
	| { ok: true; preview: EngineDebugSourcePreview }
	| { ok: false; code: "invalid" | "stale" | "unavailable" | "oversized"; error: string };

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

function resolveSafeSourceFile(rootDirectory: string, file: string): { path: string; relativePath: string } | null {
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
		return { path: actualPath, relativePath: actualRelative.split(sep).join("/") };
	} catch {
		return null;
	}
}

export function createEngineDebugSourcePreview(
	rootDirectory: string,
	file: string,
	requestedLine: number,
): EngineDebugSourcePreview | null {
	if (!Number.isSafeInteger(requestedLine) || requestedLine < 1 || requestedLine > 10_000_000) return null;
	const target = resolveSafeSourceFile(rootDirectory, file);
	if (!target) return null;
	try {
		const source = readFileSync(target.path, "utf8");
		const allLines = source.split(/\r?\n/);
		const line = Math.min(requestedLine, Math.max(1, allLines.length));
		const startLine = Math.max(1, line - CONTEXT_LINES);
		const endLine = Math.min(allLines.length, line + CONTEXT_LINES);
		return {
			path: target.relativePath,
			startLine,
			highlightLine: line,
			totalLines: allLines.length,
			lines: allLines.slice(startLine - 1, endLine).map((text, index) => ({ number: startLine + index, text })),
		};
	} catch {
		return null;
	}
}

export function applyEngineDebugSourcePatch(
	rootDirectory: string,
	file: string,
	startLine: number,
	highlightLine: number,
	originalLines: unknown,
	replacementLines: unknown,
): EngineDebugSourcePatchResult {
	if (!Number.isSafeInteger(startLine) || startLine < 1
		|| !Number.isSafeInteger(highlightLine) || highlightLine < 1
		|| !Array.isArray(originalLines) || !Array.isArray(replacementLines)
		|| originalLines.length < 1 || originalLines.length > MAX_PATCH_LINES
		|| replacementLines.length > MAX_PATCH_LINES
		|| !originalLines.every(line => typeof line === "string")
		|| !replacementLines.every(line => typeof line === "string")) {
		return { ok: false, code: "invalid", error: "The source patch format or line range is invalid." };
	}
	const inputLines = originalLines as string[];
	const outputLines = replacementLines as string[];
	const patchBytes = Buffer.byteLength(inputLines.join("\n") + "\n" + outputLines.join("\n"), "utf8");
	if (patchBytes > MAX_PATCH_BYTES) return { ok: false, code: "oversized", error: "The edited source selection is too large to save safely." };
	const target = resolveSafeSourceFile(rootDirectory, file);
	if (!target) return { ok: false, code: "unavailable", error: "The source file is unavailable or outside the permitted workspace." };
	try {
		const source = readFileSync(target.path, "utf8");
		const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
		const currentLines = source.split(/\r?\n/);
		const offset = startLine - 1;
		if (offset + inputLines.length > currentLines.length) {
			return { ok: false, code: "stale", error: "The file changed since this preview was opened. Reload the source before saving." };
		}
		const actual = currentLines.slice(offset, offset + inputLines.length);
		if (actual.length !== inputLines.length || actual.some((line, index) => line !== inputLines[index])) {
			return { ok: false, code: "stale", error: "The file changed since this preview was opened. Reload the source before saving." };
		}
		const updatedLines = [...currentLines.slice(0, offset), ...outputLines, ...currentLines.slice(offset + inputLines.length)];
		const updated = updatedLines.join(lineEnding);
		if (Buffer.byteLength(updated, "utf8") > MAX_SOURCE_BYTES) {
			return { ok: false, code: "oversized", error: "The saved source would exceed the permitted 1 MiB file limit." };
		}
		writeFileSync(target.path, updated, "utf8");
		const nextHighlight = Math.min(Math.max(1, startLine + Math.max(0, highlightLine - startLine)), Math.max(1, updatedLines.length));
		const preview = createEngineDebugSourcePreview(rootDirectory, target.relativePath, nextHighlight);
		return preview
			? { ok: true, preview }
			: { ok: false, code: "unavailable", error: "The file was saved, but its updated source preview could not be reloaded." };
	} catch {
		return { ok: false, code: "unavailable", error: "The source file could not be written. Check workspace permissions and try again." };
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

export async function POST(request: Request): Promise<Response> {
	if (process.env.NODE_ENV !== "development") return jsonResponse({ error: "EngineDebug source editing is only available in development." }, 404);
	if (!isLoopbackHost(request.headers.get("host"))) return jsonResponse({ error: "Source editing is restricted to localhost development." }, 403);
	const url = new URL(request.url);
	const origin = request.headers.get("origin");
	if (!origin || origin !== url.origin) return jsonResponse({ error: "A same-origin request is required to save source edits." }, 403);
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin") return jsonResponse({ error: "Cross-origin source edits are not allowed." }, 403);
	if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
		return jsonResponse({ error: "Source edits must use application/json." }, 415);
	}
	const contentLength = Number(request.headers.get("content-length") ?? "0");
	if (Number.isFinite(contentLength) && contentLength > MAX_PATCH_BYTES + 32_768) {
		return jsonResponse({ error: "The source patch request is too large." }, 413);
	}
	let body: unknown;
	try {
		const raw = await request.text();
		if (Buffer.byteLength(raw, "utf8") > MAX_PATCH_BYTES + 32_768) return jsonResponse({ error: "The source patch request is too large." }, 413);
		body = JSON.parse(raw);
	} catch {
		return jsonResponse({ error: "The source patch request is not valid JSON." }, 400);
	}
	if (!body || typeof body !== "object") return jsonResponse({ error: "The source patch is invalid." }, 400);
	const input = body as Record<string, unknown>;
	if (typeof input.file !== "string") return jsonResponse({ error: "A relative source file is required." }, 400);
	const result = applyEngineDebugSourcePatch(
		process.cwd(),
		input.file,
		Number(input.startLine),
		Number(input.highlightLine),
		input.originalLines,
		input.replacementLines,
	);
	if (result.ok) return jsonResponse({ ok: true, preview: result.preview }, 200);
	const status = result.code === "stale" ? 409 : result.code === "oversized" ? 413 : result.code === "invalid" ? 400 : 404;
	return jsonResponse({ error: result.error, code: result.code }, status);
}
