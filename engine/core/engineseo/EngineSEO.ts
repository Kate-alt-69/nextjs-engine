import type { Metadata, MetadataRoute, ResolvingMetadata } from "next";
import type { PageMeta, PageSchema, SchemaNode } from "../../schema/types";
import type {
	EngineSEOBuilder,
	EngineSEOGeneratorProps,
	EngineSEOImage,
	EngineSEOInput,
	EngineSEOJsonLdNode,
	EngineSEOPageSchema,
	EngineSEOResolver,
	EngineSEORobotsSchema,
	EngineSEOSchema,
	EngineSEOSetters,
	EngineSEOSitemapSchema,
	EngineSEOSiteSchema,
	EngineSEOSource,
	EngineSEOWebsitePreview,
} from "./EngineSEOTypes";

const DEFAULT_PARENT = Promise.resolve({}) as ResolvingMetadata;

function textFromNode(node: SchemaNode, type: "heading" | "text"): string | undefined {
	if (node.type === type) {
		const content = node.props?.content;
		if (typeof content === "string" && content.trim()) return content.trim();
		if (typeof node.children === "string" && node.children.trim()) return node.children.trim();
	}
	if (!Array.isArray(node.children)) return undefined;
	for (const child of node.children) {
		const value = textFromNode(child, type);
		if (value) return value;
	}
	return undefined;
}

function concise(value: string, maximum = 160): string {
	const normalized = value.replace(/\s+/g, " ").trim();
	if (normalized.length <= maximum) return normalized;
	const clipped = normalized.slice(0, maximum - 1);
	const boundary = clipped.lastIndexOf(" ");
	return `${clipped.slice(0, boundary > maximum * 0.65 ? boundary : clipped.length).trim()}…`;
}

function schemaFromPageMeta(meta: PageMeta): EngineSEOSchema {
	return {
		page: {
			title: meta.title,
			description: meta.description,
			canonical: meta.canonical,
			keywords: meta.keywords,
			noIndex: meta.noIndex,
		},
		preview: meta.ogImage ? { mode: "custom", image: { url: meta.ogImage, alt: meta.ogTitle ?? meta.title } } : undefined,
		social: { openGraphTitle: meta.ogTitle, openGraphDescription: meta.ogDescription, twitterCard: meta.twitterCard },
	};
}

export function inferEngineSEOSchema(schema: PageSchema): EngineSEOSchema {
	const inferred = schemaFromPageMeta(schema.meta ?? {});
	const heading = textFromNode(schema.root, "heading");
	const text = textFromNode(schema.root, "text");
	return {
		...inferred,
		page: {
			...inferred.page,
			title: inferred.page?.title ?? heading,
			description: inferred.page?.description ?? (text ? concise(text) : undefined),
		},
		structuredData: "auto",
	};
}

function isPageSchema(input: EngineSEOInput): input is PageSchema {
	return "root" in input;
}

function isEngineSEOSchema(input: EngineSEOInput): input is EngineSEOSchema {
	return "site" in input || "page" in input || "preview" in input || "social" in input
		|| "verification" in input || "robots" in input || "sitemap" in input || "structuredData" in input;
}

export function normalizeEngineSEOSchema(input: EngineSEOInput): EngineSEOSchema {
	if (isPageSchema(input)) return inferEngineSEOSchema(input);
	if (isEngineSEOSchema(input)) return input;
	return schemaFromPageMeta(input);
}

function mergeSchema(base: EngineSEOSchema, overrides: EngineSEOSchema): EngineSEOSchema {
	return {
		...base,
		...overrides,
		site: base.site || overrides.site ? { ...base.site, ...overrides.site } as EngineSEOSiteSchema : undefined,
		page: base.page || overrides.page ? { ...base.page, ...overrides.page } : undefined,
		social: base.social || overrides.social ? { ...base.social, ...overrides.social } : undefined,
		verification: base.verification || overrides.verification ? { ...base.verification, ...overrides.verification } : undefined,
		robots: base.robots || overrides.robots ? { ...base.robots, ...overrides.robots } : undefined,
		sitemap: base.sitemap || overrides.sitemap ? { ...base.sitemap, ...overrides.sitemap } : undefined,
	};
}

