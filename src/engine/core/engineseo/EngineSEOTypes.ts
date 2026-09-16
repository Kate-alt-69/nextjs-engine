import type { Metadata, MetadataRoute, ResolvingMetadata } from "next";
import type { PageMeta, PageSchema } from "../../schema/types";

export interface EngineSEOSiteSchema {
	name: string;
	url: string;
	description?: string;
	defaultTitle?: string;
	titleTemplate?: string;
	locale?: string;
	alternateLocales?: string[];
	language?: string;
	logo?: string;
}

export interface EngineSEOPageSchema {
	title?: string;
	description?: string;
	path?: string;
	canonical?: string;
	keywords?: string[];
	type?: "website" | "article" | "profile";
	noIndex?: boolean;
	noFollow?: boolean;
	publishedTime?: string;
	modifiedTime?: string;
	authors?: string[];
	section?: string;
	tags?: string[];
}

export interface EngineSEOImage {
	url: string;
	alt?: string;
	width?: number;
	height?: number;
	type?: string;
}

export interface EngineSEOGeneratedPreview {
	mode: "generated";
	url?: string;
	width?: number;
	height?: number;
	background?: string;
	foreground?: string;
	accent?: string;
}

export interface EngineSEOCustomPreview {
	mode: "custom";
	image: EngineSEOImage;
}

export interface EngineSEOWebsitePreview {
	mode: "website";
	pageUrl: string;
	screenshot: EngineSEOImage;
	overlay?: boolean;
}

export type EngineSEOPreview = EngineSEOGeneratedPreview | EngineSEOCustomPreview | EngineSEOWebsitePreview;

export interface EngineSEOSocialSchema {
	openGraphTitle?: string;
	openGraphDescription?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	twitterCard?: "summary" | "summary_large_image";
	twitterSite?: string;
	twitterCreator?: string;
}

export interface EngineSEOVerificationSchema {
	google?: string | string[];
	bing?: string;
	yandex?: string | string[];
	yahoo?: string | string[];
	other?: Record<string, string | string[]>;
}

export interface EngineSEORobotsSchema {
	index?: boolean;
	follow?: boolean;
	userAgent?: string | string[];
	allow?: string | string[];
	disallow?: string | string[];
	crawlDelay?: number;
	host?: string;
	sitemap?: string | string[];
	googleBot?: {
		index?: boolean;
		follow?: boolean;
		noimageindex?: boolean;
		"max-video-preview"?: number | string;
		"max-image-preview"?: "none" | "standard" | "large";
		"max-snippet"?: number;
	};
}

export interface EngineSEOSitemapRoute {
	path: string;
	lastModified?: string | Date;
	changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
	priority?: number;
	images?: string[];
	alternates?: Record<string, string>;
}

export type EngineSEOSitemapLastModifiedMode = "git" | "build" | false;

export interface EngineSEOSitemapSchema {
	routes?: EngineSEOSitemapRoute[] | "auto";
	defaults?: Omit<EngineSEOSitemapRoute, "path">;
	/**
	 * Adds last-modified dates to automatically discovered routes. Git dates are
	 * accurate per source file and are the default. Build dates are opt-in for
	 * sites whose route content is genuinely regenerated on every build.
	 */
	lastModified?: EngineSEOSitemapLastModifiedMode;
}

export type EngineSEOJsonValue = string | number | boolean | null | EngineSEOJsonValue[] | { [key: string]: EngineSEOJsonValue };

export interface EngineSEOJsonLdNode {
	"@context"?: "https://schema.org" | string;
	"@type": string | string[];
	[key: string]: EngineSEOJsonValue | undefined;
}

export interface EngineSEOSchema {
	site?: EngineSEOSiteSchema;
	page?: EngineSEOPageSchema;
	preview?: EngineSEOPreview;
	social?: EngineSEOSocialSchema;
	verification?: EngineSEOVerificationSchema;
	robots?: EngineSEORobotsSchema;
	sitemap?: EngineSEOSitemapSchema;
	structuredData?: "auto" | false | EngineSEOJsonLdNode[];
}

export type EngineSEOInput = EngineSEOSchema | PageSchema | PageMeta;
export type EngineSEOGeneratorProps = Record<string, unknown>;
export type EngineSEOResolver<Props extends EngineSEOGeneratorProps = EngineSEOGeneratorProps> = (
	props: Props,
	parent: ResolvingMetadata,
) => EngineSEOInput | Promise<EngineSEOInput>;
export type EngineSEOSource<Props extends EngineSEOGeneratorProps = EngineSEOGeneratorProps> = EngineSEOInput | EngineSEOResolver<Props>;

export interface EngineSEOSetters<Props extends EngineSEOGeneratorProps> {
	title(value: string): EngineSEOBuilder<Props>;
	description(value: string): EngineSEOBuilder<Props>;
	canonical(value: string): EngineSEOBuilder<Props>;
	keywords(value: string[]): EngineSEOBuilder<Props>;
	noIndex(value?: boolean): EngineSEOBuilder<Props>;
	noFollow(value?: boolean): EngineSEOBuilder<Props>;
	site(value: EngineSEOSiteSchema): EngineSEOBuilder<Props>;
	robots(value: EngineSEORobotsSchema): EngineSEOBuilder<Props>;
	sitemap(value: EngineSEOSitemapSchema): EngineSEOBuilder<Props>;
	structuredData(value: "auto" | false | EngineSEOJsonLdNode[]): EngineSEOBuilder<Props>;
	social(value: EngineSEOSocialSchema): EngineSEOBuilder<Props>;
	preview: {
		generated(value?: Omit<EngineSEOGeneratedPreview, "mode">): EngineSEOBuilder<Props>;
		customImage(value: EngineSEOImage | string): EngineSEOBuilder<Props>;
		website(value: Omit<EngineSEOWebsitePreview, "mode">): EngineSEOBuilder<Props>;
	};
}

export interface EngineSEOBuilder<Props extends EngineSEOGeneratorProps = EngineSEOGeneratorProps> {
	readonly set: EngineSEOSetters<Props>;
	readonly generateMetadata: (props: Props, parent: ResolvingMetadata) => Promise<Metadata>;
	readonly sitemap: () => Promise<MetadataRoute.Sitemap>;
	readonly robots: () => Promise<MetadataRoute.Robots>;
	resolve(props?: Props, parent?: ResolvingMetadata): Promise<EngineSEOSchema>;
	jsonLd(props?: Props, parent?: ResolvingMetadata): Promise<EngineSEOJsonLdNode[]>;
}
