import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { configureApiClient } from "@sethu/api-client";
import { getSessionToken } from "@sethu/core";
import { initI18n, detectBrowserLanguage } from "@sethu/i18n";

import App from "./App";
import { env } from "./lib/env";
import { createQueryClient } from "./lib/query/queryClient";
import { showToast, TOAST_TONES } from "./lib/toast/toastStore";
import "./index.css";

// One-time boot wiring: API base URL, bearer token from the session store, i18n at the
// browser/WebView language, and the query client with its mutation-error → toast bridge.
//
// The console is English-only in practice (spec §4.7: "UI language is English"), but text still
// goes through @sethu/i18n so the Hindi and Telugu key sets stay complete and translating later is
// a data change rather than a refactor.
configureApiClient({
  baseUrl: env.apiUrl,
  getToken: async () => getSessionToken(),
});
initI18n(detectBrowserLanguage());

// A failed read is rendered in place by QueryBoundary; a failed WRITE has no such home, because the
// screen the operator is looking at did not change. So mutations announce themselves once, here.
const queryClient = createQueryClient({
  onMutationError: (error) => {
    showToast({ message: error.message, tone: TOAST_TONES.danger });
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("index.html is missing the #root mount point.");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