function absoluteUrl(value: string | undefined, siteUrl: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		return new URL(value, siteUrl).toString();
	} catch {
		return value;
	}
}

function previewImage(schema: EngineSEOSchema): EngineSEOImage | undefined {
	if (schema.preview?.mode === "custom") return schema.preview.image;
	if (schema.preview?.mode === "website") return schema.preview.screenshot;
	if (schema.preview?.mode === "generated" && schema.preview.url) return { url: schema.preview.url, width: schema.preview.width, height: schema.preview.height };
	return undefined;
}

export function compileEngineSEOMetadata(schema: EngineSEOSchema): Metadata {
	const site = schema.site;
	const page = schema.page ?? {};
	const titleValue = page.title ?? site?.defaultTitle ?? site?.name;
	const title = titleValue && site?.titleTemplate && page.title
		? site.titleTemplate.replace(/%s/g, titleValue)
		: titleValue;
	const description = page.description ?? site?.description;
	const openGraphTitle = schema.social?.openGraphTitle ?? title;
	const openGraphDescription = schema.social?.openGraphDescription ?? description;
	const twitterTitle = schema.social?.twitterTitle ?? openGraphTitle;
	const twitterDescription = schema.social?.twitterDescription ?? openGraphDescription;
	const canonical = absoluteUrl(page.canonical ?? page.path ?? (schema.preview?.mode === "website" ? schema.preview.pageUrl : undefined), site?.url);
	const image = previewImage(schema);
	const imageUrl = absoluteUrl(image?.url, site?.url);
	const imageEntry = imageUrl ? [{
		url: imageUrl,
		...(image?.alt ? { alt: image.alt } : {}),
		...(image?.width ? { width: image.width } : {}),
		...(image?.height ? { height: image.height } : {}),
		...(image?.type ? { type: image.type } : {}),
	}] : undefined;
	const index = schema.robots?.index ?? !page.noIndex;
	const follow = schema.robots?.follow ?? !page.noFollow;
	const hasRobots = schema.robots !== undefined || page.noIndex !== undefined || page.noFollow !== undefined;
	const hasSocialMetadata = Boolean(title || description || imageUrl || site?.name);
	const result: Metadata = {
		...(site?.url ? { metadataBase: new URL(site.url) } : {}),
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(site?.name ? { applicationName: site.name } : {}),
		...(page.keywords?.length ? { keywords: page.keywords } : {}),
		...(canonical ? { alternates: { canonical } } : {}),
		...(hasRobots ? { robots: {
			index,
			follow,
			...(schema.robots?.googleBot ? { googleBot: schema.robots.googleBot } : {}),
		} } : {}),
		...(hasSocialMetadata ? { openGraph: {
			type: page.type ?? "website",
			...(openGraphTitle ? { title: openGraphTitle } : {}),
			...(openGraphDescription ? { description: openGraphDescription } : {}),
			...(site?.name ? { siteName: site.name } : {}),
			...(canonical ? { url: canonical } : {}),
			...(site?.locale ? { locale: site.locale } : {}),
			...(site?.alternateLocales?.length ? { alternateLocale: site.alternateLocales } : {}),
			...(imageEntry ? { images: imageEntry } : {}),
			...(page.type === "article" && page.publishedTime ? { publishedTime: page.publishedTime } : {}),
			...(page.type === "article" && page.modifiedTime ? { modifiedTime: page.modifiedTime } : {}),
			...(page.type === "article" && page.authors?.length ? { authors: page.authors } : {}),
			...(page.type === "article" && page.section ? { section: page.section } : {}),
			...(page.type === "article" && page.tags?.length ? { tags: page.tags } : {}),
		}, twitter: {
			card: schema.social?.twitterCard ?? "summary_large_image",
			...(twitterTitle ? { title: twitterTitle } : {}),
			...(twitterDescription ? { description: twitterDescription } : {}),
			...(schema.social?.twitterSite ? { site: schema.social.twitterSite } : {}),
			...(schema.social?.twitterCreator ? { creator: schema.social.twitterCreator } : {}),
			...(imageUrl ? { images: [imageUrl] } : {}),
		} } : {}),
		...(schema.verification ? {
			verification: {
				google: schema.verification.google,
				yandex: schema.verification.yandex,
				yahoo: schema.verification.yahoo,
				other: {
					...(schema.verification.other ?? {}),
					...(schema.verification.bing ? { "msvalidate.01": schema.verification.bing } : {}),
				},
			},
		} : {}),
	};
	return result;
}

