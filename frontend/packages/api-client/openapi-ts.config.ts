import { defineConfig } from "@hey-api/openapi-ts";

// Generates the typed SDK + TanStack Query options from the backend's committed contract
// (api/openapi.yaml). The output lands in src/generated and is NEVER hand-edited — rerun
// `pnpm generate` to refresh it. The fetch client is bundled into the output, so there is no
// external client runtime dependency. No formatter runs, so the output is deterministic and the
// CI drift diff is stable without needing prettier installed.
export default defineConfig({
  input: "../../../backend/api/openapi.yaml",
  output: "src/generated",
  plugins: ["@hey-api/client-fetch", "@tanstack/react-query"],
});
