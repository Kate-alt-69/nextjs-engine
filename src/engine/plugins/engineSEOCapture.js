"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadChromium() {
	for (const packageName of ["playwright", "@playwright/test"]) {
		try {
			return require(packageName).chromium;
		} catch (error) {
			if (error?.code !== "MODULE_NOT_FOUND") throw error;
		}
	}
	throw new Error("[EngineSEO] Website capture requires `playwright` or `@playwright/test` as a development dependency.");
}

function assertCaptureUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`[EngineSEO] Invalid website preview URL: ${value}`);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`[EngineSEO] Website preview capture supports only HTTP(S), received ${url.protocol}`);
	}
	return url.toString();
}

async function captureEngineSEOWebsitePreview(options) {
	if (!options || typeof options !== "object") throw new Error("[EngineSEO] Website capture options are required.");
	const url = assertCaptureUrl(options.url);
	const outputPath = path.resolve(options.outputPath || path.join(process.cwd(), "public", "engine-seo", "website.png"));
	const extension = path.extname(outputPath).toLowerCase();
	if (![".png", ".jpg", ".jpeg"].includes(extension)) {
		throw new Error(`[EngineSEO] Website preview output must be PNG or JPEG, received ${extension || "no extension"}.`);
	}
	const width = Math.max(320, Math.min(3840, Number(options.width) || 1200));
	const height = Math.max(240, Math.min(2160, Number(options.height) || 630));
	const browserType = options.browserType || loadChromium();
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	const browser = await browserType.launch({ headless: true });
	try {
		const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: options.deviceScaleFactor || 1 });
		await page.emulateMedia({ colorScheme: options.colorScheme || "light", reducedMotion: "reduce" });
		await page.goto(url, { waitUntil: options.waitUntil || "domcontentloaded", timeout: options.timeout || 30_000 });
		if (options.selector) await page.waitForSelector(options.selector, { state: "visible", timeout: options.timeout || 30_000 });
		if (options.delay !== 0) await page.waitForTimeout(options.delay ?? 800);
		await page.screenshot({
			path: outputPath,
			fullPage: false,
			animations: "disabled",
			type: extension === ".jpg" || extension === ".jpeg" ? "jpeg" : "png",
		});
	} finally {
		await browser.close();
	}
	const publicRoot = path.resolve(options.publicDir || path.join(process.cwd(), "public"));
	const relative = path.relative(publicRoot, outputPath);
	const publicUrl = relative && !relative.startsWith("..") && !path.isAbsolute(relative)
		? `/${relative.split(path.sep).join("/")}`
		: undefined;
	return { url, outputPath, publicUrl, width, height };
}

module.exports = { captureEngineSEOWebsitePreview };
