import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/support/vitest-setup.ts"],
    pool: "forks",
    isolate: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: { lines: 80, statements: 80, branches: 75, functions: 80 },
      include: ["src/**"],
      exclude: [
        "src/server.ts",
        "src/config/env.ts",
        "src/config/logger.ts",
        "src/infra/observability/sentry.ts",
        "src/http/plugins/error-handler.ts",
        "src/http/server.ts",
      ],
    },
  },
});
