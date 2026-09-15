import { expect, test, type Page } from "@playwright/test";

function watchBrowserFailures(page: Page) {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		if (message.type() !== "error" && message.type() !== "warning") return;
		const text = message.text();
		if (/hydration|hydrated|didn't match|recoverable|flushSync was called from inside a lifecycle method|AbortError|Skipped ViewTransition|unhandledRejection/i.test(text)) {
			failures.push(`console: ${text}`);
		}
	});
	return failures;
}

async function closeCompatibilityDialog(page: Page) {
	const dialogBody = page.getByTestId("engine-compatibility-dialog");
	await expect(dialogBody).toBeVisible();
	await expect(dialogBody.getByText("1 fallback active · 1 unavailable")).toBeVisible();
	await expect(dialogBody.locator('[data-engine-compatibility-status="fallback"]')).toHaveCount(1);
	await expect(dialogBody.locator('[data-engine-compatibility-status="unavailable"]')).toHaveCount(1);
	await expect(dialogBody.getByText("CSS Grid")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Native compatibility should stay hidden" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(dialogBody).toBeHidden();
}

test("Transitions+, overlays, Nav and generated styles survive real hydration", async ({ page }) => {
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-compat-test");

	await closeCompatibilityDialog(page);
	await expect(page.getByRole("link", { name: "Compat" })).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("link", { name: "Near prefix" })).not.toHaveAttribute("aria-current", "page");
	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await expect(page.getByTestId("count")).toHaveText("0");

	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");

	await page.getByTestId("same-url").click();
	await expect(page.getByTestId("same-url-status")).toHaveText("done", { timeout: 1_500 });

	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/engine-compat-test\/target$/);
	await expect(page.getByTestId("target-title")).toBeVisible();

	expect(failures, failures.join("\n")).toEqual([]);
});

test("theme updates and navigation share one native View Transition owner", async ({ page }) => {
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-compat-test");

	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await closeCompatibilityDialog(page);
	await page.waitForTimeout(650);
	await page.getByTestId("coordinated-theme").click();
	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/engine-compat-test\/target$/);
	await expect(page.getByTestId("target-title")).toBeVisible();
	await expect(page.locator("html")).toHaveAttribute("data-engine-compat-theme", "night");

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
	await page.goto("/engine-compat-test");

	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await closeCompatibilityDialog(page);
	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");
	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/engine-compat-test\/target$/);

	expect(failures, failures.join("\n")).toEqual([]);
});

test("reduced motion keeps transitions functional without animation stalls", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-compat-test");

	await expect(page.getByTestId("effect-transition-status")).toHaveText("done");
	await closeCompatibilityDialog(page);
	await page.getByTestId("liquid").click();
	await expect(page.getByTestId("count")).toHaveText("1");
	await page.getByRole("link", { name: "Target page" }).click();
	await expect(page).toHaveURL(/\/engine-compat-test\/target$/);

	expect(failures, failures.join("\n")).toEqual([]);
});

test("the Gen 3 dialog appears only for a used feature without a fallback", async ({ page }) => {
	await page.addInitScript(() => {
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: any[]) {
			if (contextId === "webgl2") return null;
			return getContext.call(this, contextId as any, ...args as any);
		} as typeof HTMLCanvasElement.prototype.getContext;
	});
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-compat-test/browser-dialog");

	const dialog = page.getByRole("alertdialog", { name: "Browser update recommended" });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Leave" })).toBeVisible();
	await expect(dialog.getByRole("button", { name: "Continue" })).toBeFocused();
	await expect(dialog.getByRole("button", { name: "Update" })).toBeVisible();

	await dialog.getByRole("button", { name: "Continue" }).click();
	await expect(dialog).toBeHidden();
	await page.reload();
	await expect(dialog).toBeHidden();
	expect(failures, failures.join("\n")).toEqual([]);
});

test("reasonable fallbacks suppress the Gen 3 browser warning", async ({ page }) => {
	await page.addInitScript(() => {
		try {
			Object.defineProperty(Document.prototype, "startViewTransition", {
				configurable: true,
				value: undefined,
			});
			Object.defineProperty(Element.prototype, "animate", {
				configurable: true,
				value: undefined,
			});
		} catch {
			// Browsers without either API are already on the intended path.
		}
	});
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-compat-test/browser-dialog/fallback");

	await expect(page.getByRole("heading", { name: "Reasonable fallback available" })).toBeVisible();
	await expect(page.getByRole("alertdialog", { name: "Browser update recommended" })).toHaveCount(0);
	expect(failures, failures.join("\n")).toEqual([]);
});
