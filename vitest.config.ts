import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  test: {
    include: [
      "lib/state/__tests__/**/*.test.ts",
      "lib/network/__tests__/**/*.test.ts",
    ],
  },
});
