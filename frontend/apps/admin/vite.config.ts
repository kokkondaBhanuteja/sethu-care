import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The version the sidebar and the Help screen display comes from package.json at build time rather
// than a VITE_ variable, so a release can never ship mislabelled because someone forgot to set one.
const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

/**
 * Cold start is budgeted at under 2 seconds on a mid-range Android (Admin spec §2.4), and the
 * critical path is splash → login → dashboard. Every screen is already lazy-loaded per route, but
 * without this every one of them also pulled the whole vendor set into the entry chunk.
 *
 * These four groups are split because they have genuinely different lifetimes:
 * - `react` changes when React does, which is rarely — the best long-term cache hit.
 * - `router` is needed before anything renders.
 * - `query` is needed only once a screen asks for data, so it is off the login path entirely.
 * - `forms` (react-hook-form + zod) is needed only by a screen with a form, which the dashboard
 *   is not — this is the largest single win on the critical path.
 */
function vendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
  if (/[\\/]node_modules[\\/]react-router/.test(id)) return "router";
  if (/[\\/]node_modules[\\/]@tanstack/.test(id)) return "query";
  if (/[\\/]node_modules[\\/](react-hook-form|zod|@hookform)/.test(id)) return "forms";
  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // Lower than Vite's 500kB default: this app runs in a WebView on a mid-range phone, and a
    // warning that only fires at half a megabyte is a warning that fires too late to act on.
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        manualChunks: (id) => vendorChunk(id),
      },
    },
  },
});
