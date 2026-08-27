"use client";

import type {
	EngineShaderManifest,
	EngineShaderManifestEntry,
	EngineShaderRenderPlan,
} from "./EngineShaderTypes";

const FALLBACK_BASE_PATH = "/_static/shader";
const MANIFEST_FILE = "manifest.json";
const DEV_POLL_MS = 700;

const manifestCache = new Map<string, EngineShaderManifest>();
const manifestPromises = new Map<string, Promise<EngineShaderManifest>>();
const artifactCache = new Map<string, Promise<EngineShaderRenderPlan>>();
const hotListeners = new Map<string, Set<() => void>>();
let hotTimer: ReturnType<typeof setInterval> | null = null;

function isDevelopment(): boolean {
	return process.env.NODE_ENV !== "production";
}

function normalizeBasePath(value?: string): string {
	const source = value ?? process.env.NEXT_PUBLIC_ENGINE_SHADER_BASE_PATH ?? FALLBACK_BASE_PATH;
	const normalized = String(source || "")
		.trim()
		.replace(/\\/g, "/")
		.replace(/\/+$/g, "");
	if (!normalized || normalized === "/") return "";
	return normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)
		? normalized
		: `/${normalized}`;
}

function assetURL(basePath: string, asset: string): string {
	const encodedAsset = asset.split("/").map((segment) => encodeURIComponent(segment)).join("/");
	return `${basePath}/${encodedAsset}`;
}

export function normalizeEngineShaderName(value: string): string {
	const normalized = String(value || "")
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/\.shed$/i, "");
	if (!normalized || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
		throw new Error(`[EngineShader] Invalid shader name: ${value}`);
	}
	return normalized;
}

function artifactCacheKey(
	basePath: string,
	entry: EngineShaderManifestEntry,
): string {
	return `${basePath}\n${entry.hash}\n${entry.file}`;
}

function pruneArtifactCache(
	manifest: EngineShaderManifest,
	basePath: string,
): void {
	const prefix = `${basePath}\n`;
	const keep = new Set(
		Object.values(manifest.shaders).map((entry) => artifactCacheKey(basePath, entry)),
	);
	for (const key of artifactCache.keys()) {
		if (key.startsWith(prefix) && !keep.has(key)) artifactCache.delete(key);
	}
}

async function fetchManifest(force = false, requestedBasePath?: string): Promise<EngineShaderManifest> {
	const basePath = normalizeBasePath(requestedBasePath);
	const cached = manifestCache.get(basePath);
	if (!force && cached) return cached;
	const pending = manifestPromises.get(basePath);
	if (!force && pending) return pending;
	const request = (async () => {
		const suffix = force && isDevelopment() ? `?esh=${Date.now()}` : "";
		const response = await fetch(`${assetURL(basePath, MANIFEST_FILE)}${suffix}`, {
			cache: force || isDevelopment() ? "no-store" : "force-cache",
		});
		if (!response.ok) throw new Error(`[EngineShader] Failed to load shader manifest (${response.status}).`);
		const manifest = await response.json() as EngineShaderManifest;
		if (!manifest || manifest.version !== 1 || typeof manifest.shaders !== "object") {
			throw new Error("[EngineShader] Invalid shader manifest.");
		}
		manifestCache.set(basePath, manifest);
		pruneArtifactCache(manifest, basePath);
		return manifest;
	})();
	if (!force) manifestPromises.set(basePath, request);
	try {
		return await request;
	} finally {
		if (!force && manifestPromises.get(basePath) === request) manifestPromises.delete(basePath);
	}
}

function decodeRenderPlan(buffer: ArrayBuffer): EngineShaderRenderPlan {
	const bytes = new Uint8Array(buffer);
	if (bytes.byteLength < 8) throw new Error("[EngineShader] Compiled shader artifact is truncated.");
	const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
	if (magic !== "ESH1") throw new Error(`[EngineShader] Unsupported shader artifact header: ${magic}`);
	const view = new DataView(buffer);
	const payloadLength = view.getUint32(4, true);
	if (payloadLength !== bytes.byteLength - 8) {
		throw new Error("[EngineShader] Compiled shader payload length is invalid.");
	}
	const plan = JSON.parse(new TextDecoder().decode(bytes.subarray(8))) as EngineShaderRenderPlan;
	if (!plan || plan.version !== 1 || !plan.vertex || !plan.fragment) {
		throw new Error("[EngineShader] Invalid compiled shader render plan.");
	}
	return plan;
}

