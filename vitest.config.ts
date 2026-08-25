import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // node only — these are pure kinship functions, no DOM involved
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
