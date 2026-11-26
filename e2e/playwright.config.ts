import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a deployed environment, in three browser
 * engines at two widths (performance design P6). They read:
 *
 *   VD_BASE_URL          the environment's address, with https://
 *   VD_ACCESS_PASSWORD   its access password
 *   VD_ENVIRONMENT       test or production
 *   VD_EXPECTED_VERSION  the Release that must be running (optional)
 */

const WIDTHS = [320, 1280] as const;
const ENGINES = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "firefox", device: devices["Desktop Firefox"] },
  { name: "webkit", device: devices["Desktop Safari"] },
] as const;

export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results",
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.VD_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: ENGINES.flatMap((engine) =>
    WIDTHS.map((width) => ({
      name: `${engine.name}-${width}`,
      use: { ...engine.device, viewport: { width, height: 720 } },
    })),
  ),
});
