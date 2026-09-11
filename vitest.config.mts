import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./unit-tests/setup.ts"],
    include: ["unit-tests/**/*.test.{ts,tsx}"],
    // Integration tests live under unit-tests/integration/ but run only via
    // `npm run test:integration` (vitest.integration.config.mts) against a real local
    // Supabase instance. They must never be picked up here — this is what keeps
    // `npm run test` / `npm run validate` independent of the local Supabase stack.
    exclude: ["unit-tests/integration/**", "node_modules/**"],
    css: false,
  },
});
