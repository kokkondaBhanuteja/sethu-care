import "../global.css";

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "@sethu/i18n";
import { configureApiClient } from "@sethu/api-client";
import { getSessionToken, useSession } from "@sethu/core";

import { API_BASE_URL } from "@/lib/config";
import { initAppI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

// One-time bootstrap (module scope): i18n in the device language, and the API client attaching the
// session token to every request.
const i18n = initAppI18n();
configureApiClient({ baseUrl: API_BASE_URL, getToken: getSessionToken });

// Redirect between the app and the (auth) group based on session status; hydrate the persisted
// token on start. Signed-out users are pushed to sign-in; signed-in users never sit on auth screens.
function useAuthGate() {
  const status = useSession((state) => state.status);
  const hydrate = useSession((state) => state.hydrate);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (status === "authenticated" && inAuthGroup) {
      router.replace("/");
    }
  }, [status, segments, router]);
}

function RootNavigator() {
  useAuthGate();
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <RootNavigator />
          </I18nextProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
