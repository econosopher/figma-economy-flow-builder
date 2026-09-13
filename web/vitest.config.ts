import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "cloudflare:workers": new URL(
        "./tests/stubs/cloudflare.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
