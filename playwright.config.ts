import { defineConfig, devices } from "@playwright/test";

// E2E config for the hydration smoke test (ROADMAP "Next — pre-v2 hardening").
//
// The webServer runs `vite dev` in DEMO_MODE, so the route loader serves
// src/demo/fixtures.ts and needs zero secrets (see src/routes/index.tsx and
// ROADMAP Task 12 / decision log 2026-05-22). DEMO_MODE is passed via `env`
// rather than a committed .dev.vars so the run stays secret-free and works the
// same locally and in CI.
//
// The port is forced because @lovable.dev/vite-tanstack-config does its own
// port/host/strictPort sandbox detection; pinning it keeps `url` deterministic.
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    env: { DEMO_MODE: "true" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