export async function loadEngineShader(
	name: string,
	options: { forceManifest?: boolean; basePath?: string } = {},
): Promise<{ plan: EngineShaderRenderPlan; entry: EngineShaderManifestEntry }> {
	const logicalName = normalizeEngineShaderName(name);
	const basePath = normalizeBasePath(options.basePath);
	const manifest = await fetchManifest(options.forceManifest === true, basePath);
	const entry = manifest.shaders[logicalName];
	if (!entry) {
		throw new Error(`[EngineShader] Shader "${logicalName}" was not found under data/shader/public.`);
	}
	const cacheKey = artifactCacheKey(basePath, entry);
	let pending = artifactCache.get(cacheKey);
	if (!pending) {
		pending = (async () => {
			const response = await fetch(assetURL(basePath, entry.file), {
				cache: isDevelopment() ? "no-store" : "force-cache",
			});
			if (!response.ok) throw new Error(`[EngineShader] Failed to fetch ${logicalName} (${response.status}).`);
			return decodeRenderPlan(await response.arrayBuffer());
		})();
		artifactCache.set(cacheKey, pending);
		pending.catch(() => artifactCache.delete(cacheKey));
	}
	return { plan: await pending, entry };
}

async function pollHotShaders(): Promise<void> {
	if (!isDevelopment() || typeof document === "undefined" || document.hidden || hotListeners.size === 0) return;
	const basePath = normalizeBasePath();
	const previous = manifestCache.get(basePath) ?? null;
	try {
		const next = await fetchManifest(true, basePath);
		if (!previous || previous.revision === next.revision) return;
		for (const [name, listeners] of hotListeners) {
			if (previous.shaders[name]?.hash === next.shaders[name]?.hash) continue;
			for (const listener of listeners) listener();
		}
	} catch (reason) {
		if (process.env.NODE_ENV !== "production") {
			console.warn("[EngineShader] Hot refresh failed.", reason);
		}
	}
}

function syncHotTimer(): void {
	if (!isDevelopment() || typeof window === "undefined") return;
	if (hotListeners.size > 0 && !hotTimer) {
		hotTimer = setInterval(() => void pollHotShaders(), DEV_POLL_MS);
	} else if (hotListeners.size === 0 && hotTimer) {
		clearInterval(hotTimer);
		hotTimer = null;
	}
}

export function subscribeEngineShaderHotReload(name: string, listener: () => void): () => void {
	if (!isDevelopment()) return () => {};
	const logicalName = normalizeEngineShaderName(name);
	let listeners = hotListeners.get(logicalName);
	if (!listeners) {
		listeners = new Set();
		hotListeners.set(logicalName, listeners);
	}
	listeners.add(listener);
	syncHotTimer();
	return () => {
		listeners?.delete(listener);
		if (listeners?.size === 0) hotListeners.delete(logicalName);
		syncHotTimer();
	};
}

export function clearEngineShaderCache(): void {
	manifestCache.clear();
	manifestPromises.clear();
	artifactCache.clear();
}

export type EngineShaderFrameCallback = (timestamp: number) => void;

export class EngineShaderScheduler {
	private static callbacks = new Set<EngineShaderFrameCallback>();
	private static frameId = 0;

	private static tick = (timestamp: number): void => {
		this.frameId = 0;
		if (typeof document === "undefined" || !document.hidden) {
			for (const callback of this.callbacks) callback(timestamp);
		}
		this.ensureFrame();
	};

	private static ensureFrame(): void {
		if (this.frameId !== 0 || this.callbacks.size === 0 || typeof requestAnimationFrame === "undefined") return;
		this.frameId = requestAnimationFrame(this.tick);
	}

	public static add(callback: EngineShaderFrameCallback): () => void {
		this.callbacks.add(callback);
		this.ensureFrame();
		return () => this.remove(callback);
	}

	public static remove(callback: EngineShaderFrameCallback): void {
		this.callbacks.delete(callback);
		if (this.callbacks.size === 0 && this.frameId !== 0) {
			cancelAnimationFrame(this.frameId);
			this.frameId = 0;
		}
	}
}
