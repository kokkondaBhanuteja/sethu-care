import * as SecureStore from "expo-secure-store";

// The JWT lives in the device keychain/keystore (expo-secure-store), never in plain AsyncStorage.
const TOKEN_KEY = "sethu.jwt";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
