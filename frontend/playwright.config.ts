import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/setup/global-setup.ts",
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"],
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  expect: {
    toMatchSnapshot: { maxDiffPixelRatio: 0.001 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "github" : "list",
});
