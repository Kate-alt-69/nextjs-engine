import type {
	EngineSEOBingSitemapFileOptions,
	EngineSEOGoogleSitemapFileOptions,
	EngineSEOProviderSitemapCompileOptions,
	EngineSEOSchema,
	EngineSEOSitemapNews,
	EngineSEOSitemapProvider,
	EngineSEOSitemapProviderFileOptions,
	EngineSEOSitemapRoute,
	EngineSEOSitemapVideo,
	EngineSEOYandexSitemapFileOptions,
} from "./EngineSEOTypes";

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";
const GOOGLE_IMAGE_NAMESPACE = "http://www.google.com/schemas/sitemap-image/1.1";
const GOOGLE_VIDEO_NAMESPACE = "http://www.google.com/schemas/sitemap-video/1.1";
const GOOGLE_NEWS_NAMESPACE = "http://www.google.com/schemas/sitemap-news/0.9";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const MAX_SITEMAP_URLS = 50_000;
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;
const MAX_GOOGLE_NEWS_ENTRIES = 1_000;
const GOOGLE_NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

interface ResolvedProviderOptions {
	includeLastModified: boolean;
	includeImages: boolean;
	includeVideos: boolean;
	includeNews: boolean;
	includeAlternates: boolean;
	includeChangeFrequency: boolean;
	includePriority: boolean;
}

interface ResolvedSitemapRoute extends EngineSEOSitemapRoute {
	absoluteUrl: string;
}

const PROVIDER_DEFAULTS: Record<EngineSEOSitemapProvider, ResolvedProviderOptions> = {
	google: {
		includeLastModified: true,
		includeImages: true,
		includeVideos: true,
		includeNews: true,
		includeAlternates: true,
		includeChangeFrequency: false,
		includePriority: false,
	},
	bing: {
		includeLastModified: true,
		includeImages: false,
		includeVideos: false,
		includeNews: false,
		includeAlternates: false,
		includeChangeFrequency: false,
		includePriority: false,
	},
	yandex: {
		includeLastModified: true,
		includeImages: false,
		includeVideos: false,
		includeNews: false,
		includeAlternates: false,
		includeChangeFrequency: true,
		includePriority: true,
	},
};

function requireSiteUrl(schema: EngineSEOSchema): string {
	if (!schema.site?.url) throw new Error("[EngineSEO] site.url is required to compile a provider sitemap.");
	return schema.site.url;
}

function absoluteUrl(value: string, siteUrl: string): string {
	try {
		return new URL(value, siteUrl).toString();
	} catch {
		throw new Error(`[EngineSEO] Invalid sitemap URL: ${value}`);
	}
}

function escapeXml(value: string | number | boolean): string {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function formatDate(value: string | Date | undefined, label: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`[EngineSEO] ${label} must be a valid date.`);
	return date.toISOString();
}

function resolveProviderFileOptions(schema: EngineSEOSchema, provider: EngineSEOSitemapProvider): EngineSEOSitemapProviderFileOptions {
	const configured = schema.sitemap?.providerFiles;
	if (!configured || configured === true || typeof configured !== "object") return {};
	const value = configured[provider];
	return value && typeof value === "object" ? value : {};
}

function resolveProviderOptions(schema: EngineSEOSchema, provider: EngineSEOSitemapProvider): ResolvedProviderOptions {
	const defaults = PROVIDER_DEFAULTS[provider];
	const common = resolveProviderFileOptions(schema, provider);
	if (provider === "google") {
		const configured = common as EngineSEOGoogleSitemapFileOptions;
		return {
			...defaults,
			includeLastModified: configured.includeLastModified ?? defaults.includeLastModified,
			includeImages: configured.includeImages ?? defaults.includeImages,
			includeVideos: configured.includeVideos ?? defaults.includeVideos,
			includeNews: configured.includeNews ?? defaults.includeNews,
			includeAlternates: configured.includeAlternates ?? defaults.includeAlternates,
		};
	}
	if (provider === "yandex") {
		const configured = common as EngineSEOYandexSitemapFileOptions;
		return {
			...defaults,
			includeLastModified: configured.includeLastModified ?? defaults.includeLastModified,
			includeChangeFrequency: configured.includeChangeFrequency ?? defaults.includeChangeFrequency,
			includePriority: configured.includePriority ?? defaults.includePriority,
		};
	}
	const configured = common as EngineSEOBingSitemapFileOptions;
	return {
		...defaults,
		includeLastModified: configured.includeLastModified ?? defaults.includeLastModified,
	};
}

