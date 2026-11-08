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
      "lib/identity/__tests__/**/*.test.ts",
      "lib/social/__tests__/**/*.test.ts",
      "server/__tests__/**/*.test.ts",
      "shared/__tests__/**/*.test.ts",
    ],
  },
});
