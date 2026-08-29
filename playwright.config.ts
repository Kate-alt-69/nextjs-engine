import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/browser",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	timeout: 30_000,
	expect: {
		timeout: 7_500,
	},
	use: {
		baseURL: "http://127.0.0.1:3100",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
		url: "http://127.0.0.1:3100/__engine-compat",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
	],
});
