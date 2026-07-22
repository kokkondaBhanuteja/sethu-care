/// <reference types="vite/client" />

// Declaring the app's own variables narrows them from vite/client's index signature, so
// lib/env.ts reads real types instead of `any`. Add a variable here and in .env.example
// together — never read a VITE_* name that is not declared.
interface ImportMetaEnv {
  /** Backend base URL. Falls back to the local Go API when unset. */
  readonly VITE_API_URL?: string;
  /** "true" serves every screen from the typed mock services in features/<f>/*.mock.ts. */
  readonly VITE_USE_MOCKS?: string;
  /** Optional forced mock behaviour for exercising states: "error" | "empty" | "slow". */
  readonly VITE_MOCK_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
