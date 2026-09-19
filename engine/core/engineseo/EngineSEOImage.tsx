import React from "react";
import { ImageResponse } from "next/og";
import { normalizeEngineSEOSchema } from "./EngineSEO";
import type { EngineSEOInput } from "./EngineSEOTypes";

export interface EngineSEOImageResponseOptions {
	width?: number;
	height?: number;
	title?: string;
	description?: string;
	background?: string;
	foreground?: string;
	accent?: string;
}

function absoluteImageUrl(url: string, siteUrl?: string): string {
	try {
		return new URL(url, siteUrl).toString();
	} catch {
		return url;
	}
}

export function createEngineSEOImageResponse(
	input: EngineSEOInput,
	options: EngineSEOImageResponseOptions = {},
): ImageResponse {
	const schema = normalizeEngineSEOSchema(input);
	const preview = schema.preview;
	const width = options.width ?? (preview?.mode === "generated" ? preview.width : undefined) ?? 1200;
	const height = options.height ?? (preview?.mode === "generated" ? preview.height : undefined) ?? 630;
	const title = options.title ?? schema.page?.title ?? schema.site?.defaultTitle ?? schema.site?.name ?? "Website";
	const description = options.description ?? schema.page?.description ?? schema.site?.description;
	const image = preview?.mode === "custom" ? preview.image : preview?.mode === "website" ? preview.screenshot : undefined;
	const imageUrl = image ? absoluteImageUrl(image.url, schema.site?.url) : undefined;
	const showWebsiteOverlay = preview?.mode === "website" && preview.overlay === true;
	const background = options.background ?? (preview?.mode === "generated" ? preview.background : undefined) ?? "linear-gradient(135deg, #07111f 0%, #111d36 55%, #172554 100%)";
	const foreground = options.foreground ?? (preview?.mode === "generated" ? preview.foreground : undefined) ?? "#f8fafc";
	const accent = options.accent ?? (preview?.mode === "generated" ? preview.accent : undefined) ?? "#60a5fa";

	return new ImageResponse(
		<div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background, color: foreground }}>
			{imageUrl ? <img src={imageUrl} alt="" width={width} height={height} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
			{!imageUrl || showWebsiteOverlay ? (
				<div style={{ position: imageUrl ? "absolute" : "relative", ...(imageUrl ? { inset: 0 } : {}), width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: imageUrl ? "linear-gradient(180deg, rgba(3,7,18,.08), rgba(3,7,18,.82))" : "transparent" }}>
					<div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 700, color: accent }}>{schema.site?.name ?? "Next.js Engine"}</div>
					<div style={{ display: "flex", flexDirection: "column", maxWidth: 1020 }}>
						<div style={{ display: "flex", fontSize: title.length > 52 ? 58 : 72, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.04em" }}>{title}</div>
						{description ? <div style={{ display: "flex", marginTop: 24, maxWidth: 940, fontSize: 28, lineHeight: 1.35, color: imageUrl ? "#e2e8f0" : "#cbd5e1" }}>{description}</div> : null}
					</div>
				</div>
			) : null}
		</div>,
		{ width, height },
	);
}