function requireSiteUrl(schema: EngineSEOSchema, feature: string): string {
	if (!schema.site?.url) throw new Error(`[EngineSEO] site.url is required to generate ${feature}.`);
	return schema.site.url;
}

export function compileEngineSEOSitemap(schema: EngineSEOSchema): MetadataRoute.Sitemap {
	const siteUrl = requireSiteUrl(schema, "a sitemap");
	const configured = schema.sitemap?.routes;
	const routes = Array.isArray(configured) && configured.length > 0
		? configured
		: [{
			path: schema.page?.path ?? schema.page?.canonical ?? "/",
			lastModified: schema.page?.modifiedTime,
		}];
	const defaults = schema.sitemap?.defaults ?? {};
	const unique = new Map<string, MetadataRoute.Sitemap[number]>();
	for (const route of routes) {
		const url = absoluteUrl(route.path, siteUrl)!;
		const priority = route.priority ?? defaults.priority;
		unique.set(url, {
			url,
			lastModified: route.lastModified ?? defaults.lastModified,
			changeFrequency: route.changeFrequency ?? defaults.changeFrequency,
			priority: priority === undefined ? undefined : Math.max(0, Math.min(1, priority)),
			images: (route.images ?? defaults.images)?.map((image) => absoluteUrl(image, siteUrl)!),
			alternates: route.alternates
				? { languages: Object.fromEntries(Object.entries(route.alternates).map(([language, target]) => [language, absoluteUrl(target, siteUrl)!])) }
				: defaults.alternates
					? { languages: Object.fromEntries(Object.entries(defaults.alternates).map(([language, target]) => [language, absoluteUrl(target, siteUrl)!])) }
					: undefined,
		});
	}
	return [...unique.values()];
}

export function compileEngineSEORobots(schema: EngineSEOSchema): MetadataRoute.Robots {
	const robots = schema.robots ?? {};
	const siteUrl = schema.site?.url;
	const sitemap = robots.sitemap ?? (siteUrl ? absoluteUrl("/sitemap.xml", siteUrl) : undefined);
	return {
		rules: {
			userAgent: robots.userAgent ?? "*",
			allow: robots.index === false ? undefined : robots.allow ?? "/",
			disallow: robots.index === false ? "/" : robots.disallow,
			crawlDelay: robots.crawlDelay,
		},
		sitemap,
		host: robots.host ?? siteUrl,
	};
}

