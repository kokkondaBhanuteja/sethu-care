import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// The JWT lives in the device keychain/keystore (expo-secure-store) on native. On web (used for
// local previews) secure-store has no implementation, so we fall back to localStorage.
const TOKEN_KEY = "sethu.jwt";

const webStore = (globalThis as { localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } }).localStorage;

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webStore?.getItem(TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === "web") {
    webStore?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
