import { expect, test, type Page } from "@playwright/test";

const PRIVATE_BACKEND_TOKEN = "gen3-private-backend-dev-token-2026";

function watchBrowserFailures(page: Page) {
	const failures: string[] = [];
	page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
	page.on("console", (message) => {
		if (message.type() === "error") failures.push(`console: ${message.text()}`);
	});
	return failures;
}

test("Gen 3 login binds one opaque private-search command to its device", async ({ page, browser }) => {
	const failures = watchBrowserFailures(page);
	await page.goto("/engine-private-search");
	await expect(page.getByTestId("device-status")).toContainText("private key exportable: false");

	const loginResponsePromise = page.waitForResponse((response) => (
		response.url().endsWith("/engine-private-search/login")
		&& response.request().method() === "POST"
	));
	await page.getByRole("button", { name: "Sign in + bind device" }).click();
	const loginResponse = await loginResponsePromise;
	expect(loginResponse.status()).toBe(201);
	const loginPayload = await loginResponse.json() as Record<string, unknown>;
	expect(loginPayload).not.toHaveProperty("token");
	expect(loginPayload).not.toHaveProperty("cookie");
	await expect(page.getByTestId("login-status")).toContainText("Session is HttpOnly and device-bound");
	expect(await page.evaluate(() => document.cookie)).not.toContain("__Host-engine-session");

	const commandRequestPromise = page.waitForRequest((request) => (
		new URL(request.url()).pathname === "/_static/command"
		&& request.method() === "POST"
	));
	const commandResponsePromise = page.waitForResponse((response) => (
		new URL(response.url()).pathname === "/_static/command"
		&& response.request().method() === "POST"
	));
	await page.getByTestId("private-search").click();
	const commandRequest = await commandRequestPromise;
	const commandResponse = await commandResponsePromise;
	expect(commandResponse.status()).toBe(200);
	await expect(page.getByRole("heading", { name: "Nebula Render Kit" })).toBeVisible();
	await expect(page.getByTestId("private-results")).not.toContainText("databaseScore");
	await expect(page.getByTestId("private-results")).not.toContainText("internalPartition");

	const responseText = await commandResponse.text();
	expect(responseText).not.toContain(PRIVATE_BACKEND_TOKEN);
	expect(responseText).not.toContain("catalog-db.internal");
	expect(responseText).not.toContain("private-rank-v3");
	const wireBody = JSON.parse(commandRequest.postData() ?? "{}") as Record<string, unknown>;
	expect(Object.keys(wireBody)).toHaveLength(1);
	expect(Object.keys(wireBody)[0]).not.toBe("query");
	expect(commandRequest.postData()).not.toContain("privateSearch");
	const commandHeaders = await commandRequest.allHeaders();
	const opaqueHeaderNames = Object.keys(commandHeaders).filter((name) => name.startsWith("x-h"));
	expect(opaqueHeaderNames).toHaveLength(4);
	expect(opaqueHeaderNames.every((name) => !/engine|command|nonce|signature|timestamp/i.test(name))).toBe(true);

	const wrongOriginHeaders = Object.fromEntries(
		Object.entries(commandHeaders).filter(([name]) => name === "content-type" || name.startsWith("x-h")),
	);
	wrongOriginHeaders.origin = "https://untrusted.example.com";
	const wrongOriginResponse = await page.context().request.post(
		new URL("/_static/command", page.url()).toString(),
		{ headers: wrongOriginHeaders, data: commandRequest.postData() ?? "{}" },
	);
	expect(wrongOriginResponse.status()).toBe(403);

	const sessionCookies = (await page.context().cookies()).filter((cookie) => cookie.name === "__Host-engine-session");
	expect(sessionCookies).toHaveLength(1);
	const copiedContext = await browser.newContext();
	try {
		await copiedContext.addCookies(sessionCookies);
		const copiedPage = await copiedContext.newPage();
		await copiedPage.goto(new URL("/engine-private-search", page.url()).toString());
		await expect(copiedPage.getByTestId("device-status")).toContainText("private key exportable: false");
		const copiedResponsePromise = copiedPage.waitForResponse((response) => (
			new URL(response.url()).pathname === "/_static/command"
		));
		await copiedPage.getByTestId("private-search").click();
		const copiedResponse = await copiedResponsePromise;
		expect(copiedResponse.status()).toBe(401);
		await expect(copiedPage.getByTestId("search-status")).toContainText("(401)");
	} finally {
		await copiedContext.close();
	}

	expect(failures, failures.join("\n")).toEqual([]);
});
