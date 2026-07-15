import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider, initI18n } from "@sethu/i18n";
import { configureApiClient } from "@sethu/api-client";

import { API_BASE_URL } from "@/lib/config";
import { queryClient } from "@/lib/query-client";

// One-time app bootstrap (module scope runs before first render): initialise i18n and point the
// generated API client at the backend. Device-locale detection + the JWT getter arrive in Phase 2.
const i18n = initI18n("en");
configureApiClient({ baseUrl: API_BASE_URL });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
