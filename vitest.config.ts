import { defineConfig } from "vitest/config";

// One runner for every workspace. Tests sit next to the source they test.
// Coverage is one figure over all new TypeScript; the threshold is the
// project's floor and is never lowered to make a run pass.
export default defineConfig({
  test: {
    include: ["{server,db-migrate,web,edge,scripts}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "app/**", "e2e/**"],
    // Tests of the page ask for a browser-like environment themselves, with
    // "@vitest-environment jsdom" on their first line.
    environment: "node",
    testTimeout: 15_000,
    hookTimeout: 180_000,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "lcov"],
      reportsDirectory: "coverage",
      include: ["{server,db-migrate,web,edge,scripts}/**/*.{ts,tsx}"],
      exclude: [
        "app/**",
        "e2e/**",
        "**/dist/**",
        "**/*.test.{ts,tsx}",
        "**/testing/**",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
