export { useSession, getSessionToken } from "./session/store";
export type { Role, SessionUser, SessionStatus } from "./session/store";
export { saveToken, loadToken, deleteToken, setStorageAdapter } from "./session/storage";
export type { StorageAdapter } from "./session/storage";
// Small non-secret values that must outlive a session and go through the same adapter as the
// token — a generated device id, an offline action queue. App code never touches localStorage.
export { savePreference, loadPreference } from "./session/storage";
export { usePreferences } from "./preferences/store";
