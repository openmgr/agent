import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 10000,
    setupFiles: ["src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/__tests__/**",
        "src/cli.ts", // Will be split and tested separately
      ],
      thresholds: {
        // Target 80% on critical modules
        "src/agent.ts": { statements: 80 },
        "src/tools/**": { statements: 80 },
        "src/llm/**": { statements: 80 },
        "src/session/**": { statements: 80 },
      },
    },
  },
});
