import { expect, test } from "@playwright/test";

test("EngineMarkdown preserves NAS code and renders safe GFM", async ({ page }) => {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") failures.push(message.text());
	});

	await page.goto("/engine-markdown-test");
	await expect(page.getByRole("heading", { name: "NAS layout" })).toBeVisible();
	await expect(page.locator("p code").first()).toHaveText("<ROOT>");

	const codeBlocks = page.locator("figure.e-md-code-block");
	await expect(codeBlocks).toHaveCount(2);
	await expect(codeBlocks.first()).toHaveAttribute("data-language", "text");
	await expect(codeBlocks.first().locator("figcaption")).toHaveText("text");
	await expect(codeBlocks.first().locator("pre code")).toContainText("│       └── chunks/<chunk-sha256>.chunk");
	await expect(codeBlocks.nth(1).locator("pre code")).toHaveText("<ROOT>/compact/ ├── storage/ └── backup/");

	await expect(page.locator("table")).toContainText("Wide content");
	await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(2);
	await expect(page.locator("del")).toHaveText("regex-only parser");
	await expect(page.locator('a[href="#"]')).toContainText("unsafe link");
	await expect(page.locator("script[data-engine-markdown-unsafe]")).toHaveCount(0);

	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
	expect(failures, failures.join("\n")).toEqual([]);
});
