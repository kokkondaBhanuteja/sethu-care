import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest gets its own config rather than a `test` key on vite.config.ts, so the app build never
// carries test-only settings and the two can diverge where they should (no Tailwind plugin here —
// class names are asserted as strings, and compiling the token layer per test file is pure cost).
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // e2e/ is Playwright's; running it under Vitest would start a browser per assertion.
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      // The rules this console must not break live in lib/. Everything there is pure and
      // deterministic, so there is no excuse for a gap in it.
      include: ["src/lib/**", "src/hooks/**", "src/components/ui/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/CLAUDE.md"],
    },
  },
});
