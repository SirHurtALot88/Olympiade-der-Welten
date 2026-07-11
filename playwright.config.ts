import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "ui-cockpit-playtest.spec.js",
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/foundation",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
