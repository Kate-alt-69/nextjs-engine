// ─────────────────────────────────────────────────────────────────────────────
// Next.js Engine Generation 3 — server CORS helper
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineCORSConfig {
	allow: readonly string[];
	credentials?: boolean;
	methods?: readonly string[];
	headers?: readonly string[];
	exposeHeaders?: readonly string[];
	maxAge?: number;
}

function normalizeOrigin(origin: string): string {
	if (origin === "*") return "*";
	const parsed = new URL(origin);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error(`[EngineCORS] Unsupported origin protocol: ${parsed.protocol}`);
	}
	return parsed.origin;
}

export class EngineCORSRuleSet {
	private readonly allow: ReadonlySet<string>;
	private readonly credentials: boolean;
	private readonly methods: string;
	private readonly requestHeaders: string;
	private readonly exposeHeaders: string;
	private readonly maxAge: number;

	constructor(config: EngineCORSConfig) {
		this.credentials = config.credentials === true;
		const origins = config.allow.map(normalizeOrigin);
		if (this.credentials && origins.includes("*")) {
			throw new Error("[EngineCORS] Credentialed CORS cannot use a wildcard origin.");
		}
		this.allow = new Set(origins);
		this.methods = (config.methods ?? ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
			.map((method) => method.toUpperCase())
			.join(", ");
		this.requestHeaders = (config.headers ?? ["Content-Type", "Authorization"]).join(", ");
		this.exposeHeaders = (config.exposeHeaders ?? []).join(", ");
		this.maxAge = Math.max(0, Math.floor(config.maxAge ?? 600));
	}

	isAllowed(origin: string | null): boolean {
		if (!origin) return false;
		let normalized: string;
		try {
			normalized = normalizeOrigin(origin);
		} catch {
			return false;
		}
		return this.allow.has(normalized) || this.allow.has("*");
	}

	headersFor(origin: string | null): Headers {
		const output = new Headers({ Vary: "Origin" });
		if (!this.isAllowed(origin)) return output;
		const normalized = origin ? normalizeOrigin(origin) : "";
		output.set("Access-Control-Allow-Origin", this.allow.has("*") ? "*" : normalized);
		output.set("Access-Control-Allow-Methods", this.methods);
		output.set("Access-Control-Allow-Headers", this.requestHeaders);
		if (this.credentials) output.set("Access-Control-Allow-Credentials", "true");
		if (this.exposeHeaders) output.set("Access-Control-Expose-Headers", this.exposeHeaders);
		if (this.maxAge > 0) output.set("Access-Control-Max-Age", String(this.maxAge));
		return output;
	}

	preflight(request: Request): Response | null {
		if (request.method.toUpperCase() !== "OPTIONS") return null;
		const origin = request.headers.get("Origin");
		if (!this.isAllowed(origin)) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
		return new Response(null, { status: 204, headers: this.headersFor(origin) });
	}
}

export const EngineCORS = Object.freeze({
	create(config: EngineCORSConfig): EngineCORSRuleSet {
		return new EngineCORSRuleSet(config);
	},
});
