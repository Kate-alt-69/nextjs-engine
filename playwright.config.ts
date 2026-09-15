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
		baseURL: "https://localhost:3100",
		ignoreHTTPSErrors: true,
		trace: "retain-on-failure",
	},
	webServer: {
		command: "npm run dev -- --experimental-https --hostname localhost --port 3100",
		url: "https://localhost:3100/",
		ignoreHTTPSErrors: true,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
		{ name: "webkit", use: { ...devices["Desktop Safari"] } },
		{
			name: "phone-chromium-matrix",
			grep: /@device-matrix/,
			use: { ...devices["Pixel 7"] },
		},
		{
			name: "tablet-webkit-matrix",
			grep: /@device-matrix/,
			use: { ...devices["iPad Pro 11"] },
		},
	],
});
