/**
 * Engine URL favicon URL policy.
 *
 * Icons are resolved by the favicon provider and loaded as ordinary images.
 * The stable URL is cacheable by the browser/provider; no arbitrary page HTML
 * or favicon bytes are fetched by the rendering server.
 */
export type EngineUrlIconSize = number | "auto";

const MIN_ICON_SIZE = 8;
const MAX_ICON_SIZE = 64;
const faviconUrlCache = new Map<string, string>();

function isPrivateOrLocalHostname(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (
		host === "localhost"
		|| host.endsWith(".localhost")
		|| host.endsWith(".local")
		|| host.endsWith(".internal")
		|| host.endsWith(".test")
		|| host.endsWith(".invalid")
	) return true;

	if (host.includes(":")) {
		if (host === "::" || host === "::1" || /^(fc|fd|fe[89ab])/i.test(host)) return true;
		const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(host);
		return mapped ? isPrivateOrLocalHostname(mapped[1]) : false;
	}

	const parts = host.split(".");
	if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return false;
	const octets = parts.map(Number);
	if (octets.some((part) => part < 0 || part > 255)) return true;
	const [a, b] = octets;
	return a === 0
		|| a === 10
		|| a === 127
		|| (a === 169 && b === 254)
		|| (a === 172 && b >= 16 && b <= 31)
		|| (a === 192 && b === 168)
		|| (a === 100 && b >= 64 && b <= 127)
		|| (a === 198 && (b === 18 || b === 19))
		|| a >= 224;
}

/** Return a safe, cache-stable favicon provider URL for an external HTTP(S) link. */
export function resolveEngineFaviconUrl(
	href: string,
	size: EngineUrlIconSize = "auto",
): string | undefined {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return undefined;
	}
	if (
		(url.protocol !== "https:" && url.protocol !== "http:")
		|| !url.hostname
		|| url.username
		|| url.password
		|| isPrivateOrLocalHostname(url.hostname)
	) return undefined;

	// Use the registrable host origin only; never disclose a linked path or query.
	const origin = `${url.protocol}//${url.hostname.toLowerCase()}`;
	const renderedSize = size === "auto"
		? "auto"
		: Math.max(MIN_ICON_SIZE, Math.min(MAX_ICON_SIZE, Math.round(Number.isFinite(size) ? size : 16)));
	const providerSize = renderedSize === "auto" ? 64 : Math.max(32, Math.min(128, renderedSize * 2));
	const cacheKey = `${origin}| ${providerSize}`;
	const cached = faviconUrlCache.get(cacheKey);
	if (cached) return cached;

	const result = `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(origin)}&sz=${providerSize}`;
	// Keep this resolver cache bounded for long-lived applications with dynamic URLs.
	if (faviconUrlCache.size >= 512) faviconUrlCache.clear();
	faviconUrlCache.set(cacheKey, result);
	return result;
}

/** Fixed sizes are clamped; "auto" tracks the current text size. */
export function normalizeEngineUrlIconSize(size: EngineUrlIconSize = "auto"): number | "1em" {
	if (size === "auto") return "1em";
	return Math.max(MIN_ICON_SIZE, Math.min(MAX_ICON_SIZE, Math.round(Number.isFinite(size) ? size : 16)));
}