function mergeRoute(defaults: Omit<EngineSEOSitemapRoute, "path">, route: EngineSEOSitemapRoute): EngineSEOSitemapRoute {
	return {
		...defaults,
		...route,
		images: route.images ?? defaults.images,
		alternates: route.alternates ?? defaults.alternates,
		videos: route.videos ?? defaults.videos,
		news: route.news ?? defaults.news,
		providers: route.providers ?? defaults.providers,
	};
}

function resolveRoutes(schema: EngineSEOSchema, provider: EngineSEOSitemapProvider): ResolvedSitemapRoute[] {
	const siteUrl = requireSiteUrl(schema);
	const configured = schema.sitemap?.routes;
	const routes: EngineSEOSitemapRoute[] = Array.isArray(configured) && configured.length > 0
		? configured
		: [{
			path: schema.page?.path ?? schema.page?.canonical ?? "/",
			lastModified: schema.page?.modifiedTime,
		}];
	const defaults = schema.sitemap?.defaults ?? {};
	const unique = new Map<string, ResolvedSitemapRoute>();
	for (const route of routes) {
		const resolved = mergeRoute(defaults, route);
		if (resolved.providers && !resolved.providers.includes(provider)) continue;
		const url = absoluteUrl(resolved.path, siteUrl);
		unique.set(url, { ...resolved, absoluteUrl: url });
	}
	const result = [...unique.values()];
	if (result.length > MAX_SITEMAP_URLS) {
		throw new Error(`[EngineSEO] ${provider} sitemap has ${result.length} URLs; a single sitemap supports at most ${MAX_SITEMAP_URLS}.`);
	}
	return result;
}

function newsIsCurrent(news: EngineSEOSitemapNews | undefined, now: Date): boolean {
	if (!news) return false;
	const published = news.publicationDate instanceof Date ? news.publicationDate : new Date(news.publicationDate);
	if (Number.isNaN(published.getTime())) throw new Error("[EngineSEO] sitemap news publicationDate must be a valid date.");
	const age = now.getTime() - published.getTime();
	return age >= 0 && age <= GOOGLE_NEWS_WINDOW_MS;
}

function renderLastModified(route: ResolvedSitemapRoute, options: ResolvedProviderOptions): string[] {
	if (!options.includeLastModified) return [];
	const lastModified = formatDate(route.lastModified, `sitemap lastModified for ${route.path}`);
	return lastModified ? [`\t\t<lastmod>${escapeXml(lastModified)}</lastmod>`] : [];
}

function renderGoogleImage(image: string, siteUrl: string): string[] {
	return [
		"\t\t<image:image>",
		`\t\t\t<image:loc>${escapeXml(absoluteUrl(image, siteUrl))}</image:loc>`,
		"\t\t</image:image>",
	];
}

function assertGoogleVideo(video: EngineSEOSitemapVideo, routePath: string, routeUrl: string, siteUrl: string): void {
	if (!video.contentUrl && !video.playerUrl) {
		throw new Error(`[EngineSEO] Google video sitemap entry on ${routePath} requires contentUrl or playerUrl.`);
	}
	if (video.description.length > 2048) {
		throw new Error(`[EngineSEO] Google video sitemap description on ${routePath} exceeds 2048 characters.`);
	}
	if (video.duration !== undefined && (!Number.isInteger(video.duration) || video.duration < 1 || video.duration > 28_800)) {
		throw new Error(`[EngineSEO] Google video sitemap duration on ${routePath} must be an integer from 1 to 28800 seconds.`);
	}
	if (video.rating !== undefined && (!Number.isFinite(video.rating) || video.rating < 0 || video.rating > 5)) {
		throw new Error(`[EngineSEO] Google video sitemap rating on ${routePath} must be between 0 and 5.`);
	}
	if (video.viewCount !== undefined && (!Number.isInteger(video.viewCount) || video.viewCount < 0)) {
		throw new Error(`[EngineSEO] Google video sitemap viewCount on ${routePath} must be a non-negative integer.`);
	}
	if ((video.tags?.length ?? 0) > 32) {
		throw new Error(`[EngineSEO] Google video sitemap entry on ${routePath} may contain at most 32 tags.`);
	}
	if ((video.uploader?.name.length ?? 0) > 255) {
		throw new Error(`[EngineSEO] Google video sitemap uploader on ${routePath} may contain at most 255 characters.`);
	}
	for (const country of video.restriction?.countries ?? []) {
		if (!/^[A-Za-z]{2,3}$/.test(country)) throw new Error(`[EngineSEO] Google video sitemap restriction on ${routePath} contains invalid country code ${country}.`);
	}
	for (const platform of video.platform?.types ?? []) {
		if (!["web", "mobile", "tv"].includes(platform)) throw new Error(`[EngineSEO] Google video sitemap platform on ${routePath} contains invalid value ${platform}.`);
	}
	for (const candidate of [video.contentUrl, video.playerUrl]) {
		if (candidate && absoluteUrl(candidate, siteUrl) === routeUrl) {
			throw new Error(`[EngineSEO] Google video sitemap media/player URL on ${routePath} must differ from the page URL.`);
		}
	}
	if (video.uploader?.info) {
		const info = new URL(absoluteUrl(video.uploader.info, siteUrl));
		const page = new URL(routeUrl);
		if (info.hostname !== page.hostname) throw new Error(`[EngineSEO] Google video uploader info URL on ${routePath} must use the page domain.`);
	}
}

