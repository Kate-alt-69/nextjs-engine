export interface EngineAPIStaticEndpoint {
	static: string;
	operation?: string;
}

export type APIStaticRunSource = "query" | "body" | "input" | "proxy";
export type APIStaticInputSchema = Record<string, string>;

export interface APIStaticRunContext {
	query: Record<string, unknown>;
	body: Record<string, unknown>;
	input: Record<string, unknown>;
	proxy: APIStaticProxyHandler;
}

export interface APIStaticOperation {
	name: string;
	source: APIStaticRunSource;
	schema?: APIStaticInputSchema;
	run: (context: APIStaticRunContext) => unknown | Promise<unknown>;
}

export interface APIStaticRouteModule {
	route: string;
	hash: string;
	operations: APIStaticOperation[];
}

export interface APIStaticResponseDescriptor {
	__engine_api_static_response__: true;
	status?: number;
	headers?: HeadersInit;
	body?: unknown;
}

export interface APIStaticErrorDescriptor extends Error {
	__engine_api_static_error__?: true;
	status?: number;
	details?: unknown;
}

export type APIStaticProxyHandler = (
	target: string,
	input?: unknown,
	init?: RequestInit,
) => Promise<unknown>;

export interface APIStaticOptions {
	basePath?: string;
	loadTimeoutMs?: number;
	proxy?: APIStaticProxyHandler;
	/** Add a changing query token when loading generated modules. Defaults to true in development. */
	cacheBust?: boolean;
}

export interface APIStaticExecuteOptions {
	operation?: string;
	input?: unknown;
}

const DEFAULT_BASE_PATH = "/_static/endpoint";
const DEFAULT_LOAD_TIMEOUT_MS = 10_000;
const SAFE_ROUTE_SEGMENT = /^[A-Za-z0-9._-]+$/;

interface APIStaticGlobal extends Record<string, unknown> {
	__NEXTJS_ENGINE_API_STATIC__?: Map<string, APIStaticRouteModule>;
}

class APIStaticValidationError extends Error {
	status = 400;

	constructor(message: string) {
		super(message);
		this.name = "APIStaticValidationError";
	}
}

function getRegistry(): Map<string, APIStaticRouteModule> {
	const root = globalThis as unknown as APIStaticGlobal;
	if (!root.__NEXTJS_ENGINE_API_STATIC__) {
		root.__NEXTJS_ENGINE_API_STATIC__ = new Map<string, APIStaticRouteModule>();
	}
	return root.__NEXTJS_ENGINE_API_STATIC__;
}

export function normalizeAPIStaticRoute(route: string): string {
	const normalized = route.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!normalized) throw new Error("[APIStatic] Static endpoint name cannot be empty.");

	const segments = normalized.split("/");
	for (const segment of segments) {
		if (!segment || segment === "." || segment === ".." || !SAFE_ROUTE_SEGMENT.test(segment)) {
			throw new Error(`[APIStatic] Invalid static endpoint segment: ${segment || "<empty>"}`);
		}
	}
	return segments.join("/");
}

export function getAPIStaticRouteHash(route: string): string {
	const normalized = normalizeAPIStaticRoute(route);
	let hash = 0x811c9dc5;
	for (let index = 0; index < normalized.length; index += 1) {
		hash ^= normalized.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36).padStart(7, "0").slice(-7);
}

export function getAPIStaticRouteURL(route: string, basePath = DEFAULT_BASE_PATH): string {
	const normalized = normalizeAPIStaticRoute(route);
	const segments = normalized.split("/");
	const fileName = `${segments.pop()}-${getAPIStaticRouteHash(normalized)}.js`;
	const base = `/${basePath.replace(/^\/+|\/+$/g, "")}`;
	return `${base}/${[...segments, fileName].join("/")}`;
}

export function staticEndpoint(route: string, operation?: string): EngineAPIStaticEndpoint {
	return {
		static: normalizeAPIStaticRoute(route),
		...(operation ? { operation } : {}),
	};
}

function formDataToRecord(formData: FormData): Record<string, unknown> {
	const output: Record<string, unknown> = {};
	for (const [key, value] of formData.entries()) {
		const existing = output[key];
		if (existing === undefined) output[key] = value;
		else if (Array.isArray(existing)) existing.push(value);
		else output[key] = [existing, value];
	}
	return output;
}

function inputToRecord(input: unknown): Record<string, unknown> {
	if (input === undefined || input === null) return {};
	if (typeof FormData !== "undefined" && input instanceof FormData) return formDataToRecord(input);
	if (typeof URLSearchParams !== "undefined" && input instanceof URLSearchParams) {
		return Object.fromEntries(input.entries());
	}
	if (typeof input === "object" && !Array.isArray(input)) return { ...(input as Record<string, unknown>) };
	return { value: input };
}

function parseBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (value === 1 || value === "1" || value === "true") return true;
	if (value === 0 || value === "0" || value === "false") return false;
	return undefined;
}

function parseDefaultValue(type: string, value: string): unknown {
	switch (type) {
		case "number": {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) throw new APIStaticValidationError(`Invalid number default: ${value}`);
			return parsed;
		}
		case "boolean": {
			const parsed = parseBoolean(value);
			if (parsed === undefined) throw new APIStaticValidationError(`Invalid boolean default: ${value}`);
			return parsed;
		}
		case "object":
		case "array":
			try {
				return JSON.parse(value);
			} catch {
				throw new APIStaticValidationError(`Invalid JSON default: ${value}`);
			}
		case "string":
		case "any":
		default:
			return value;
	}
}

function normalizeValue(name: string, rule: string, value: unknown): unknown {
	const equalsIndex = rule.indexOf("=");
	const rawType = (equalsIndex >= 0 ? rule.slice(0, equalsIndex) : rule).trim();
	const defaultRaw = equalsIndex >= 0 ? rule.slice(equalsIndex + 1) : undefined;
	const optional = rawType.endsWith("?");
	const type = (optional ? rawType.slice(0, -1) : rawType).trim().toLowerCase() || "any";

	let resolved = value;
	if (resolved === undefined || resolved === null || resolved === "") {
		if (defaultRaw !== undefined) resolved = parseDefaultValue(type, defaultRaw);
		else if (optional) return undefined;
		else throw new APIStaticValidationError(`Missing required input: ${name}`);
	}

	switch (type) {
		case "any":
			return resolved;
		case "string":
			return String(resolved);
		case "number": {
			const parsed = typeof resolved === "number" ? resolved : Number(resolved);
			if (!Number.isFinite(parsed)) throw new APIStaticValidationError(`Input ${name} must be a number.`);
			return parsed;
		}
		case "boolean": {
			const parsed = parseBoolean(resolved);
			if (parsed === undefined) throw new APIStaticValidationError(`Input ${name} must be a boolean.`);
			return parsed;
		}
		case "array":
			if (!Array.isArray(resolved)) throw new APIStaticValidationError(`Input ${name} must be an array.`);
			return resolved;
		case "object":
			if (typeof resolved !== "object" || resolved === null || Array.isArray(resolved)) {
				throw new APIStaticValidationError(`Input ${name} must be an object.`);
			}
			return resolved;
		default:
			throw new APIStaticValidationError(`Unsupported input type ${type} for ${name}.`);
	}
}

function applySchema(schema: APIStaticInputSchema | undefined, input: unknown): Record<string, unknown> {
	const source = inputToRecord(input);
	if (!schema) return source;

	const output: Record<string, unknown> = { ...source };
	for (const [name, rule] of Object.entries(schema)) {
		const value = normalizeValue(name, rule, source[name]);
		if (value === undefined) delete output[name];
		else output[name] = value;
	}
	return output;
}

async function unconfiguredProxy(): Promise<never> {
	throw new Error(
		"[APIStatic] proxy() has no backend bridge. Configure one with configureAPIStatic({ proxy }) or use fetch() for a public browser API.",
	);
}

function isResponseDescriptor(value: unknown): value is APIStaticResponseDescriptor {
	return typeof value === "object"
		&& value !== null
		&& (value as Partial<APIStaticResponseDescriptor>).__engine_api_static_response__ === true;
}

