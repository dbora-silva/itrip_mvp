import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from vitest.config.mts on purpose: these tests need the local Supabase stack
// running (`npm run supabase:start`) and are never part of `npm run validate` /
// `npm run test`. Run explicitly via `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["unit-tests/integration/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 20000,
    // These tests share one real Postgres instance and the same two seed users, so file
    // parallelism both risks cross-file interference and had every file independently
    // shell out to `supabase status` at once, which was flaky on Windows. Run test files
    // sequentially instead — this suite is not large enough for the parallelism to matter.
    fileParallelism: false,
  },
});
