import { expect, test } from "@playwright/test";

test.use({
	viewport: { width: 412, height: 915 },
	hasTouch: true,
});

test("EngineReveal keeps card geometry stable across a fast mobile fling", async ({ page }) => {
	await page.goto("/cities");

	const reveals = page.locator(".rv-result-card-reveal");
	await expect(reveals.first()).toBeVisible();
	expect(await reveals.count()).toBeGreaterThan(6);

	const hiddenAnchors = await reveals.evaluateAll((elements) => (
		elements.filter((element) => getComputedStyle(element).contentVisibility === "hidden").length
	));
	expect(hiddenAnchors).toBe(0);

	const last = reveals.last();
	const targetY = await last.evaluate((element) => (
		Math.max(0, element.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45)
	));
	await page.evaluate((top) => window.scrollTo(0, top), targetY);
	await page.waitForTimeout(250);

	await expect(last).toBeVisible();
	const initialHeight = await last.evaluate((element) => (element as HTMLElement).offsetHeight);
	expect(initialHeight).toBeGreaterThan(100);

	const activeState = await last.locator(".e-reveal__content").getAttribute("data-engine-reveal-state");
	expect(activeState).not.toBe("sleeping");

	// Jump back to the top, then skip the entire card motion range in one frame.
	// This reproduces the high-velocity phone fling that used to leave cards
	// sleeping and could collapse scroll geometry / yank the viewport upward.
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(80);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await page.waitForTimeout(400);

	const scrollState = await page.evaluate(() => ({
		y: window.scrollY,
		max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
	}));
	expect(scrollState.y).toBeGreaterThan(scrollState.max * 0.7);

	const finalHeight = await last.evaluate((element) => (element as HTMLElement).offsetHeight);
	expect(finalHeight).toBeGreaterThan(100);

	const finalState = await last.locator(".e-reveal__content").getAttribute("data-engine-reveal-state");
	expect(finalState).not.toBe("sleeping");

	const opacity = await last.locator(".e-reveal__content").evaluate((element) => (
		Number.parseFloat(getComputedStyle(element).opacity)
	));
	expect(opacity).toBeGreaterThan(0.5);
});
