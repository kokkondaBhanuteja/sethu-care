// The admin session token, kept in localStorage. The console is a trusted internal tool behind
// admin auth; a JWT in localStorage is acceptable here (unlike a public app, where httpOnly cookies
// would be preferred). Guarded for SSR — window is undefined on the server.
const TOKEN_KEY = "sethu-admin-token";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
