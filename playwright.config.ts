import { defineConfig, devices } from "@playwright/test";

/**
 * Initial Playwright configuration for iTrip. This project intentionally ships only a
 * minimal smoke test (tests/e2e/smoke.spec.ts) — the real E2E suite (auth, trips CRUD,
 * etc.) is built separately, by hand, on top of this scaffold.
 *
 * baseURL points at the Docker container (docker-compose.yml, host port 3002 -> container
 * port 3000 — see docs/local-environment.md), not `npm run dev`: this is meant to exercise
 * the same production build the app actually ships, not the dev server.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [["html", { open: "never" }]],
  outputDir: "./test-results",
  use: {
    baseURL: "http://localhost:3002",
    // Only kept for a *failing* test — never for a passing one — so a normal green run
    // produces no artifacts to accidentally version.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