function renderGoogleVideo(video: EngineSEOSitemapVideo, routePath: string, routeUrl: string, siteUrl: string): string[] {
	assertGoogleVideo(video, routePath, routeUrl, siteUrl);
	const lines = [
		"\t\t<video:video>",
		`\t\t\t<video:thumbnail_loc>${escapeXml(absoluteUrl(video.thumbnailUrl, siteUrl))}</video:thumbnail_loc>`,
		`\t\t\t<video:title>${escapeXml(video.title)}</video:title>`,
		`\t\t\t<video:description>${escapeXml(video.description)}</video:description>`,
	];
	if (video.contentUrl) lines.push(`\t\t\t<video:content_loc>${escapeXml(absoluteUrl(video.contentUrl, siteUrl))}</video:content_loc>`);
	if (video.playerUrl) lines.push(`\t\t\t<video:player_loc>${escapeXml(absoluteUrl(video.playerUrl, siteUrl))}</video:player_loc>`);
	if (video.duration !== undefined) lines.push(`\t\t\t<video:duration>${video.duration}</video:duration>`);
	const expirationDate = formatDate(video.expirationDate, `video expirationDate for ${routePath}`);
	if (expirationDate) lines.push(`\t\t\t<video:expiration_date>${escapeXml(expirationDate)}</video:expiration_date>`);
	if (video.rating !== undefined) lines.push(`\t\t\t<video:rating>${video.rating}</video:rating>`);
	if (video.viewCount !== undefined) lines.push(`\t\t\t<video:view_count>${video.viewCount}</video:view_count>`);
	const publicationDate = formatDate(video.publicationDate, `video publicationDate for ${routePath}`);
	if (publicationDate) lines.push(`\t\t\t<video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`);
	if (video.familyFriendly !== undefined) lines.push(`\t\t\t<video:family_friendly>${video.familyFriendly ? "yes" : "no"}</video:family_friendly>`);
	if (video.restriction?.countries.length) {
		lines.push(`\t\t\t<video:restriction relationship="${video.restriction.relationship}">${escapeXml(video.restriction.countries.join(" "))}</video:restriction>`);
	}
	if (video.platform?.types.length) {
		lines.push(`\t\t\t<video:platform relationship="${video.platform.relationship}">${escapeXml(video.platform.types.join(" "))}</video:platform>`);
	}
	if (video.requiresSubscription !== undefined) lines.push(`\t\t\t<video:requires_subscription>${video.requiresSubscription ? "yes" : "no"}</video:requires_subscription>`);
	if (video.uploader) {
		const info = video.uploader.info ? ` info="${escapeXml(absoluteUrl(video.uploader.info, siteUrl))}"` : "";
		lines.push(`\t\t\t<video:uploader${info}>${escapeXml(video.uploader.name)}</video:uploader>`);
	}
	if (video.live !== undefined) lines.push(`\t\t\t<video:live>${video.live ? "yes" : "no"}</video:live>`);
	for (const tag of video.tags ?? []) lines.push(`\t\t\t<video:tag>${escapeXml(tag)}</video:tag>`);
	lines.push("\t\t</video:video>");
	return lines;
}

function renderGoogleNews(news: EngineSEOSitemapNews, routePath: string): string[] {
	const publicationDate = formatDate(news.publicationDate, `news publicationDate for ${routePath}`)!;
	return [
		"\t\t<news:news>",
		"\t\t\t<news:publication>",
		`\t\t\t\t<news:name>${escapeXml(news.publicationName)}</news:name>`,
		`\t\t\t\t<news:language>${escapeXml(news.language)}</news:language>`,
		"\t\t\t</news:publication>",
		`\t\t\t<news:publication_date>${escapeXml(publicationDate)}</news:publication_date>`,
		`\t\t\t<news:title>${escapeXml(news.title)}</news:title>`,
		"\t\t</news:news>",
	];
}

