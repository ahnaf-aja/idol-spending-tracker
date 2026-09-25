import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * The suite drives the real Next.js server against the real Postgres database.
 * It creates its own `e2e_` users, so it never touches the seeded owner account
 * or anyone else's data.
 *
 * Usage:
 *   npm run dev          # in one terminal
 *   npx playwright test  # in another
 * or let Playwright boot the server: npx playwright test (webServer below)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Desktop-first; mobile is covered by a dedicated project below.
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 780 } },
      testMatch: /responsive\.spec\.ts/,
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 } },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
});
