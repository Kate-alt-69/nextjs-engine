import { expect, test, type Page } from "@playwright/test";

function watchBrowserFailures(page: Page) {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		if (message.type() !== "error" && message.type() !== "warning") return;
		const text = message.text();
		if (/hydration|hydrated|didn't match|recoverable|flushSync was called from inside a lifecycle method/i.test(text)) {
			failures.push(`console: ${text}`);
		}
	});
	return failures;
}

test("Transitions+, overlays, Nav and generated styles survive real hydration", async ({ page }) => {
	const failures = watchBrowserFailures(page);
	await page.goto("/__engine-compat");

	await expect(page.getByTestId("dialog-body")).toBeVisible();
	await expect(page.getByRole("link", { name: "Compat" })).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("link", { name: "Near prefix" })).not.toHaveAttribute("aria-current", "page");
	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await expect(page.getByTestId("count")).toHaveText("0");

	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");

	await page.getByTestId("same-url").click();
	await expect(page.getByTestId("same-url-status")).toHaveText("done", { timeout: 1_500 });

	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/__engine-compat\/target$/);
	await expect(page.getByTestId("target-title")).toBeVisible();

	expect(failures, failures.join("\n")).toEqual([]);
});

test("navigation remains animated when native View Transitions are unavailable", async ({ page }) => {
	await page.addInitScript(() => {
		try {
			Object.defineProperty(Document.prototype, "startViewTransition", {
				configurable: true,
				value: undefined,
			});
		} catch {
			// Browsers that never expose the API are already on the intended path.
		}
	});
	const failures = watchBrowserFailures(page);
	await page.goto("/__engine-compat");

	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");
	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/__engine-compat\/target$/);

	expect(failures, failures.join("\n")).toEqual([]);
});

test("reduced motion keeps transitions functional without animation stalls", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const failures = watchBrowserFailures(page);
	await page.goto("/__engine-compat");

	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");
	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/__engine-compat\/target$/);

	expect(failures, failures.join("\n")).toEqual([]);
});