function renderGoogleRoute(route: ResolvedSitemapRoute, options: ResolvedProviderOptions, siteUrl: string, now: Date): string[] {
	const lines = ["\t<url>", `\t\t<loc>${escapeXml(route.absoluteUrl)}</loc>`, ...renderLastModified(route, options)];
	if (options.includeAlternates) {
		for (const [language, target] of Object.entries(route.alternates ?? {})) {
			lines.push(`\t\t<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(absoluteUrl(target, siteUrl))}" />`);
		}
	}
	if (options.includeImages) {
		if ((route.images?.length ?? 0) > 1_000) throw new Error(`[EngineSEO] Google sitemap route ${route.path} may contain at most 1000 images.`);
		for (const image of route.images ?? []) lines.push(...renderGoogleImage(image, siteUrl));
	}
	if (options.includeVideos) {
		for (const video of route.videos ?? []) lines.push(...renderGoogleVideo(video, route.path, route.absoluteUrl, siteUrl));
	}
	if (options.includeNews && newsIsCurrent(route.news, now)) lines.push(...renderGoogleNews(route.news!, route.path));
	lines.push("\t</url>");
	return lines;
}

function renderBingRoute(route: ResolvedSitemapRoute, options: ResolvedProviderOptions): string[] {
	return [
		"\t<url>",
		`\t\t<loc>${escapeXml(route.absoluteUrl)}</loc>`,
		...renderLastModified(route, options),
		"\t</url>",
	];
}

function renderYandexRoute(route: ResolvedSitemapRoute, options: ResolvedProviderOptions): string[] {
	const lines = ["\t<url>", `\t\t<loc>${escapeXml(route.absoluteUrl)}</loc>`, ...renderLastModified(route, options)];
	if (options.includeChangeFrequency && route.changeFrequency) lines.push(`\t\t<changefreq>${route.changeFrequency}</changefreq>`);
	if (options.includePriority && route.priority !== undefined) {
		const priority = Math.max(0, Math.min(1, route.priority));
		lines.push(`\t\t<priority>${priority}</priority>`);
	}
	lines.push("\t</url>");
	return lines;
}

function utf8ByteLength(value: string): number {
	return new TextEncoder().encode(value).length;
}

export function compileEngineSEOProviderSitemap(
	schema: EngineSEOSchema,
	provider: EngineSEOSitemapProvider,
	compileOptions: EngineSEOProviderSitemapCompileOptions = {},
): string {
	const siteUrl = requireSiteUrl(schema);
	const routes = resolveRoutes(schema, provider);
	const options = resolveProviderOptions(schema, provider);
	const now = compileOptions.now instanceof Date ? compileOptions.now : new Date(compileOptions.now ?? Date.now());
	if (Number.isNaN(now.getTime())) throw new Error("[EngineSEO] provider sitemap compile time must be a valid date.");

	const namespaces = [`xmlns="${SITEMAP_NAMESPACE}"`];
	if (provider === "google") {
		if (options.includeImages && routes.some((route) => route.images?.length)) namespaces.push(`xmlns:image="${GOOGLE_IMAGE_NAMESPACE}"`);
		if (options.includeVideos && routes.some((route) => route.videos?.length)) namespaces.push(`xmlns:video="${GOOGLE_VIDEO_NAMESPACE}"`);
		const activeNewsCount = options.includeNews ? routes.filter((route) => newsIsCurrent(route.news, now)).length : 0;
		if (activeNewsCount > MAX_GOOGLE_NEWS_ENTRIES) {
			throw new Error(`[EngineSEO] Google news sitemap contains ${activeNewsCount} recent news entries; a single news sitemap supports at most ${MAX_GOOGLE_NEWS_ENTRIES}.`);
		}
		if (activeNewsCount > 0) namespaces.push(`xmlns:news="${GOOGLE_NEWS_NAMESPACE}"`);
		if (options.includeAlternates && routes.some((route) => Object.keys(route.alternates ?? {}).length > 0)) namespaces.push(`xmlns:xhtml="${XHTML_NAMESPACE}"`);
	}

	const lines = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		`<urlset ${namespaces.join(" ")}>`,
	];
	for (const route of routes) {
		if (provider === "google") lines.push(...renderGoogleRoute(route, options, siteUrl, now));
		else if (provider === "bing") lines.push(...renderBingRoute(route, options));
		else lines.push(...renderYandexRoute(route, options));
	}
	lines.push("</urlset>", "");
	const xml = lines.join("\n");
	if (utf8ByteLength(xml) > MAX_SITEMAP_BYTES) {
		throw new Error(`[EngineSEO] ${provider} sitemap exceeds the 50 MB uncompressed sitemap limit.`);
	}
	return xml;
}