export function compileEngineSEOJsonLd(schema: EngineSEOSchema): EngineSEOJsonLdNode[] {
	if (schema.structuredData === false) return [];
	const site = schema.site;
	const page = schema.page ?? {};
	const custom = Array.isArray(schema.structuredData) ? schema.structuredData : [];
	const automatic: EngineSEOJsonLdNode[] = [];
	if (schema.structuredData === "auto" || schema.structuredData === undefined) {
		if (site?.name && site.url) {
			automatic.push({
				"@context": "https://schema.org",
				"@type": "WebSite",
				"@id": `${site.url.replace(/\/$/, "")}/#website`,
				name: site.name,
				url: site.url,
				description: site.description,
				inLanguage: site.language,
			});
		}
		if (page.title || page.description) {
			automatic.push({
				"@context": "https://schema.org",
				"@type": page.type === "article" ? "Article" : "WebPage",
				name: page.title,
				description: page.description,
				url: absoluteUrl(page.canonical ?? page.path ?? (schema.preview?.mode === "website" ? schema.preview.pageUrl : undefined), site?.url),
				datePublished: page.publishedTime,
				dateModified: page.modifiedTime,
				keywords: page.keywords?.join(", "),
				isPartOf: site?.url ? { "@id": `${site.url.replace(/\/$/, "")}/#website` } : undefined,
			});
		}
	}
	return [...automatic, ...custom];
}

export function createEngineSEO<Props extends EngineSEOGeneratorProps = EngineSEOGeneratorProps>(
	source: EngineSEOSource<Props> = {},
): EngineSEOBuilder<Props> {
	let overrides: EngineSEOSchema = {};
	let builder: EngineSEOBuilder<Props>;
	const patch = (value: EngineSEOSchema) => {
		overrides = mergeSchema(overrides, value);
		return builder;
	};
	const set: EngineSEOSetters<Props> = {
		title: (value) => patch({ page: { title: value } }),
		description: (value) => patch({ page: { description: value } }),
		canonical: (value) => patch({ page: { canonical: value } }),
		keywords: (value) => patch({ page: { keywords: [...value] } }),
		noIndex: (value = true) => patch({ page: { noIndex: value } }),
		noFollow: (value = true) => patch({ page: { noFollow: value } }),
		site: (value) => patch({ site: value }),
		robots: (value: EngineSEORobotsSchema) => patch({ robots: value }),
		sitemap: (value: EngineSEOSitemapSchema) => patch({ sitemap: value }),
		structuredData: (value) => patch({ structuredData: value }),
		social: (value) => patch({ social: value }),
		preview: {
			generated: (value = {}) => patch({ preview: { mode: "generated", ...value } }),
			customImage: (value) => patch({ preview: { mode: "custom", image: typeof value === "string" ? { url: value } : value } }),
			website: (value: Omit<EngineSEOWebsitePreview, "mode">) => patch({ preview: { mode: "website", ...value } }),
		},
	};
	const resolve: EngineSEOBuilder<Props>["resolve"] = async (props = {} as Props, parent = DEFAULT_PARENT) => {
		const input = typeof source === "function"
			? await (source as EngineSEOResolver<Props>)(props, parent)
			: source;
		return mergeSchema(normalizeEngineSEOSchema(input), overrides);
	};
	const generateMetadata: EngineSEOBuilder<Props>["generateMetadata"] = async (props, parent) => compileEngineSEOMetadata(await resolve(props, parent));
	const sitemap: EngineSEOBuilder<Props>["sitemap"] = async () => compileEngineSEOSitemap(await resolve());
	const robots: EngineSEOBuilder<Props>["robots"] = async () => compileEngineSEORobots(await resolve());
	const jsonLd: EngineSEOBuilder<Props>["jsonLd"] = async (props, parent) => compileEngineSEOJsonLd(await resolve(props, parent));
	builder = { set, resolve, generateMetadata, sitemap, robots, jsonLd };
	return builder;
}

export const EngineSEO = Object.freeze({
	create: createEngineSEO,
	metadata: compileEngineSEOMetadata,
	sitemap: compileEngineSEOSitemap,
	robots: compileEngineSEORobots,
	jsonLd: compileEngineSEOJsonLd,
	infer: inferEngineSEOSchema,
	generate<Props extends EngineSEOGeneratorProps = EngineSEOGeneratorProps>(source: EngineSEOSource<Props>) {
		return createEngineSEO(source).generateMetadata;
	},
});
