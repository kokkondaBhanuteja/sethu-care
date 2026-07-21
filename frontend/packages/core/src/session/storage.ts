// Persistence for the JWT and small non-secret preferences, behind a pluggable adapter so the
// same session/preferences stores work on every surface: plain web uses the localStorage default
// below; the Capacitor apps will call setStorageAdapter() at boot with a native-backed adapter
// (Preferences / secure storage) once the bridge lands. The function API (saveToken/loadToken/…)
// is unchanged from the Expo era, so store code never cares where bytes actually live.

const TOKEN_KEY = "sethu.jwt";

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const memoryFallback = new Map<string, string>();

// Structurally-typed localStorage access so this package needs no DOM lib (it also runs under
// Node for SSR/tests).
type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
function webStorage(): WebStorage | undefined {
  return (globalThis as { localStorage?: WebStorage }).localStorage;
}

// Default adapter: localStorage when the environment has one (browser, Capacitor WebView),
// an in-memory map otherwise (SSR/tests) — never throws for lack of a platform.
const webAdapter: StorageAdapter = {
  async get(key) {
    const store = webStorage();
    return store ? store.getItem(key) : (memoryFallback.get(key) ?? null);
  },
  async set(key, value) {
    const store = webStorage();
    if (store) store.setItem(key, value);
    else memoryFallback.set(key, value);
  },
  async remove(key) {
    const store = webStorage();
    if (store) store.removeItem(key);
    else memoryFallback.delete(key);
  },
};

let adapter: StorageAdapter = webAdapter;

/** Swap the persistence backend (e.g. Capacitor secure storage). Call once, at app boot. */
export function setStorageAdapter(custom: StorageAdapter): void {
  adapter = custom;
}

export async function saveToken(token: string): Promise<void> {
  await adapter.set(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return adapter.get(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  await adapter.remove(TOKEN_KEY);
}

export async function savePreference(key: string, value: string): Promise<void> {
  await adapter.set(key, value);
}

export async function loadPreference(key: string): Promise<string | null> {
  return adapter.get(key);
}
