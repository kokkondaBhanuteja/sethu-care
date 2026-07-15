import { create } from "zustand";

import { deleteToken, loadToken, saveToken } from "./storage";

export type Role = "CUSTOMER" | "TECHNICIAN" | "ADMIN";

export interface SessionUser {
  role: Role;
  name: string;
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  status: SessionStatus;
  /** Read the persisted token on app start; sets status to authenticated/unauthenticated. */
  hydrate: () => Promise<void>;
  /** Persist the token + user after a successful OTP verification. */
  signIn: (token: string, user: SessionUser) => Promise<void>;
  /** Clear the token (logout or account deletion). */
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  status: "loading",
  hydrate: async () => {
    const token = await loadToken();
    set({ token, status: token ? "authenticated" : "unauthenticated" });
  },
  signIn: async (token, user) => {
    await saveToken(token);
    set({ token, user, status: "authenticated" });
  },
  signOut: async () => {
    await deleteToken();
    set({ token: null, user: null, status: "unauthenticated" });
  },
}));

/** Non-hook accessor so the API client's request interceptor can read the current token. */
export function getSessionToken(): string | null {
  return useSession.getState().token;
}
