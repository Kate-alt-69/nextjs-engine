import { createHash, randomBytes } from "node:crypto";
import { chmodSync, lstatSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { Buffer } from "node:buffer";

const MAX_SOURCE_BYTES = 1_048_576;
const MAX_EDITOR_REQUEST_BYTES = MAX_SOURCE_BYTES * 4;
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

export interface EngineDebugSourceDocument {
	path: string;
	content: string;
	sha256: string;
	totalLines: number;
}

export type EngineDebugSourcePatchResult =
	| { ok: true; preview: EngineDebugSourcePreview }
	| { ok: false; code: "invalid" | "stale" | "unavailable" | "oversized"; error: string };

interface ResolvedSourceFile {
	actualPath: string;
	relativePath: string;
	mode: number;
}

function isLoopbackHost(hostHeader: string | null): boolean {
	if (!hostHeader) return false;
	const host = hostHeader.startsWith("[") ? hostHeader.slice(1, hostHeader.indexOf("]")) : hostHeader.split(":")[0].toLowerCase();
	return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
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

function resolveSourceFile(rootDirectory: string, file: string): ResolvedSourceFile | null {
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
		return { actualPath, relativePath: actualRelative.split(sep).join("/"), mode: fileStat.mode };
	} catch {
		return null;
	}
}

export function createEngineDebugSourcePreview(rootDirectory: string, file: string, requestedLine: number): EngineDebugSourcePreview | null {
	if (!Number.isSafeInteger(requestedLine) || requestedLine < 1 || requestedLine > 10_000_000) return null;
	const resolved = resolveSourceFile(rootDirectory, file);
	if (!resolved) return null;
	try {
		const content = readFileSync(resolved.actualPath, "utf8");
		if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) return null;
		const allLines = content.split(/\r?\n/);
		if (requestedLine > Math.max(1, allLines.length)) return null;
		const startLine = Math.max(1, requestedLine - CONTEXT_LINES);
		const endLine = Math.min(allLines.length, requestedLine + CONTEXT_LINES);
		return { path: resolved.relativePath, startLine, highlightLine: requestedLine, totalLines: allLines.length, lines: allLines.slice(startLine - 1, endLine).map((text, index) => ({ number: startLine + index, text })) };
	} catch {
		return null;
	}
}

export function createEngineDebugSourceDocument(rootDirectory: string, file: string): EngineDebugSourceDocument | null {
	const resolved = resolveSourceFile(rootDirectory, file);
	if (!resolved) return null;
	try {
		const content = readFileSync(resolved.actualPath, "utf8");
		if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) return null;
		return { path: resolved.relativePath, content, sha256: createHash("sha256").update(content, "utf8").digest("hex"), totalLines: content.split(/\r?\n/).length };
	} catch {
		return null;
	}
}

export type EngineDebugSourceSaveResult =
	| { status: "saved"; document: EngineDebugSourceDocument }
	| { status: "not-found" }
	| { status: "conflict" }
	| { status: "too-large" }
	| { status: "failed" };

export function saveEngineDebugSourceDocument(rootDirectory: string, file: string, expectedSha256: string, content: string): EngineDebugSourceSaveResult {
	if (Buffer.byteLength(content, "utf8") > MAX_SOURCE_BYTES) return { status: "too-large" };
	const before = createEngineDebugSourceDocument(rootDirectory, file);
	if (!before) return { status: "not-found" };
	if (!/^[0-9a-f]{64}$/.test(expectedSha256) || before.sha256 !== expectedSha256) return { status: "conflict" };
	const resolved = resolveSourceFile(rootDirectory, file);
	if (!resolved || resolved.relativePath !== before.path) return { status: "not-found" };
	const temporaryPath = resolved.actualPath + ".engine-debug-" + randomBytes(6).toString("hex") + ".tmp";
	try {
		writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: resolved.mode & 0o777 });
		chmodSync(temporaryPath, resolved.mode & 0o777);
		renameSync(temporaryPath, resolved.actualPath);
	} catch {
		try { unlinkSync(temporaryPath); } catch { /* Nothing to clean up. */ }
		return { status: "failed" };
	}
	const saved = createEngineDebugSourceDocument(rootDirectory, file);
	return saved ? { status: "saved", document: saved } : { status: "failed" };
}


