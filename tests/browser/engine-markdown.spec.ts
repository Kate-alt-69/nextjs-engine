import { expect, test } from "@playwright/test";

test("EngineMarkdown showcases documented features with safe GFM rendering", async ({ page }) => {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") failures.push(message.text());
	});

	await page.goto("/engine-markdown-test");
	const article = page.locator("article#markdown-showcase.markdown-showcase");
	await expect(article).toBeVisible();
	await expect(page.locator("article#markdown-file-loading")).toContainText("loaded from a local Markdown file");
	await expect(article.getByRole("heading", { level: 1, name: "EngineMarkdown showcase" })).toHaveAttribute(
		"id",
		"markdown-showcase-engine-markdown-showcase",
	);
	await expect(article.getByRole("heading", { level: 6, name: "Heading level six" })).toHaveAttribute("data-scroll-point", /.+/);
	await expect(article.locator("h3#markdown-showcase-heading-level-three-2")).toBeVisible();
	await expect(article.locator("strong").first()).toHaveText("complete documented EngineMarkdown feature set");
	await expect(article.locator("blockquote blockquote")).toContainText("Nested blockquotes work too");
	// The parent list item inherits its child text, so target the nested matching item.
	await expect(article.getByRole("listitem").filter({ hasText: "Nested item with" }).last()).toBeVisible();
	await expect(article.locator('input[type="checkbox"]:checked')).toHaveCount(1);
	await expect(article.locator('input[type="checkbox"]:not(:checked)')).toHaveCount(1);
	await expect(article.locator("img[alt='A small EngineMarkdown feature illustration']")).toHaveAttribute("src", "/markdown-demo.svg");

	const codeBlocks = page.locator("figure.e-md-code-block");
	await expect(codeBlocks).toHaveCount(4);
	await expect(codeBlocks.nth(0)).toHaveAttribute("data-language", "typescript");
	await expect(codeBlocks.nth(0).locator("figcaption")).toHaveText("typescript");
	await expect(codeBlocks.nth(0).locator("pre code")).toContainText("safeByDefault: true");
	await expect(codeBlocks.nth(0).locator(".e-md-token--keyword").first()).toHaveText("type");
	await expect(codeBlocks.nth(0).locator(".e-md-token--keyword").first()).toHaveCSS("color", "rgb(86, 156, 214)");
	const inheritedThemeBlock = page.locator("#markdown-file-loading figure.e-md-code-block");
	await expect(inheritedThemeBlock).toHaveCount(1);
	await expect(inheritedThemeBlock).toHaveCSS("background-color", "rgb(36, 27, 56)");
	await expect(inheritedThemeBlock).toHaveCSS("border-top-color", "rgb(130, 111, 155)");
	await expect(inheritedThemeBlock).toHaveClass(/emd-themed-code/);
	await expect(codeBlocks.nth(1).locator("pre code")).toHaveText("<ROOT>/compact/ ├── storage/ └── backup/");
	await expect(codeBlocks.nth(2)).toHaveAttribute("data-language", "ansi");
	await expect(codeBlocks.nth(2).locator("pre code")).toContainText("✓ Build complete");
	await expect(codeBlocks.nth(2).locator("pre code span").first()).toHaveCSS("color", "rgb(74, 222, 128)");

	await expect(article.locator("table")).toContainText("Wide tables scroll inside their container");
	await expect(article.locator("del").filter({ hasText: "old parser" })).toHaveText("old parser");
	await expect(article.locator('a[href="#"]')).toContainText("blocked JavaScript link");
	await expect(article.locator("script[data-engine-markdown-unsafe]")).toHaveCount(0);
	await expect(article.locator("img[onerror]")).toHaveCount(0);
	await expect(article.locator("a[target='_blank'][rel='noopener noreferrer']").filter({ hasText: "the Next.js website" })).toContainText("the Next.js website");
	await expect(article.locator("a > img")).toHaveCount(2);

	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBeLessThanOrEqual(1);
	expect(failures, failures.join("\n")).toEqual([]);
});
