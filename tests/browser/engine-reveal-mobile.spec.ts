import { expect, test } from "@playwright/test";

test.use({
	viewport: { width: 412, height: 915 },
	hasTouch: true,
});

test("EngineReveal animates tall cards and keeps geometry stable across a fast mobile fling", async ({ page }) => {
	await page.goto("/cities");

	const reveals = page.locator(".rv-result-card-reveal");
	await expect(reveals.first()).toBeVisible();
	expect(await reveals.count()).toBeGreaterThan(6);

	const hiddenAnchors = await reveals.evaluateAll((elements) => (
		elements.filter((element) => getComputedStyle(element).contentVisibility === "hidden").length
	));
	expect(hiddenAnchors).toBe(0);

	const last = reveals.last();
	await last.evaluate((element) => {
		const content = element.querySelector<HTMLElement>(".e-reveal__content");
		if (!content) throw new Error("EngineReveal content wrapper missing");
		(window as any).__engineRevealStates = [content.dataset.engineRevealState ?? ""];
		const observer = new MutationObserver(() => {
			(window as any).__engineRevealStates.push(content.dataset.engineRevealState ?? "");
		});
		observer.observe(content, {
			attributes: true,
			attributeFilter: ["data-engine-reveal-state"],
		});
		(window as any).__engineRevealObserver = observer;
	});

	const targetY = await last.evaluate((element) => (
		Math.max(0, element.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45)
	));
	await page.evaluate((top) => window.scrollTo(0, top), targetY);
	await page.waitForTimeout(500);

	await expect(last).toBeVisible();
	const initialHeight = await last.evaluate((element) => (element as HTMLElement).offsetHeight);
	expect(initialHeight).toBeGreaterThan(100);

	const states = await page.evaluate(() => (window as any).__engineRevealStates as string[]);
	expect(states, `observed reveal states: ${states.join(" -> ")}`).toContain("animating");
	const activeState = await last.locator(".e-reveal__content").getAttribute("data-engine-reveal-state");
	expect(["settled", "instant"]).toContain(activeState);

	// Jump back to the top, then skip a large amount of document distance in one
	// frame. This reproduces the high-velocity phone fling that used to leave
	// cards sleeping and could let content-visibility/scroll anchoring yank the
	// viewport upward.
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(80);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await page.waitForTimeout(650);

	const scrollState = await page.evaluate(() => ({
		y: window.scrollY,
		max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
	}));
	expect(scrollState.y).toBeGreaterThanOrEqual(Math.max(0, scrollState.max - 140));

	const finalHeight = await last.evaluate((element) => (element as HTMLElement).offsetHeight);
	expect(finalHeight).toBeGreaterThan(100);

	const finalState = await last.locator(".e-reveal__content").getAttribute("data-engine-reveal-state");
	expect(finalState).not.toBe("sleeping");

	const opacity = await last.locator(".e-reveal__content").evaluate((element) => (
		Number.parseFloat(getComputedStyle(element).opacity)
	));
	expect(opacity).toBeGreaterThan(0.5);

	// At document end, every reveal that still physically intersects the visual
	// viewport must remain rendered. Mobile browser chrome can temporarily make
	// the mathematical layout viewport disagree with what the user actually sees.
	const visibleRevealStates = await reveals.evaluateAll((elements) => {
		const visualViewport = window.visualViewport;
		const top = visualViewport?.offsetTop ?? 0;
		const left = visualViewport?.offsetLeft ?? 0;
		const bottom = top + (visualViewport?.height ?? window.innerHeight);
		const right = left + (visualViewport?.width ?? window.innerWidth);

		return elements.flatMap((element) => {
			const rect = element.getBoundingClientRect();
			const intersects = rect.bottom > top
				&& rect.top < bottom
				&& rect.right > left
				&& rect.left < right;
			if (!intersects) return [];
			const content = element.querySelector<HTMLElement>(".e-reveal__content");
			return [content?.dataset.engineRevealState ?? "missing"];
		});
	});

	expect(visibleRevealStates.length).toBeGreaterThan(0);
	expect(
		visibleRevealStates.filter((state) => state === "sleeping" || state === "missing"),
		`visible reveal states at bottom: ${visibleRevealStates.join(", ")}`,
	).toEqual([]);
});