function resolveSafeSourceFile(rootDirectory: string, file: string): ResolvedSourceFile | null {
	return resolveSourceFile(rootDirectory, file);
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
		const source = readFileSync(target.actualPath, "utf8");
		const sourceSha256 = createHash("sha256").update(source, "utf8").digest("hex");
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
		const latest = createEngineDebugSourceDocument(rootDirectory, file);
		if (!latest || latest.sha256 !== sourceSha256) {
			return { ok: false, code: "stale", error: "The source file changed while the patch was being applied. Reload it before saving." };
		}
		const temporaryPath = target.actualPath + ".engine-debug-patch-" + randomBytes(6).toString("hex") + ".tmp";
		try {
			writeFileSync(temporaryPath, updated, { encoding: "utf8", flag: "wx", mode: target.mode & 0o777 });
			chmodSync(temporaryPath, target.mode & 0o777);
			renameSync(temporaryPath, target.actualPath);
		} catch {
			try { unlinkSync(temporaryPath); } catch { /* Nothing to clean up. */ }
			return { ok: false, code: "unavailable", error: "The source patch could not be saved atomically." };
		}
		const previewLine = Math.min(highlightLine, Math.max(1, updatedLines.length));
		const preview = createEngineDebugSourcePreview(rootDirectory, file, previewLine);
		return preview ? { ok: true, preview } : { ok: false, code: "unavailable", error: "The source file was saved but its updated preview could not be generated." };
	} catch {
		return { ok: false, code: "unavailable", error: "The source patch could not be applied." };
	}
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}

function requestIsSameOrigin(request: Request): boolean {
	if (!isLoopbackHost(request.headers.get("host"))) return false;
	const origin = request.headers.get("origin");
	if (!origin || origin !== new URL(request.url).origin) return false;
	const fetchSite = request.headers.get("sec-fetch-site");
	return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

export async function GET(request: Request): Promise<Response> {
	if (process.env.NODE_ENV !== "development") return jsonResponse({ error: "EngineDebug source preview is only available in development." }, 404);
	if (!isLoopbackHost(request.headers.get("host"))) return jsonResponse({ error: "Source preview is restricted to localhost development." }, 403);
	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return jsonResponse({ error: "Cross-origin source preview is not allowed." }, 403);
	const url = new URL(request.url);
	const file = url.searchParams.get("file") ?? "";
	const editing = url.searchParams.get("mode") === "edit";
	const line = Number(url.searchParams.get("line") ?? (editing ? "1" : ""));
	if (!file || !Number.isSafeInteger(line)) return jsonResponse({ error: "A relative source file and line are required." }, 400);
	if (editing) {
		const document = createEngineDebugSourceDocument(process.cwd(), file);
		return document ? jsonResponse(document, 200) : jsonResponse({ error: "Source location unavailable or outside the allowed workspace." }, 404);
	}
	const preview = createEngineDebugSourcePreview(process.cwd(), file, line);
	return preview ? jsonResponse(preview, 200) : jsonResponse({ error: "Source location unavailable or outside the allowed workspace." }, 404);
}

export async function POST(request: Request): Promise<Response> {
	if (process.env.NODE_ENV !== "development") return jsonResponse({ error: "EngineDebug source editing is only available in development." }, 404);
	if (!requestIsSameOrigin(request)) return jsonResponse({ error: "Source editing is restricted to same-origin localhost development requests." }, 403);
	if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) return jsonResponse({ error: "Expected an application/json request." }, 415);
	const declaredLength = Number(request.headers.get("content-length") ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > MAX_EDITOR_REQUEST_BYTES) return jsonResponse({ error: "Source edit request is too large." }, 413);
	let rawBody: string;
	try { rawBody = await request.text(); } catch { return jsonResponse({ error: "Could not read source edit request." }, 400); }
	if (Buffer.byteLength(rawBody, "utf8") > MAX_EDITOR_REQUEST_BYTES) return jsonResponse({ error: "Source edit request is too large." }, 413);
	let payload: unknown;
	try { payload = JSON.parse(rawBody); } catch { return jsonResponse({ error: "Source edit request must contain valid JSON." }, 400); }
	if (!payload || typeof payload !== "object") return jsonResponse({ error: "Source edit request is invalid." }, 400);
	const body = payload as Record<string, unknown>;
	if (typeof body.file !== "string") return jsonResponse({ error: "A relative source file is required." }, 400);

	if (typeof body.content === "string" && typeof body.expectedSha256 === "string") {
		const result = saveEngineDebugSourceDocument(process.cwd(), body.file, body.expectedSha256, body.content);
		if (result.status === "not-found") return jsonResponse({ error: "The source file is unavailable or outside the allowed workspace." }, 404);
		if (result.status === "conflict") return jsonResponse({ error: "This file changed after it was loaded. Reload before saving to avoid overwriting newer changes." }, 409);
		if (result.status === "too-large") return jsonResponse({ error: "Edited source exceeds the 1 MiB per-file limit." }, 413);
		if (result.status === "failed") return jsonResponse({ error: "The source file could not be saved atomically." }, 500);
		return jsonResponse({ ok: true, ...result.document }, 200);
	}

	const result = applyEngineDebugSourcePatch(
		process.cwd(),
		body.file,
		Number(body.startLine),
		Number(body.highlightLine),
		body.originalLines,
		body.replacementLines,
	);
	if (result.ok) return jsonResponse({ ok: true, preview: result.preview }, 200);
	const status = result.code === "stale" ? 409 : result.code === "oversized" ? 413 : result.code === "invalid" ? 400 : 404;
	return jsonResponse({ error: result.error, code: result.code }, status);
}
