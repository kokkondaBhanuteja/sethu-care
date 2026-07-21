import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureApiClient } from "@sethu/api-client";
import { getSessionToken } from "@sethu/core";
import { initI18n, detectBrowserLanguage } from "@sethu/i18n";

import App from "./App";
import "./index.css";

// One-time boot wiring: API base URL (env override → local backend), bearer token from the
// session store, and i18n at the browser/WebView language.
configureApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8090",
  getToken: async () => getSessionToken(),
});
initI18n(detectBrowserLanguage());

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
