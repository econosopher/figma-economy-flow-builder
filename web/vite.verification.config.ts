import { defineConfig } from "vite";
import base from "./vite.config";
export default defineConfig({
  ...base,
  build: {
    ...base.build,
    outDir: ".verification",
    rollupOptions: { input: "tests/browser/render-parity.html" },
  },
});