function toResponse(value: unknown): Response {
	if (value instanceof Response) return value;
	if (isResponseDescriptor(value)) {
		const status = value.status ?? 200;
		const headers = new Headers(value.headers);
		if (value.body === undefined || status === 204) return new Response(null, { status, headers });
		if (typeof value.body === "string") return new Response(value.body, { status, headers });
		if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
		return new Response(JSON.stringify(value.body), { status, headers });
	}
	if (value === undefined) return new Response(null, { status: 204 });
	if (typeof value === "string") {
		return new Response(value, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
	return new Response(JSON.stringify(value), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

function isProductionRuntime(): boolean {
	return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function errorResponse(reason: unknown): Response {
	const candidate = reason as APIStaticErrorDescriptor;
	const isStaticError = candidate?.__engine_api_static_error__ === true;
	const isValidationError = reason instanceof APIStaticValidationError;
	const status = isStaticError
		? candidate.status ?? 500
		: isValidationError
			? reason.status
			: 500;
	const message = isStaticError || isValidationError || !isProductionRuntime()
		? reason instanceof Error ? reason.message : "APIStatic operation failed."
		: "APIStatic operation failed.";
	const payload: Record<string, unknown> = { error: message };
	if (isStaticError && candidate.details !== undefined) payload.details = candidate.details;
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

function removeLoadedScripts(route?: string): void {
	if (typeof document === "undefined") return;
	for (const script of Array.from(document.querySelectorAll("script[data-engine-api-static]"))) {
		if (!route || (script instanceof HTMLScriptElement && script.dataset.engineApiStatic === route)) script.remove();
	}
}

export class APIStatic {
	private readonly basePath: string;
	private readonly loadTimeoutMs: number;
	private readonly proxyHandler: APIStaticProxyHandler;
	private readonly cacheBust: boolean;
	private readonly pendingLoads = new Map<string, Promise<APIStaticRouteModule>>();

	constructor(options: APIStaticOptions = {}) {
		this.basePath = options.basePath || DEFAULT_BASE_PATH;
		this.loadTimeoutMs = options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
		this.proxyHandler = options.proxy || unconfiguredProxy;
		this.cacheBust = options.cacheBust ?? !isProductionRuntime();
	}

	getURL(route: string): string {
		return getAPIStaticRouteURL(route, this.basePath);
	}

	clear(route?: string): void {
		const registry = getRegistry();
		if (!route) {
			registry.clear();
			this.pendingLoads.clear();
			removeLoadedScripts();
			return;
		}
		const normalized = normalizeAPIStaticRoute(route);
		registry.delete(normalized);
		this.pendingLoads.delete(normalized);
		removeLoadedScripts(normalized);
	}

	async execute(route: string, options: APIStaticExecuteOptions = {}): Promise<unknown> {
		const module = await this.load(route);
		const operation = this.pickOperation(module, options.operation);
		const normalizedInput = applySchema(operation.schema, options.input);
		const context: APIStaticRunContext = {
			query: normalizedInput,
			body: normalizedInput,
			input: normalizedInput,
			proxy: this.proxyHandler,
		};
		return operation.run(context);
	}

	async resolveRequest(route: string, options: APIStaticExecuteOptions = {}): Promise<Response> {
		try {
			return toResponse(await this.execute(route, options));
		} catch (reason) {
			return errorResponse(reason);
		}
	}

	private async load(route: string): Promise<APIStaticRouteModule> {
		const normalized = normalizeAPIStaticRoute(route);
		const registry = getRegistry();
		const existing = registry.get(normalized);
		if (existing) return existing;

		const pending = this.pendingLoads.get(normalized);
		if (pending) return pending;

		const loadPromise = this.loadBrowserModule(normalized);
		this.pendingLoads.set(normalized, loadPromise);
		try {
			return await loadPromise;
		} catch (reason) {
			this.pendingLoads.delete(normalized);
			throw reason;
		}
	}

	private loadBrowserModule(route: string): Promise<APIStaticRouteModule> {
		if (typeof document === "undefined") {
			return Promise.reject(new Error("[APIStatic] Static endpoints execute in the browser. Use a configured proxy/backend for server-only work."));
		}

		const stableSource = this.getURL(route);
		const source = this.cacheBust
			? `${stableSource}${stableSource.includes("?") ? "&" : "?"}__eas=${Date.now().toString(36)}`
			: stableSource;
		return new Promise<APIStaticRouteModule>((resolve, reject) => {
			const script = document.createElement("script");
			script.type = "module";
			script.src = source;
			script.async = true;
			script.dataset.engineApiStatic = route;

			const timeout = window.setTimeout(() => {
				script.remove();
				reject(new Error(`[APIStatic] Timed out loading ${route}.`));
			}, this.loadTimeoutMs);

			const finish = () => window.clearTimeout(timeout);
			script.onerror = () => {
				finish();
				script.remove();
				reject(new Error(`[APIStatic] Could not load ${stableSource}. Did the .route compiler run?`));
			};
			script.onload = () => {
				finish();
				const loaded = getRegistry().get(route);
				if (!loaded) {
					script.remove();
					reject(new Error(`[APIStatic] ${stableSource} loaded without registering ${route}.`));
					return;
				}
				script.remove();
				resolve(loaded);
			};

			document.head.appendChild(script);
		});
	}

	private pickOperation(module: APIStaticRouteModule, requested?: string): APIStaticOperation {
		if (requested) {
			const operation = module.operations.find((entry) => entry.name === requested);
			if (!operation) throw new APIStaticValidationError(`Unknown operation ${requested} on ${module.route}.`);
			return operation;
		}
		if (module.operations.length === 1) return module.operations[0];
		if (module.operations.length === 0) throw new APIStaticValidationError(`Static endpoint ${module.route} has no operations.`);
		throw new APIStaticValidationError(`Static endpoint ${module.route} has multiple operations; choose one by name.`);
	}
}

let defaultAPIStatic: APIStatic | null = null;

export function getDefaultAPIStatic(): APIStatic {
	if (!defaultAPIStatic) defaultAPIStatic = new APIStatic();
	return defaultAPIStatic;
}

export function configureAPIStatic(options: APIStaticOptions): APIStatic {
	defaultAPIStatic = new APIStatic(options);
	return defaultAPIStatic;
}
