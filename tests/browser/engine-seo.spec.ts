import { expect, test } from "@playwright/test";

test("EngineSEO emits crawler metadata and safe JSON-LD in initial HTML", async ({ page }) => {
	const response = await page.goto("/engine-seo-test");
	expect(response?.status()).toBe(200);
	await expect(page).toHaveTitle("EngineSEO proof | Next.js Engine");
	await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "A production route proving EngineSEO metadata, JSON-LD, and generated social images.");
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://nextjs-engine.example/engine-seo-test");
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "EngineSEO proof | Next.js Engine");
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

	const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
	expect(jsonLd).toContain('"@type":"WebSite"');
	expect(jsonLd).toContain('"@type":"WebPage"');
});

test("EngineSEO serves a generated OpenGraph PNG", async ({ request }) => {
	const response = await request.get("/engine-seo-test/opengraph-image");
	expect(response.status()).toBe(200);
	expect(response.headers()["content-type"]).toContain("image/png");
	expect((await response.body()).byteLength).toBeGreaterThan(1_000);
});
