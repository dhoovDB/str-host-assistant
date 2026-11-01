import { defineConfig } from "vitest/config";

// Standalone from vite.config.ts: the Lovable config brings Cloudflare and
// TanStack plugins the pure engine tests don't need. The include keeps
// Playwright's e2e/*.spec.ts out of the Vitest run.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
